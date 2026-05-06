-- Change payment.participant_id to reference group_member(id) instead of person(id)
-- This allows a person with multiple slots to pay once per slot per turn.
ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_participant_id_person_id_fk";--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_participant_id_group_member_id_fk"
  FOREIGN KEY ("participant_id") REFERENCES "group_member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
