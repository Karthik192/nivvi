import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import supertest from 'supertest';
import pino from 'pino';
import express from 'express';
import { createApp } from '../src/app.js';
import { authenticate } from '../src/auth/index.js';
import { mutate, emit } from '../src/core/database.js';
import { endpoint, sendMutation } from '../src/core/http.js';
import { errorHandler } from '../src/core/errors.js';
import { api, db, config, newUser, closeDatabase, readMailJobs } from './helpers.js';

after(() => closeDatabase());
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const credentialsAbsent = (value: unknown) => {
  const json = JSON.stringify(value);
  assert.equal(/passwordHash|tokenHash|parentId|credentials/.test(json), false);
};

test('registration atomically creates defaults, digested credentials and encrypted verification mail', async () => {
  const email = `auth-${randomUUID()}@example.com`;
  const response = await api
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'Correct password 123!',
      displayName: 'Auth test',
      installationId: 'test-install',
    })
    .expect(201);
  const result = response.body.data;
  assert.equal(result.expiresIn, config.accessTtlSeconds);
  assert.equal(result.user.email, email);
  assert.equal(result.user.profileVersion, 1);
  credentialsAbsent(result.user);
  const user = await db.user.findUniqueOrThrow({ where: { id: result.user.id } });
  assert.ok(user.passwordHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$'));
  assert.ok(await argon2.verify(user.passwordHash, 'Correct password 123!'));
  assert.equal(await db.category.count({ where: { userId: user.id } }), 16);
  assert.equal(await db.changeEvent.count({ where: { userId: user.id } }), 16);
  const credential = await db.refreshCredential.findUniqueOrThrow({
    where: { tokenHash: digest(result.refreshToken) },
  });
  assert.notEqual(credential.tokenHash, result.refreshToken);
  const mails = await readMailJobs(user.id);
  const mail = mails.find((item) => item.purpose === 'VERIFY_EMAIL');
  assert.ok(mail);
  assert.equal(mail.to, email);
  const verification = await db.accountToken.findUniqueOrThrow({
    where: { tokenHash: digest(mail.token) },
  });
  assert.ok(verification.expiresAt.getTime() - Date.now() <= 15 * 60000);
  assert.ok(verification.expiresAt.getTime() - Date.now() > 14 * 60000);
  const jobs = await db.job.findMany({ where: { userId: user.id } });
  assert.equal(JSON.stringify(jobs).includes(mail.token), false);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${result.accessToken}`).expect(200);
});

test('strict validation rejects short passwords and profile mass assignment', async () => {
  const bad = await api
    .post('/api/v1/auth/register')
    .send({ email: `bad-${randomUUID()}@example.com`, password: 'short', displayName: 'Bad' });
  assert.ok([400, 422].includes(bad.status));
  const user = await newUser();
  const extra = await api
    .patch('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ baseVersion: 1, status: 'ADMIN' });
  assert.ok([400, 422].includes(extra.status));
  const tooLong = await api.post('/api/v1/auth/register').send({
    email: `bad-${randomUUID()}@example.com`,
    password: 'x'.repeat(129),
    displayName: 'Bad',
  });
  assert.ok([400, 422].includes(tooLong.status));
});

test('login failures and forgot responses are generic; inactive users cannot log in', async () => {
  const user = await newUser();
  const wrong = await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'incorrect', installationId: 'login' })
    .expect(401);
  const missing = await api
    .post('/api/v1/auth/login')
    .send({
      email: `missing-${randomUUID()}@example.com`,
      password: 'incorrect',
      installationId: 'login',
    })
    .expect(401);
  assert.deepEqual(wrong.body.error, missing.body.error);
  const exists = await api
    .post('/api/v1/auth/password/forgot')
    .send({ email: user.email })
    .expect(202);
  const absent = await api
    .post('/api/v1/auth/password/forgot')
    .send({ email: `missing-${randomUUID()}@example.com` })
    .expect(202);
  assert.deepEqual(exists.body.data, absent.body.data);
  assert.equal(JSON.stringify(exists.body).includes('resetToken'), false);
  await db.user.update({ where: { id: user.user.id }, data: { status: 'DELETION_PENDING' } });
  await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'login' })
    .expect(401);
});

test('refresh rotates once and replay commits revocation of the whole family', async () => {
  const user = await newUser();
  const otherFamily = await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'other-family' })
    .expect(200);
  const original = await db.refreshCredential.findUniqueOrThrow({
    where: { tokenHash: digest(user.refreshToken) },
    include: { session: true },
  });
  const rotated = await api
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: user.refreshToken })
    .expect(200);
  assert.notEqual(rotated.body.data.refreshToken, user.refreshToken);
  const child = await db.refreshCredential.findUniqueOrThrow({
    where: { tokenHash: digest(rotated.body.data.refreshToken) },
  });
  assert.equal(child.parentId, original.id);
  assert.equal(child.expiresAt.toISOString(), original.session.familyExpiresAt.toISOString());
  await api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
  const session = await db.session.findUniqueOrThrow({ where: { id: original.sessionId } });
  assert.ok(session.revokedAt);
  await api
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: rotated.body.data.refreshToken })
    .expect(401);
  await api
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${rotated.body.data.accessToken}`)
    .expect(401);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${user.accessToken}`).expect(401);
  await api
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${otherFamily.body.data.accessToken}`)
    .expect(200);
});

