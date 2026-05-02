import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrations = async () => {
  const user = encodeURIComponent(process.env.DB_USER!);
  const password = encodeURIComponent(process.env.DB_PASSWORD!);
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;

  const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('Starting database migrations...');
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  console.log('Migrations completed successfully');

  await sql.end();
};

runMigrations().catch((err) => {
  console.error('Migration process failed', err);
  process.exit(1);
});
