import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const runFixData = async () => {
  const user = encodeURIComponent(process.env.DB_USER!);
  const password = encodeURIComponent(process.env.DB_PASSWORD!);
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;

  const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

  const scriptPath = join(__dirname, 'scripts', 'fix-pasanaco-data.sql');
  const script = readFileSync(scriptPath, 'utf8');

  console.log('Running fix-pasanaco-data.sql...');
  await sql.unsafe(script);
  console.log('Data fix completed successfully.');

  await sql.end();
};

runFixData().catch((err) => {
  console.error('Data fix failed', err);
  process.exit(1);
});
