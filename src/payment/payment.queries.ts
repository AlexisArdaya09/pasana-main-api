import { and, eq, isNull, SQL } from 'drizzle-orm';
import { payment } from '../database/schema';

/**
 * Matches the LIVE payment of a slot, i.e. one that has not been reverted.
 *
 * Reverted payments are soft-deleted, and the unique index on
 * (turn_id, participant_id) is partial on `deleted_at IS NULL`. Any query that
 * decides whether a slot is already paid MUST go through here: forgetting the
 * `deletedAt` filter makes a reverted slot look paid, which both blocks a new
 * charge and shows the participant as collected.
 *
 * @param participantMemberId group_member.id (the slot), not person.id
 */
export function livePaymentForSlot(
  turnId: string,
  participantMemberId: string,
): SQL | undefined {
  return and(
    eq(payment.turnId, turnId),
    eq(payment.participantId, participantMemberId),
    isNull(payment.deletedAt),
  );
}

/** Same as {@link livePaymentForSlot}, restricted to slots actually marked PAID. */
export function livePaidPaymentForSlot(
  turnId: string,
  participantMemberId: string,
): SQL | undefined {
  return and(
    livePaymentForSlot(turnId, participantMemberId),
    eq(payment.status, 'PAID'),
  );
}