test('concurrent refresh attempts serialize and replay revokes the winning credential', async () => {
  const user = await newUser();
  const results = await Promise.all(
    [0, 1].map(() => api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken })),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  const winner = results.find((result) => result.status === 200);
  assert.ok(winner);
  await api
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: winner.body.data.refreshToken })
    .expect(401);
});

test('refresh remains independent of expired bearer tokens and rejects expired credentials', async () => {
  const user = await newUser();
  const original = await db.refreshCredential.findUniqueOrThrow({
    where: { tokenHash: digest(user.refreshToken) },
  });
  const expiredBearer = await new SignJWT({ sid: original.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.user.id)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
    .sign(new TextEncoder().encode(config.accessSecret));
  const rotated = await api
    .post('/api/v1/auth/refresh')
    .set('Authorization', `Bearer ${expiredBearer}`)
    .send({ refreshToken: user.refreshToken })
    .expect(200);
  await db.refreshCredential.update({
    where: { tokenHash: digest(rotated.body.data.refreshToken) },
    data: { expiresAt: new Date(0) },
  });
  await api
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: rotated.body.data.refreshToken })
    .expect(401);
});

test('reset consumes its token once, changes password and revokes every session', async () => {
  const user = await newUser();
  const second = await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'second' })
    .expect(200);
  await api.post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(202);
  const mail = (await readMailJobs(user.user.id)).find((item) => item.purpose === 'RESET_PASSWORD');
  assert.ok(mail);
  const resetCredential = await db.accountToken.findUniqueOrThrow({
    where: { tokenHash: digest(mail.token) },
  });
  assert.ok(resetCredential.expiresAt.getTime() - Date.now() <= 15 * 60000);
  assert.ok(resetCredential.expiresAt.getTime() - Date.now() > 14 * 60000);
  const newPassword = 'Replacement password 456!';
  const reset = await api
    .post('/api/v1/auth/password/reset')
    .send({ resetToken: mail.token, newPassword })
    .expect(200);
  assert.equal('accessToken' in reset.body.data, false);
  await api
    .post('/api/v1/auth/password/reset')
    .send({ resetToken: mail.token, newPassword })
    .expect(401);
  for (const accessToken of [user.accessToken, second.body.data.accessToken]) {
    await api.get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
  }
  for (const refreshToken of [user.refreshToken, second.body.data.refreshToken]) {
    await api.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  }
  await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'old' })
    .expect(401);
  await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: newPassword, installationId: 'new' })
    .expect(200);
  assert.equal(await db.session.count({ where: { userId: user.user.id, revokedAt: null } }), 1);
});

