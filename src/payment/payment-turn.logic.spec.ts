import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { fakeDb } from '../common/testing/drizzle-mock';
import { resolvePayableTurn } from './payment-turn.logic';

type Tx = Pick<NodePgDatabase, 'select' | 'update'>;

const activeTurn = {
  id: 'turn-active',
  groupId: 'group-1',
  status: 'ACTIVE',
  turnNumber: 3,
  totalPaidAmount: '0.00',
  totalExpectedAmount: '500.00',
};

const nextPendingTurn = {
  ...activeTurn,
  id: 'turn-next',
  status: 'PENDING',
  turnNumber: 4,
};

describe('resolvePayableTurn', () => {
  it('treats the ACTIVE turn as a normal collection', async () => {
    const db = fakeDb([[activeTurn]]);

    const result = await resolvePayableTurn(db as unknown as Tx, 'turn-active');

    expect(result.mode).toBe('active');
    expect(result.target.id).toBe('turn-active');
  });

  it('treats the immediately next PENDING turn as an advance', async () => {
    // lookup target -> lookup active turn -> lookup next pending turn
    const db = fakeDb([[nextPendingTurn], [activeTurn], [nextPendingTurn]]);

    const result = await resolvePayableTurn(db as unknown as Tx, 'turn-next');

    expect(result.mode).toBe('advance');
    expect(result.target.id).toBe('turn-next');
    expect(result.activeTurn.id).toBe('turn-active');
  });

  it('rejects a COMPLETED turn: reverting it would need a queue rollback', async () => {
    const db = fakeDb([[{ ...activeTurn, status: 'COMPLETED' }]]);

    await expect(
      resolvePayableTurn(db as unknown as Tx, 'turn-active'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a PENDING turn that is not the immediate next one', async () => {
    const laterTurn = { ...nextPendingTurn, id: 'turn-later', turnNumber: 7 };
    // target -> active -> next pending is a DIFFERENT turn
    const db = fakeDb([[laterTurn], [activeTurn], [nextPendingTurn]]);

    await expect(
      resolvePayableTurn(db as unknown as Tx, 'turn-later'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an advance when the group has no ACTIVE turn', async () => {
    const db = fakeDb([[nextPendingTurn], []]);

    await expect(
      resolvePayableTurn(db as unknown as Tx, 'turn-next'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown turn id', async () => {
    const db = fakeDb([[]]);

    await expect(
      resolvePayableTurn(db as unknown as Tx, 'nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
