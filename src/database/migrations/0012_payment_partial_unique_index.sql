-- One LIVE payment per (turn, participant). Making the unique index partial lets a
-- reverted (soft-deleted) payment free the slot so it can be charged again.
DROP INDEX IF EXISTS "uq_payment_turn_participant";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_turn_participant"
  ON "payment" USING btree ("turn_id","participant_id")
  WHERE "payment"."deleted_at" IS NULL;
