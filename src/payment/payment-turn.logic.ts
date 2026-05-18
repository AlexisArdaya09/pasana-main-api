import { BadRequestException, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { group, turn } from '../database/schema';

type DbTx = Pick<NodePgDatabase, 'select' | 'update'>;

export type TurnRow = typeof turn.$inferSelect;

export type PayableTurnContext =
  | { mode: 'active'; target: TurnRow; activeTurn: TurnRow }
  | { mode: 'advance'; target: TurnRow; activeTurn: TurnRow };

export async function getActiveTurn(
  tx: DbTx,
  groupId: string,
  forUpdate = false,
): Promise<TurnRow | null> {
  const q = tx
    .select()
    .from(turn)
    .where(
      and(eq(turn.groupId, groupId), eq(turn.status, 'ACTIVE'), isNull(turn.deletedAt)),
    )
    .limit(1);

  const [row] = forUpdate ? await q.for('update') : await q;
  return row ?? null;
}

export async function getNextPendingTurn(
  tx: DbTx,
  groupId: string,
  forUpdate = false,
): Promise<TurnRow | null> {
  const q = tx
    .select()
    .from(turn)
    .where(
      and(eq(turn.groupId, groupId), eq(turn.status, 'PENDING'), isNull(turn.deletedAt)),
    )
    .orderBy(asc(turn.scheduledDate), asc(turn.turnNumber))
    .limit(1);

  const [row] = forUpdate ? await q.for('update') : await q;
  return row ?? null;
}

/** Resolves whether turnId is the ACTIVE turn or the immediately next PENDING turn. */
export async function resolvePayableTurn(
  tx: DbTx,
  turnId: string,
): Promise<PayableTurnContext> {
  const [target] = await tx
    .select()
    .from(turn)
    .where(and(eq(turn.id, turnId), isNull(turn.deletedAt)))
    .for('update')
    .limit(1);

  if (!target) {
    throw new NotFoundException(`Turn ${turnId} not found`);
  }

  if (target.status === 'ACTIVE') {
    return { mode: 'active', target, activeTurn: target };
  }

  if (target.status === 'PENDING') {
    const activeTurn = await getActiveTurn(tx, target.groupId, true);
    if (!activeTurn) {
      throw new BadRequestException(
        'Advance payments require an ACTIVE turn in the same group',
      );
    }

    const nextPending = await getNextPendingTurn(tx, target.groupId);
    if (!nextPending || nextPending.id !== target.id) {
      throw new BadRequestException(
        'Advance payment is only allowed for the immediately next PENDING turn',
      );
    }

    if (target.turnNumber <= activeTurn.turnNumber) {
      throw new BadRequestException(
        'Advance payment target must follow the active turn in sequence',
      );
    }

    return { mode: 'advance', target, activeTurn };
  }

  throw new BadRequestException(
    `Turn is ${target.status}. Payments are only allowed on ACTIVE or the next PENDING turn`,
  );
}

export interface TurnCompletionResult {
  nextTurnActivated: boolean;
  groupCompleted: boolean;
}

/**
 * After an ACTIVE turn is fully paid, complete it and activate the next turn(s)
 * that were already fully paid via advance payments.
 */
export async function completeActiveTurnAndAdvanceQueue(
  tx: DbTx & { update: NodePgDatabase['update'] },
  activeTurnId: string,
  groupId: string,
  now: Date,
): Promise<TurnCompletionResult> {
  let nextTurnActivated = false;
  let groupCompleted = false;

  let currentActiveId: string | null = activeTurnId;

  while (currentActiveId) {
    const [active] = await tx
      .select()
      .from(turn)
      .where(and(eq(turn.id, currentActiveId), isNull(turn.deletedAt)))
      .for('update')
      .limit(1);

    if (!active || active.status !== 'ACTIVE') break;

    const expected = parseFloat(active.totalExpectedAmount);
    const paid = parseFloat(active.totalPaidAmount);
    if (paid < expected) break;

    await tx
      .update(turn)
      .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
      .where(eq(turn.id, active.id));

    const next = await getNextPendingTurn(tx, groupId, true);
    if (!next) {
      await tx
        .update(group)
        .set({ status: 'COMPLETED', updatedAt: now })
        .where(eq(group.id, groupId));
      groupCompleted = true;
      currentActiveId = null;
      break;
    }

    await tx
      .update(turn)
      .set({ status: 'ACTIVE', updatedAt: now })
      .where(eq(turn.id, next.id));

    nextTurnActivated = true;
    currentActiveId = next.id;
  }

  return { nextTurnActivated, groupCompleted };
}
