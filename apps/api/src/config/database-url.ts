const DEFAULT_POSTGRES_HOST = 'localhost';
const DEFAULT_POSTGRES_PORT = '5432';
const DEFAULT_POSTGRES_SCHEMA = 'public';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function getDatabaseUrl(): string {
  const host = process.env.POSTGRES_HOST ?? DEFAULT_POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT ?? DEFAULT_POSTGRES_PORT;
  const database = getRequiredEnv('POSTGRES_DB');
  const user = getRequiredEnv('POSTGRES_USER');
  const password = getRequiredEnv('POSTGRES_PASSWORD');
  const schema = process.env.POSTGRES_SCHEMA ?? DEFAULT_POSTGRES_SCHEMA;

  const username = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);
  const encodedSchema = encodeURIComponent(schema);

  return `postgresql://${username}:${encodedPassword}@${host}:${port}/${encodedDatabase}?schema=${encodedSchema}`;
}
