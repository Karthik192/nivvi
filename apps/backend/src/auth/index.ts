import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { jwtVerify } from 'jose';
import {
  registerBody,
  loginBody,
  refreshBody,
  forgotBody,
  resetBody,
  verifyBody,
  reauthBody,
  accountDeleteBody,
  profilePatch,
  pagination,
  uuid,
} from '@nivvi/contracts';
import type { Deps } from '../core/types.js';
import { ApiError, notFound } from '../core/errors.js';
import { endpoint, principal, send, sendPage, id } from '../core/http.js';
import { seedDefaultCategories } from '../core/defaults.js';
import { getPage } from '../core/pagination.js';
import {
  digest,
  opaqueToken,
  unauthorized,
  hashPassword,
  checkPassword,
  publicUser,
  lockUser,
  lockSession,
  activePrincipal,
  accessToken,
  newSession,
  accountMail,
} from './service.js';

export function authenticate(deps: Deps): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    let userId: string;
    let sessionId: string;
    try {
      const { payload } = await jwtVerify(
        header.slice(7),
        new TextEncoder().encode(deps.config.accessSecret),
        {
          algorithms: ['HS256'],
          issuer: deps.config.issuer,
          audience: deps.config.audience,
          requiredClaims: ['sub', 'sid', 'exp', 'iat'],
        },
      );
      userId = uuid.parse(payload.sub);
      sessionId = uuid.parse(payload.sid);
    } catch {
      throw unauthorized();
    }
    const session = await deps.db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.familyExpiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    )
      throw unauthorized();
    req.auth = { userId, sessionId, timezone: session.user.timezone };
    next();
  };
}

function validate(schema: { parse(value: unknown): unknown }): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

function limits(deps: Deps, identity?: 'email' | 'principal' | 'refresh' | 'reset' | 'verify') {
  const handler: RequestHandler = (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Please try again later.' },
      requestId: res.req.requestId,
    });
  const skip = () => deps.config.env === 'test';
  if (!identity)
    return rateLimit({
      windowMs: 15 * 60000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler,
      skip,
    });
  return rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
    skip,
    keyGenerator: async (req) => {
      // Body validation and bearer authentication run before this account limiter.
      let account: string;
      if (identity === 'email')
        account = forgotBody.parse({ email: (req.body as { email: string }).email }).email;
      else if (identity === 'principal') account = principal(req).userId;
      else if (identity === 'refresh') {
        const hash = digest(refreshBody.parse(req.body).refreshToken);
        const credential = await deps.db.refreshCredential.findUnique({
          where: { tokenHash: hash },
          include: { session: true },
        });
        account = credential?.session.userId ?? hash;
      } else {
        const raw =
          identity === 'reset'
            ? resetBody.parse(req.body).resetToken
            : verifyBody.parse(req.body).verificationToken;
        const hash = digest(raw);
        const token = await deps.db.accountToken.findUnique({ where: { tokenHash: hash } });
        account = token?.userId ?? hash;
      }
      // Each route owns its limiter store. Literal paths would let Express's
      // case-insensitive/trailing-slash aliases bypass the account limit.
      return digest(account);
    },
  });
}

