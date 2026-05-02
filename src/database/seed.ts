import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const runSeed = async () => {
  const user = encodeURIComponent(process.env.DB_USER!);
  const password = encodeURIComponent(process.env.DB_PASSWORD!);
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;

  const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('Running seed...');

  // Add seed data here
  void db;

  console.log('Seed completed');
  await sql.end();
};

runSeed().catch((err) => {
  console.error('Seed process failed', err);
  process.exit(1);
});
