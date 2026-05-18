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
  const sql = postgres(connectionString, {
    max: 1,
    onnotice: () => {
      // Ignora NOTICE de "schema already exists" — no son errores
    },
  });
  const db = drizzle(sql);

  const before = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations
  `;

  console.log('Starting database migrations...');
  await migrate(db, { migrationsFolder: './src/database/migrations' });

  const after = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations
  `;

  const applied = Number(after[0].count) - Number(before[0].count);
  console.log(
    applied > 0
      ? `Migrations completed: ${applied} new migration(s) applied (${after[0].count} total).`
      : `Migrations completed: no pending migrations (${after[0].count} total in journal).`,
  );

  await sql.end();
};

runMigrations().catch((err) => {
  console.error('Migration process failed', err);
  process.exit(1);
});
