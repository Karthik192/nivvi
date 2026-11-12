import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import type { Config } from './config.js';
import type { Deps, Tx } from './types.js';
import { ApiError } from './errors.js';
export interface AccountMail {
  to: string;
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
  token: string;
}
function encrypt(config: Config, value: AccountMail) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(config.jobEncryptionKey, 'hex'), iv);
  const content = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    content: content.toString('base64'),
  };
}
export function decryptMail(config: Config, payload: unknown): AccountMail {
  const p = payload as { iv: string; tag: string; content: string };
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(config.jobEncryptionKey, 'hex'),
    Buffer.from(p.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(p.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(p.content, 'base64')), decipher.final()]).toString(
      'utf8',
    ),
  ) as AccountMail;
}
export async function enqueueAccountMail(
  tx: Tx,
  config: Config,
  userId: string,
  email: string,
  purpose: AccountMail['purpose'],
  rawToken: string,
) {
  return tx.job.create({
    data: {
      userId,
      type: 'ACCOUNT_EMAIL',
      dedupeKey: `mail:${purpose}:${randomBytes(16).toString('hex')}`,
      payload: encrypt(config, { to: email, purpose, token: rawToken }),
    },
  });
}
export async function workOneMail(deps: Deps) {
  const job = await deps.db.$transaction(async (tx) => {
    // A worker may die during its final lease; make that exhausted job terminal.
    await tx.job.updateMany({
      where: {
        type: 'ACCOUNT_EMAIL',
        status: { in: ['PENDING', 'RETRY'] },
        attempts: { gte: 5 },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      data: { status: 'FAILED', lockedUntil: null },
    });
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "Job" WHERE type='ACCOUNT_EMAIL' AND status IN ('PENDING','RETRY') AND "nextAttemptAt"<=now() AND ("lockedUntil" IS NULL OR "lockedUntil"<now()) AND attempts<5 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!rows[0]) return null;
    return tx.job.update({
      where: { id: rows[0].id },
      data: { lockedUntil: new Date(Date.now() + 60000), attempts: { increment: 1 } },
    });
  });
  if (!job) return false;
  try {
    const mail = decryptMail(deps.config, job.payload);
    const token = await deps.db.accountToken.findFirst({
      where: {
        userId: job.userId,
        user: { status: 'ACTIVE' },
        tokenHash: createHash('sha256').update(mail.token).digest('hex'),
        purpose: mail.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!token) {
      await deps.db.job.update({
        where: { id: job.id },
        data: { status: 'CANCELLED', payload: { redacted: true }, lockedUntil: null },
      });
      return true;
    }
    const url = new URL(
      mail.purpose === 'RESET_PASSWORD' ? 'reset-password' : 'verify-email',
      deps.config.publicAppUrl.endsWith('/')
        ? deps.config.publicAppUrl
        : deps.config.publicAppUrl + '/',
    );
    url.hash = new URLSearchParams({ token: mail.token }).toString();
    const text = `${mail.purpose === 'RESET_PASSWORD' ? 'Reset your Nivvi password' : 'Verify your Nivvi email'}: ${url.toString()}\nIf you did not request this, ignore it. Never share this link.`;
    if (deps.config.mailMode === 'file') {
      if (deps.config.env === 'production')
        throw new ApiError(
          500,
          'MAIL_CONFIGURATION',
          'Local mail delivery is disabled in production.',
        );
      await mkdir(deps.config.mailDirectory, { recursive: true });
      await writeFile(
        join(deps.config.mailDirectory, `${job.id}.json`),
        JSON.stringify({
          to: mail.to,
          subject: mail.purpose,
          text,
          delivery: 'LOCAL_FILE_ONLY_NOT_SENT',
        }),
        { mode: 0o600, flag: 'wx' },
      ).catch((e) => {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      });
    } else {
      const smtp = new URL(deps.config.smtpUrl!);
      if (!['smtp:', 'smtps:'].includes(smtp.protocol))
        throw new Error('Unsupported SMTP transport.');
      const transport = nodemailer.createTransport({
        host: smtp.hostname,
        port: Number(smtp.port || (smtp.protocol === 'smtps:' ? '465' : '587')),
        secure: smtp.protocol === 'smtps:',
        requireTLS: true,
        auth: { user: decodeURIComponent(smtp.username), pass: decodeURIComponent(smtp.password) },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
      try {
        await transport.sendMail({
          from: deps.config.mailFrom,
          to: mail.to,
          subject: mail.purpose,
          text,
          messageId: `<${job.id}@nivvi>`,
        });
      } finally {
        transport.close();
      }
    }
    await deps.db.job.update({
      where: { id: job.id },
      data: { status: 'DELIVERED', payload: { redacted: true }, lockedUntil: null },
    });
  } catch {
    await deps.db.job.update({
      where: { id: job.id },
      data: {
        status: job.attempts >= 5 ? 'FAILED' : 'RETRY',
        lockedUntil: null,
        nextAttemptAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** job.attempts)),
      },
    });
    deps.logger.warn({ event: 'mail_delivery_failed', jobId: job.id });
  }
  return true;
}
