DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_date_strategy') THEN
    CREATE TYPE "delivery_date_strategy" AS ENUM('SAME_DAY', 'DAYS_BEFORE');
  END IF;
END $do$;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN IF NOT EXISTS "delivery_date_strategy" "delivery_date_strategy" DEFAULT 'SAME_DAY';--> statement-breakpoint
UPDATE "group" SET "delivery_date_strategy" = 'SAME_DAY' WHERE "delivery_date_strategy" IS NULL;--> statement-breakpoint
ALTER TABLE "group" ALTER COLUMN "delivery_date_strategy" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN IF NOT EXISTS "delivery_days_before" integer;--> statement-breakpoint
ALTER TABLE "turn" ADD COLUMN IF NOT EXISTS "delivery_date" date;--> statement-breakpoint
UPDATE "turn" SET "delivery_date" = "scheduled_date" WHERE "delivery_date" IS NULL;--> statement-breakpoint
ALTER TABLE "turn" ALTER COLUMN "delivery_date" SET NOT NULL;
