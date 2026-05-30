import { config } from 'dotenv';
import { getDatabaseUrl } from './database-url';

config({ path: '../../infra/.env.dev' });
config();

process.env.DATABASE_URL = getDatabaseUrl();