export function authRouter(deps: Deps) {
  const router = Router();
  router.use(limits(deps));
  router.post(
    '/register',
    validate(registerBody),
    limits(deps, 'email'),
    endpoint(async (req, res) => {
      const body = registerBody.parse(req.body);
      const passwordHash = await hashPassword(body.password);
      try {
        const result = await deps.db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: body.email, passwordHash, displayName: body.displayName },
          });
          await tx.syncState.create({ data: { userId: user.id } });
          await seedDefaultCategories(tx, user.id);
          await accountMail(tx, deps.config, user, 'VERIFY_EMAIL');
          return newSession(tx, deps.config, user, body.installationId);
        });
        send(res, result, 201);
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
          throw new ApiError(409, 'REGISTRATION_FAILED', 'Unable to register with these details.');
        throw error;
      }
    }),
  );
  router.post(
    '/login',
    validate(loginBody),
    limits(deps, 'email'),
    endpoint(async (req, res) => {
      const body = loginBody.parse(req.body);
      const candidate = await deps.db.user.findUnique({ where: { email: body.email } });
      if (
        !(await checkPassword(candidate?.passwordHash, body.password)) ||
        !candidate ||
        candidate.status !== 'ACTIVE'
      )
        throw unauthorized();
      const result = await deps.db.$transaction(async (tx) => {
        const user = await lockUser(tx, candidate.id);
        if (user.passwordHash !== candidate.passwordHash) throw unauthorized();
        return newSession(tx, deps.config, user, body.installationId);
      });
      send(res, result);
    }),
  );
  router.post(
    '/refresh',
    validate(refreshBody),
    limits(deps, 'refresh'),
    endpoint(async (req, res) => {
      const body = refreshBody.parse(req.body);
      const hash = digest(body.refreshToken);
      const candidate = await deps.db.refreshCredential.findUnique({
        where: { tokenHash: hash },
        include: { session: true },
      });
      if (!candidate) throw unauthorized();
      const result = await deps.db.$transaction(async (tx) => {
        await lockUser(tx, candidate.session.userId);
        const session = await lockSession(tx, candidate.sessionId);
        const credential = await tx.refreshCredential.findUnique({ where: { tokenHash: hash } });
        const now = new Date();
        if (!session || !credential || session.revokedAt || session.familyExpiresAt <= now)
          return null;
        if (credential.consumedAt) {
          await tx.session.update({ where: { id: session.id }, data: { revokedAt: now } });
          return null; // Commit replay revocation before returning the HTTP error.
        }
        if (credential.expiresAt <= now) return null;
        await tx.refreshCredential.update({
          where: { id: credential.id },
          data: { consumedAt: now },
        });
        const refreshToken = opaqueToken();
        await tx.refreshCredential.create({
          data: {
            sessionId: session.id,
            parentId: credential.id,
            tokenHash: digest(refreshToken),
            expiresAt: session.familyExpiresAt,
          },
        });
        await tx.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
        return {
          accessToken: await accessToken(deps.config, session.userId, session.id),
          refreshToken,
          expiresIn: deps.config.accessTtlSeconds,
        };
      });
      if (!result) throw unauthorized();
      send(res, result);
    }),
  );
  router.post(
    '/logout',
    validate(refreshBody),
    limits(deps, 'refresh'),
    endpoint(async (req, res) => {
      const { refreshToken } = refreshBody.parse(req.body);
      const candidate = await deps.db.refreshCredential.findUnique({
        where: { tokenHash: digest(refreshToken) },
        include: { session: true },
      });
      if (!candidate) throw unauthorized();
      await deps.db.$transaction(async (tx) => {
        await lockUser(tx, candidate.session.userId);
        const session = await lockSession(tx, candidate.sessionId);
        if (!session || session.familyExpiresAt <= new Date() || candidate.expiresAt <= new Date())
          throw unauthorized();
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: session.revokedAt ?? new Date() },
        });
      });
      send(res, { revoked: true });
    }),
  );
  router.post(
    '/password/forgot',
    validate(forgotBody),
    limits(deps, 'email'),
    endpoint(async (req, res) => {
      const { email } = forgotBody.parse(req.body);
      const candidate = await deps.db.user.findUnique({ where: { email } });
      if (candidate?.status === 'ACTIVE')
        await deps.db.$transaction(async (tx) => {
          // A deletion racing this request must retain the same generic response.
          await tx.$queryRaw`SELECT "userId" FROM "SyncState" WHERE "userId" = ${candidate.id}::uuid FOR UPDATE`;
          const user = await tx.user.findUnique({ where: { id: candidate.id } });
          if (user?.status === 'ACTIVE') await accountMail(tx, deps.config, user, 'RESET_PASSWORD');
        });
      send(res, { message: 'If eligible, account instructions will be sent.' }, 202);
    }),
  );
  router.post(
    '/password/reset',
    validate(resetBody),
    limits(deps, 'reset'),
    endpoint(async (req, res) => {
      const body = resetBody.parse(req.body);
      const candidate = await deps.db.accountToken.findUnique({
        where: { tokenHash: digest(body.resetToken) },
      });
      if (!candidate || candidate.purpose !== 'RESET_PASSWORD') throw unauthorized();
      const passwordHash = await hashPassword(body.newPassword);
      await deps.db.$transaction(async (tx) => {
        await lockUser(tx, candidate.userId);
        const token = await tx.accountToken.findUnique({ where: { id: candidate.id } });
        const now = new Date();
        if (!token || token.consumedAt || token.expiresAt <= now) throw unauthorized();
        await tx.accountToken.updateMany({
          where: { userId: token.userId, purpose: 'RESET_PASSWORD', consumedAt: null },
          data: { consumedAt: now },
        });
        await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
        await tx.session.updateMany({
          where: { userId: token.userId, revokedAt: null },
          data: { revokedAt: now },
        });
      });
      send(res, { reset: true });
    }),
  );
  router.post(
    '/email/verify',
    validate(verifyBody),
    limits(deps, 'verify'),
    endpoint(async (req, res) => {
      const { verificationToken } = verifyBody.parse(req.body);
      const candidate = await deps.db.accountToken.findUnique({
        where: { tokenHash: digest(verificationToken) },
      });
      if (!candidate || candidate.purpose !== 'VERIFY_EMAIL') throw unauthorized();
      await deps.db.$transaction(async (tx) => {
        await lockUser(tx, candidate.userId);
        const token = await tx.accountToken.findUnique({ where: { id: candidate.id } });
        const now = new Date();
        if (!token || token.consumedAt || token.expiresAt <= now) throw unauthorized();
        await tx.accountToken.update({ where: { id: token.id }, data: { consumedAt: now } });
        await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now } });
      });
      send(res, { verified: true });
    }),
  );
  router.post(
    '/email/resend',
    authenticate(deps),
    limits(deps, 'principal'),
    endpoint(async (req, res) => {
      await deps.db.$transaction(async (tx) => {
        const user = await activePrincipal(tx, principal(req));
        if (!user.emailVerifiedAt) await accountMail(tx, deps.config, user, 'VERIFY_EMAIL');
      });
      send(res, { message: 'If eligible, account instructions will be sent.' }, 202);
    }),
  );
  router.post(
    '/logout-all',
    authenticate(deps),
    validate(reauthBody),
    limits(deps, 'principal'),
    endpoint(async (req, res) => {
      const { password } = reauthBody.parse(req.body);
      await deps.db.$transaction(async (tx) => {
        const user = await activePrincipal(tx, principal(req));
        if (!(await checkPassword(user.passwordHash, password))) throw unauthorized();
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
      send(res, { revoked: true });
    }),
  );
  return router;
}

export function profileRouter(deps: Deps) {
  const router = Router();
  router.get(
    '/me',
    endpoint(async (req, res) => {
      const user = await deps.db.user.findUnique({ where: { id: principal(req).userId } });
      if (!user || user.status !== 'ACTIVE') throw unauthorized();
      send(res, publicUser(user));
    }),
  );
  router.patch(
    '/me',
    endpoint(async (req, res) => {
      const { baseVersion, ...data } = profilePatch.parse(req.body);
      const user = await deps.db.$transaction(async (tx) => {
        const current = await activePrincipal(tx, principal(req));
        if (current.profileVersion !== baseVersion)
          throw new ApiError(409, 'VERSION_CONFLICT', 'This profile changed on another device.', {
            currentVersion: current.profileVersion,
          });
        return tx.user.update({
          where: { id: current.id },
          data: { ...data, profileVersion: { increment: 1 } },
        });
      });
      send(res, publicUser(user));
    }),
  );
  router.get(
    '/me/sessions',
    endpoint(async (req, res) => {
      const userId = principal(req).userId;
      const page = getPage(req, deps, userId, pagination.strict().parse(req.query), 'sessions');
      const rows = await deps.db.session.findMany({
        where: { userId, revokedAt: null, familyExpiresAt: { gt: new Date() } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.take,
        select: {
          id: true,
          installationId: true,
          createdAt: true,
          lastUsedAt: true,
          familyExpiresAt: true,
          revokedAt: true,
        },
      });
      sendPage(res, page.result(rows));
    }),
  );
  router.delete(
    '/me/sessions/:id',
    endpoint(async (req, res) => {
      const sessionId = id(req.params.id);
      await deps.db.$transaction(async (tx) => {
        const user = await activePrincipal(tx, principal(req));
        const owned = await tx.session.findFirst({ where: { id: sessionId, userId: user.id } });
        if (!owned) notFound();
        const session = await lockSession(tx, sessionId);
        if (!session || session.userId !== user.id) notFound();
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: session.revokedAt ?? new Date() },
        });
      });
      send(res, { revoked: true });
    }),
  );
  router.delete(
    '/me',
    limits(deps),
    validate(accountDeleteBody),
    limits(deps, 'principal'),
    endpoint(async (req, res) => {
      const { password } = accountDeleteBody.parse(req.body);
      await deps.db.$transaction(async (tx) => {
        const user = await activePrincipal(tx, principal(req));
        if (!(await checkPassword(user.passwordHash, password))) throw unauthorized();
        const now = new Date();
        await tx.user.update({ where: { id: user.id }, data: { status: 'DELETION_PENDING' } });
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.accountToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        });
        await tx.job.create({
          data: {
            userId: user.id,
            type: 'ACCOUNT_DELETE',
            payload: { userId: user.id },
            dedupeKey: `account-delete:${user.id}`,
          },
        });
      });
      send(res, { status: 'DELETION_PENDING' }, 202);
    }),
  );
  return router;
}
