import { z } from '@nivvi/contracts';
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  JOB_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  MAIL_MODE: z.enum(['file', 'smtp']).default('file'),
  MAIL_DIRECTORY: z.string().min(1),
  MAIL_FROM: z.email(),
  PUBLIC_APP_URL: z.string().url(),
  SMTP_URL: z.string().url().optional(),
});
export function readConfig(env: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid backend configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}.`,
    );
  const v = result.data;
  if (
    v.NODE_ENV === 'production' &&
    (v.MAIL_MODE !== 'smtp' || !v.SMTP_URL || !v.PUBLIC_APP_URL.startsWith('https://'))
  )
    throw new Error('Production requires SMTP and an HTTPS application URL.');
  const parsed = new URL(v.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error('A PostgreSQL database URL is required.');
  if (v.MAIL_MODE === 'smtp') {
    if (!v.SMTP_URL) throw new Error('SMTP_URL is required for SMTP delivery.');
    const smtp = new URL(v.SMTP_URL);
    if (!['smtp:', 'smtps:'].includes(smtp.protocol) || !smtp.username || !smtp.password)
      throw new Error('An authenticated SMTP URL is required.');
  }
  const appUrl = new URL(v.PUBLIC_APP_URL);
  if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password)
    throw new Error('Use an HTTP(S) application URL without credentials.');
  return {
    env: v.NODE_ENV,
    databaseUrl: v.DATABASE_URL,
    host: v.HOST,
    port: v.PORT,
    accessSecret: v.ACCESS_TOKEN_SECRET,
    issuer: 'nivvi-api',
    audience: 'nivvi-mobile',
    accessTtlSeconds: 600,
    refreshDays: 30,
    jobEncryptionKey: v.JOB_ENCRYPTION_KEY,
    mailMode: v.MAIL_MODE,
    mailDirectory: v.MAIL_DIRECTORY,
    mailFrom: v.MAIL_FROM,
    publicAppUrl: v.PUBLIC_APP_URL,
    smtpUrl: v.SMTP_URL,
  };
}
export type Config = ReturnType<typeof readConfig>;
