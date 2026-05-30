// Loads POSTGRES_* env for integration specs, mirroring
// config/register-database-url.ts. Paths are relative to apps/api (jest cwd):
// ../../infra/.env.dev holds the workspace Postgres credentials, ./.env any overrides.
import { config } from 'dotenv';

config({ path: '../../infra/.env.dev', quiet: true });
config({ quiet: true });
