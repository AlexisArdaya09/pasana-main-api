CREATE TYPE "payment_method" AS ENUM('CASH', 'QR');--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "method" "payment_method" NOT NULL DEFAULT 'CASH';--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "method" DROP DEFAULT;
