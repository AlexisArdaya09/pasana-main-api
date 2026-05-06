DROP INDEX IF EXISTS "uq_group_member_person";--> statement-breakpoint
ALTER TABLE "group_member" ADD COLUMN "custom_birthday" date;