test('expired and purpose-confused account credentials are rejected', async () => {
  const user = await newUser();
  const mail = (await readMailJobs(user.user.id)).find((item) => item.purpose === 'VERIFY_EMAIL');
  assert.ok(mail);
  await api
    .post('/api/v1/auth/password/reset')
    .send({ resetToken: mail.token, newPassword: 'Replacement password 456!' })
    .expect(401);
  await db.accountToken.update({
    where: { tokenHash: digest(mail.token) },
    data: { expiresAt: new Date(0) },
  });
  await api.post('/api/v1/auth/email/verify').send({ verificationToken: mail.token }).expect(401);
  await api.post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(202);
  const resetMail = (await readMailJobs(user.user.id)).find(
    (item) => item.purpose === 'RESET_PASSWORD',
  );
  assert.ok(resetMail);
  await api
    .post('/api/v1/auth/email/verify')
    .send({ verificationToken: resetMail.token })
    .expect(401);
  await db.accountToken.update({
    where: { tokenHash: digest(resetMail.token) },
    data: { expiresAt: new Date(0) },
  });
  await api
    .post('/api/v1/auth/password/reset')
    .send({ resetToken: resetMail.token, newPassword: 'Replacement password 456!' })
    .expect(401);
});

test('concurrent reset and refresh cannot leave an active family', async () => {
  const user = await newUser();
  await api.post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(202);
  const mail = (await readMailJobs(user.user.id)).find((item) => item.purpose === 'RESET_PASSWORD');
  assert.ok(mail);
  const [reset, refresh] = await Promise.all([
    api
      .post('/api/v1/auth/password/reset')
      .send({ resetToken: mail.token, newPassword: 'Concurrent replacement 456!' }),
    api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }),
  ]);
  assert.equal(reset.status, 200);
  assert.ok([200, 401].includes(refresh.status));
  assert.equal(await db.session.count({ where: { userId: user.user.id, revokedAt: null } }), 0);
  if (refresh.status === 200) {
    await api
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${refresh.body.data.accessToken}`)
      .expect(401);
    await api
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh.body.data.refreshToken })
      .expect(401);
  }
});

test('concurrent reset attempts consume the account token exactly once', async () => {
  const user = await newUser();
  await api.post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(202);
  const mail = (await readMailJobs(user.user.id)).find((item) => item.purpose === 'RESET_PASSWORD');
  assert.ok(mail);
  const results = await Promise.all(
    [0, 1].map((index) =>
      api
        .post('/api/v1/auth/password/reset')
        .send({ resetToken: mail.token, newPassword: `Concurrent replacement ${index}!` }),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  assert.equal(await db.session.count({ where: { userId: user.user.id, revokedAt: null } }), 0);
});

test('email verification is one-time and resend replaces the previous token', async () => {
  const user = await newUser();
  const original = (await readMailJobs(user.user.id)).find(
    (item) => item.purpose === 'VERIFY_EMAIL',
  );
  assert.ok(original);
  await api
    .post('/api/v1/auth/email/resend')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({})
    .expect(202);
  const mails = await readMailJobs(user.user.id);
  const replacement = mails.find(
    (item) => item.purpose === 'VERIFY_EMAIL' && item.token !== original.token,
  );
  assert.ok(replacement);
  await api
    .post('/api/v1/auth/email/verify')
    .send({ verificationToken: original.token })
    .expect(401);
  await api
    .post('/api/v1/auth/email/verify')
    .send({ verificationToken: replacement.token })
    .expect(200);
  await api
    .post('/api/v1/auth/email/verify')
    .send({ verificationToken: replacement.token })
    .expect(401);
  const me = await api
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200);
  assert.ok(me.body.data.emailVerifiedAt);
});

test('profile edits use profileVersion and expose only public fields', async () => {
  const user = await newUser();
  const updated = await api
    .patch('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ baseVersion: 1, displayName: 'Updated', theme: 'dark', timezone: 'UTC' })
    .expect(200);
  assert.equal(updated.body.data.profileVersion, 2);
  assert.equal(updated.body.data.timezone, 'UTC');
  credentialsAbsent(updated.body);
  await api
    .patch('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ baseVersion: 1, displayName: 'Stale' })
    .expect(409);
  const concurrent = await Promise.all(
    ['First', 'Second'].map((displayName) =>
      api
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ baseVersion: 2, displayName }),
    ),
  );
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
});

test('session pagination stays owner-bound and never returns credential material', async () => {
  const user = await newUser();
  const foreign = await newUser();
  await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'second' })
    .expect(200);
  const first = await api
    .get('/api/v1/me/sessions?limit=1')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200);
  assert.equal(first.body.data.length, 1);
  assert.equal(first.body.page.hasMore, true);
  assert.ok(first.body.page.nextCursor);
  const cursor: string = first.body.page.nextCursor;
  const second = await api
    .get('/api/v1/me/sessions')
    .query({ limit: 1, cursor })
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200);
  assert.equal(second.body.data.length, 1);
  assert.notEqual(first.body.data[0].id, second.body.data[0].id);
  assert.equal(second.body.page.hasMore, false);
  credentialsAbsent(first.body);
  credentialsAbsent(second.body);
  await api
    .get('/api/v1/me/sessions')
    .query({ limit: 1, cursor })
    .set('Authorization', `Bearer ${foreign.accessToken}`)
    .expect(400);
});

test('foreign sessions are isolated; revoking an owned session invalidates its bearer token', async () => {
  const owner = await newUser();
  const foreign = await newUser();
  const sessions = await api
    .get('/api/v1/me/sessions')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .expect(200);
  assert.equal(sessions.body.data.length, 1);
  assert.equal(sessions.body.page.hasMore, false);
  credentialsAbsent(sessions.body);
  const sessionId: string = sessions.body.data[0].id;
  await api
    .delete(`/api/v1/me/sessions/${sessionId}`)
    .set('Authorization', `Bearer ${foreign.accessToken}`)
    .expect(404);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${owner.accessToken}`).expect(200);
  await api
    .delete(`/api/v1/me/sessions/${sessionId}`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .expect(200);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${owner.accessToken}`).expect(401);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${foreign.accessToken}`).expect(200);
});

