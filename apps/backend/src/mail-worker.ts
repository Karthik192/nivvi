import pino from 'pino';
import { readConfig } from './core/config.js';
import { createDatabase } from './core/database.js';
import { workOneMail } from './core/mail.js';
const config = readConfig(process.env);
const db = createDatabase(config.databaseUrl);
const logger = pino();
try {
  await workOneMail({ db, config, logger });
} finally {
  await db.$disconnect();
}
