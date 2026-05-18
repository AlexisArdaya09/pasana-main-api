DROP INDEX IF EXISTS "uq_group_member_person";--> statement-breakpoint
ALTER TABLE "group_member" ADD COLUMN IF NOT EXISTS "custom_date" date;