test('logout revokes its family; logout-all requires password and revokes all families', async () => {
  const user = await newUser();
  const second = await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'second' })
    .expect(200);
  await api.post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken }).expect(200);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${user.accessToken}`).expect(401);
  await api
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${second.body.data.accessToken}`)
    .expect(200);
  await api
    .post('/api/v1/auth/logout-all')
    .set('Authorization', `Bearer ${second.body.data.accessToken}`)
    .send({ password: 'wrong' })
    .expect(401);
  await api
    .post('/api/v1/auth/logout-all')
    .set('Authorization', `Bearer ${second.body.data.accessToken}`)
    .send({ password: user.password })
    .expect(200);
  await api
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${second.body.data.accessToken}`)
    .expect(401);
  assert.equal(await db.session.count({ where: { userId: user.user.id, revokedAt: null } }), 0);
});

test('account deletion requires confirmation and password, queues retention workflow and revokes access', async () => {
  const user = await newUser();
  const invalid = await api
    .delete('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ password: user.password, confirmation: 'yes' });
  assert.ok([400, 422].includes(invalid.status));
  await api
    .delete('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ password: 'wrong', confirmation: 'DELETE MY ACCOUNT' })
    .expect(401);
  const second = await api
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password, installationId: 'second' })
    .expect(200);
  await api
    .delete('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ password: user.password, confirmation: 'DELETE MY ACCOUNT' })
    .expect(202);
  const stored = await db.user.findUniqueOrThrow({ where: { id: user.user.id } });
  assert.equal(stored.status, 'DELETION_PENDING');
  assert.equal(await db.job.count({ where: { userId: user.user.id, type: 'ACCOUNT_DELETE' } }), 1);
  assert.equal(await db.category.count({ where: { userId: user.user.id } }), 16);
  for (const accessToken of [user.accessToken, second.body.data.accessToken])
    await api.get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
  for (const refreshToken of [user.refreshToken, second.body.data.refreshToken])
    await api.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
});

test('bearer validation enforces expiry, issuer, audience and live database session', async () => {
  const user = await newUser();
  const credential = await db.refreshCredential.findUniqueOrThrow({
    where: { tokenHash: digest(user.refreshToken) },
  });
  await api.get('/api/v1/me').expect(401);
  await api.get('/api/v1/me').set('Authorization', 'Bearer malformed').expect(401);
  const key = new TextEncoder().encode(config.accessSecret);
  const invalidClaims: Array<{ issuer?: string; audience?: string; expires?: number }> = [
    { issuer: 'foreign' },
    { audience: 'foreign' },
    { expires: -60 },
  ];
  for (const overrides of invalidClaims) {
    const token = await new SignJWT({ sid: credential.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.user.id)
      .setIssuer(overrides.issuer ?? config.issuer)
      .setAudience(overrides.audience ?? config.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + (overrides.expires ?? 600))
      .sign(key);
    await api.get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
  }
  for (const claims of [
    { sub: user.user.id as string, sid: credential.sessionId, alg: 'HS384', key },
    {
      sub: user.user.id as string,
      sid: credential.sessionId,
      alg: 'HS256',
      key: new TextEncoder().encode('different-signing-secret-at-least-32-characters'),
    },
    { sub: user.user.id as string, sid: randomUUID(), alg: 'HS256', key },
    { sub: randomUUID(), sid: credential.sessionId, alg: 'HS256', key },
  ]) {
    const token = await new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: claims.alg })
      .setSubject(claims.sub)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(claims.key);
    await api.get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
  }
  await db.session.update({
    where: { id: credential.sessionId },
    data: { familyExpiresAt: new Date(0) },
  });
  await api.get('/api/v1/me').set('Authorization', `Bearer ${user.accessToken}`).expect(401);
  await api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
});

test('normalized account throttling blocks login and reset requests while preserving other accounts', async () => {
  // Enable the actual production-path limiters while retaining the dedicated test database and file mail.
  for (const route of ['/login', '/password/forgot']) {
    const limited = supertest(
      createApp({
        db,
        config: { ...config, env: 'development' },
        logger: pino({ level: 'silent' }),
      }),
    );
    const email = `throttle-${randomUUID()}@example.test`;
    const invalidBody =
      route === '/login'
        ? { email, password: 123, installationId: 'test' }
        : { email, userId: randomUUID() };
    for (let index = 0; index < 3; index++)
      await limited.post(`/api/v1/auth${route}`).send(invalidBody).expect(400);
    for (let index = 0; index < 10; index++) {
      const normalizedVariant = index % 2 === 0 ? email : email.toUpperCase();
      const body =
        route === '/login'
          ? { email: normalizedVariant, password: 'Wrong password 123!', installationId: 'test' }
          : { email: normalizedVariant };
      await limited
        .post(`/api/v1/auth${route}`)
        .send(body)
        .expect(route === '/login' ? 401 : 202);
    }
    const blockedBody =
      route === '/login'
        ? { email, password: 'Wrong password 123!', installationId: 'test' }
        : { email };
    // Express routes accept these aliases; all must share the account bucket.
    const alias = route === '/login' ? '/LOGIN/' : '/PASSWORD/FORGOT/';
    const blocked = await limited.post(`/api/v1/auth${alias}`).send(blockedBody).expect(429);
    assert.ok(blocked.headers['retry-after']);
    const otherEmail = `other-${randomUUID()}@example.test`;
    const otherBody =
      route === '/login'
        ? { email: otherEmail, password: 'Wrong password 123!', installationId: 'test' }
        : { email: otherEmail };
    await limited
      .post(`/api/v1/auth${route}`)
      .send(otherBody)
      .expect(route === '/login' ? 401 : 202);
  }
});

test('IP throttling bounds attempts across different reset accounts', async () => {
  const limited = supertest(
    createApp({ db, config: { ...config, env: 'development' }, logger: pino({ level: 'silent' }) }),
  );
  for (let index = 0; index < 30; index++) {
    await limited
      .post('/api/v1/auth/password/forgot')
      .send({ email: `ip-${randomUUID()}@example.test` })
      .expect(202);
  }
  const blocked = await limited
    .post('/api/v1/auth/password/forgot')
    .send({ email: `ip-${randomUUID()}@example.test` })
    .expect(429);
  assert.ok(blocked.headers['retry-after']);
});

test('a request authenticated before logout cannot mutate after revocation commits', async () => {
  const user = await newUser();
  const category = await db.category.findFirstOrThrow({ where: { userId: user.user.id } });
  const deps = { db, config, logger: pino({ level: 'silent' }) };
  let reached!: () => void;
  let release!: () => void;
  const authenticated = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const proceed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const probe = express();
  probe.use(express.json());
  probe.use((req, _res, next) => {
    req.requestId = randomUUID();
    next();
  });
  probe.post(
    '/probe',
    authenticate(deps),
    endpoint(async (req, res) => {
      reached();
      await proceed;
      sendMutation(
        res,
        await mutate(req, deps, async (tx, userId) => {
          const row = await tx.category.update({
            where: { userId_id: { userId, id: category.id } },
            data: {
              name: 'Revoked request',
              normalizedName: 'revoked request',
              version: { increment: 1 },
            },
          });
          await emit(tx, userId, 'category', row);
          return { data: row, entityId: row.id };
        }),
      );
    }),
  );
  probe.use(errorHandler(deps));
  const operationId = randomUUID();
  const pending = supertest(probe)
    .post('/probe')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .set('Idempotency-Key', operationId)
    .send({})
    .then((response) => response);
  try {
    await authenticated;
    await api.post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken }).expect(200);
  } finally {
    release();
  }
  const response = await pending;
  assert.equal(response.status, 401);
  const unchanged = await db.category.findUniqueOrThrow({ where: { id: category.id } });
  assert.equal(unchanged.version, category.version);
  assert.equal(await db.mutationReceipt.count({ where: { userId: user.user.id, operationId } }), 0);
});

test('logout racing refresh leaves no usable credential in that family', async () => {
  const user = await newUser();
  const [logout, refresh] = await Promise.all([
    api.post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken }),
    api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }),
  ]);
  assert.equal(logout.status, 200);
  assert.ok([200, 401].includes(refresh.status));
  await api.get('/api/v1/me').set('Authorization', `Bearer ${user.accessToken}`).expect(401);
  if (refresh.status === 200) {
    await api
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${refresh.body.data.accessToken}`)
      .expect(401);
    await api
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh.body.data.refreshToken })
      .expect(401);
  }
});

