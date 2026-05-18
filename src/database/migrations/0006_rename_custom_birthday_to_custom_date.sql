DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'group_member' AND column_name = 'custom_birthday'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'group_member' AND column_name = 'custom_date'
  ) THEN
    ALTER TABLE "group_member" RENAME COLUMN "custom_birthday" TO "custom_date";
  END IF;
END $do$;--> statement-breakpoint
ALTER TABLE "group_member" DROP COLUMN IF EXISTS "custom_birthday";
