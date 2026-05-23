import { config } from 'dotenv';
import { getDatabaseUrl } from './database-url';

config({ path: '../../.env' });
config();

process.env.DATABASE_URL = getDatabaseUrl();
