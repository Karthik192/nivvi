import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import type { User } from '../generated/prisma/client.js';
import type { Config } from '../core/config.js';
import type { Tx, Principal } from '../core/types.js';
import { ApiError } from '../core/errors.js';
import { enqueueAccountMail } from '../core/mail.js';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Authentication failed.');
export const hashPassword = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
let dummyHash: Promise<string> | undefined;
export async function checkPassword(hash: string | undefined, password: string) {
  const target = hash ?? (await (dummyHash ??= hashPassword(opaqueToken())));
  const valid = await argon2.verify(target, password);
  return hash !== undefined && valid;
}
export function publicUser(user: User) {
  const {
    id,
    email,
    displayName,
    currency,
    locale,
    timezone,
    theme,
    emailVerifiedAt,
    status,
    profileVersion,
    createdAt,
    updatedAt,
  } = user;
  return {
    id,
    email,
    displayName,
    currency,
    locale,
    timezone,
    theme,
    emailVerifiedAt,
    status,
    profileVersion,
    createdAt,
    updatedAt,
  };
}
export async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT "userId" FROM "SyncState" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') throw unauthorized();
  return user;
}
export async function lockSession(tx: Tx, sessionId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${sessionId}::uuid FOR UPDATE`;
  return tx.session.findUnique({ where: { id: sessionId } });
}
export async function activePrincipal(tx: Tx, auth: Principal) {
  const user = await lockUser(tx, auth.userId);
  const session = await lockSession(tx, auth.sessionId);
  if (
    !session ||
    session.userId !== user.id ||
    session.revokedAt ||
    session.familyExpiresAt <= new Date()
  )
    throw unauthorized();
  return user;
}
export async function accessToken(config: Config, userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTtlSeconds}s`)
    .sign(new TextEncoder().encode(config.accessSecret));
}
export async function newSession(tx: Tx, config: Config, user: User, installationId: string) {
  const expiresAt = new Date(Date.now() + config.refreshDays * 86400000);
  const session = await tx.session.create({
    data: { userId: user.id, installationId, familyExpiresAt: expiresAt },
  });
  const refreshToken = opaqueToken();
  await tx.refreshCredential.create({
    data: { sessionId: session.id, tokenHash: digest(refreshToken), expiresAt },
  });
  return {
    user: publicUser(user),
    accessToken: await accessToken(config, user.id, session.id),
    refreshToken,
    expiresIn: config.accessTtlSeconds,
  };
}
export async function accountMail(
  tx: Tx,
  config: Config,
  user: User,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
) {
  const raw = opaqueToken();
  const now = new Date();
  await tx.accountToken.updateMany({
    where: { userId: user.id, purpose, consumedAt: null },
    data: { consumedAt: now },
  });
  await tx.accountToken.create({
    data: {
      userId: user.id,
      purpose,
      tokenHash: digest(raw),
      expiresAt: new Date(now.getTime() + 15 * 60000),
    },
  });
  await enqueueAccountMail(tx, config, user.id, user.email, purpose, raw);
}
