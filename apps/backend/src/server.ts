import pino from 'pino';
import { createApp } from './app.js';
import { readConfig } from './core/config.js';
import { createDatabase } from './core/database.js';
const config = readConfig(process.env);
const logger = pino({
  level: 'info',
  redact: [
    'password',
    'token',
    'authorization',
    'databaseUrl',
    'smtpUrl',
    'accessSecret',
    'jobEncryptionKey',
  ],
});
const db = createDatabase(config.databaseUrl);
await db.$connect();
const server = createApp({ db, config, logger }).listen(config.port, config.host, () =>
  logger.info({ event: 'server_started', port: config.port }),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await db.$disconnect();
    process.exitCode = 0;
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
