DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE "payment_method" AS ENUM('CASH', 'QR');
  END IF;
END $do$;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "method" "payment_method" NOT NULL DEFAULT 'CASH';--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "method" DROP DEFAULT;
