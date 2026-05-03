ALTER TABLE "group" ADD COLUMN "participant_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "total_amount_per_turn" numeric(12, 2) NOT NULL DEFAULT '0';
