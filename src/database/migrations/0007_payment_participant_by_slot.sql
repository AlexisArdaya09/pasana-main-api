ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_participant_id_person_id_fk";--> statement-breakpoint
DO $do$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_participant_id_group_member_id_fk'
  ) THEN
    ALTER TABLE "payment" ADD CONSTRAINT "payment_participant_id_group_member_id_fk"
      FOREIGN KEY ("participant_id") REFERENCES "group_member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $do$;
