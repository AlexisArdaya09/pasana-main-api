import type { Config } from 'drizzle-kit';

export default {
  out: './src/database/migrations',
  schema: './src/database/schema/**/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: false,
  },
  migrations: {
    table: 'migrations',
  },
} satisfies Config;
