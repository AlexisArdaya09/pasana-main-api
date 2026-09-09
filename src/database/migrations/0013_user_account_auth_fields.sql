DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE "user_role" AS ENUM('SUPER_ADMIN', 'ADMIN');
  END IF;
END $do$;--> statement-breakpoint
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "google_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'ADMIN';--> statement-breakpoint
UPDATE "user_account" SET "role" = 'ADMIN' WHERE "role" IS NULL;--> statement-breakpoint
ALTER TABLE "user_account" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;--> statement-breakpoint
UPDATE "user_account" SET "is_active" = true WHERE "is_active" IS NULL;--> statement-breakpoint
ALTER TABLE "user_account" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
-- Google-only accounts have no local password.
ALTER TABLE "user_account" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_account_google_id"
  ON "user_account" USING btree ("google_id")
  WHERE "google_id" IS NOT NULL;
