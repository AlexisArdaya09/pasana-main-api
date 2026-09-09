import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as bcrypt from 'bcrypt';
import { userAccount } from './schema';

const BCRYPT_ROUNDS = 12;

/**
 * Creates the super admin account if it does not exist yet.
 *
 * Idempotent: running it again on an existing account only makes sure the role
 * is SUPER_ADMIN and the account is active. It never overwrites an existing
 * password — rotate that from the app, not by re-running the seed.
 */
async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const username = process.env.SUPER_ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set to seed the super admin',
    );
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const db = drizzle(pool);

  const [existing] = await db
    .select()
    .from(userAccount)
    .where(eq(userAccount.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(userAccount)
      .set({ role: 'SUPER_ADMIN', isActive: true, updatedAt: new Date() })
      .where(eq(userAccount.id, existing.id));
    console.log(`Super admin already exists (${email}) — role and status ensured.`);
    await pool.end();
    return;
  }

  const now = new Date();
  await db.insert(userAccount).values({
    id: createId(),
    username,
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: 'SUPER_ADMIN',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Super admin created: ${email}`);
  await pool.end();
}

seedSuperAdmin().catch((err) => {
  console.error('Super admin seed failed:', err.message);
  process.exit(1);
});