test('concurrent email verification consumes the token once', async () => {
  const user = await newUser();
  const mail = (await readMailJobs(user.user.id)).find((item) => item.purpose === 'VERIFY_EMAIL');
  assert.ok(mail);
  const responses = await Promise.all(
    [0, 1].map(() => api.post('/api/v1/auth/email/verify').send({ verificationToken: mail.token })),
  );
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 401]);
});

test('deletion consumes pending mail credentials and leaves other accounts active', async () => {
  const user = await newUser();
  const foreign = await newUser();
  await api.post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(202);
  const mail = await readMailJobs(user.user.id);
  const verify = mail.find((item) => item.purpose === 'VERIFY_EMAIL');
  const reset = mail.find((item) => item.purpose === 'RESET_PASSWORD');
  assert.ok(verify);
  assert.ok(reset);
  await api
    .delete('/api/v1/me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ password: user.password, confirmation: 'DELETE MY ACCOUNT' })
    .expect(202);
  assert.equal(
    await db.accountToken.count({ where: { userId: user.user.id, consumedAt: null } }),
    0,
  );
  await api.post('/api/v1/auth/email/verify').send({ verificationToken: verify.token }).expect(401);
  await api
    .post('/api/v1/auth/password/reset')
    .send({ resetToken: reset.token, newPassword: 'Replacement password 456!' })
    .expect(401);
  await api.get('/api/v1/me').set('Authorization', `Bearer ${foreign.accessToken}`).expect(200);
});
