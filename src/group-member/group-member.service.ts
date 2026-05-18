import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, isNull, max } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import { group, groupMember, person, turn } from '../database/schema';
import { AddMemberDto } from './dto/add-member.dto';
import { ReorderMembersDto } from './dto/reorder-members.dto';
import { UpdateMemberSlotDto } from './dto/update-member-slot.dto';

@Injectable()
export class GroupMemberService {
  constructor(@Inject('DB_CONNECTION') private readonly db: NodePgDatabase) {}

  async listMembers(groupId: string) {
    await this.assertGroupExists(groupId);

    return this.db
      .select({
        member: groupMember,
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          birthday: person.birthday,
          phone: person.phone,
          email: person.email,
        },
      })
      .from(groupMember)
      .innerJoin(person, eq(groupMember.personId, person.id))
      .where(and(eq(groupMember.groupId, groupId), isNull(groupMember.deletedAt)))
      .orderBy(groupMember.turnOrder);
  }

  async addMember(groupId: string, dto: AddMemberDto) {
    await this.assertGroupExists(groupId);
    await this.assertTurnsNotInitialized(groupId);

    const [p] = await this.db
      .select({ id: person.id })
      .from(person)
      .where(and(eq(person.id, dto.personId), isNull(person.deletedAt)))
      .limit(1);

    if (!p) throw new NotFoundException(`Person ${dto.personId} not found`);

    // Resolve turnOrder: use provided value or auto-assign next available
    let resolvedTurnOrder = dto.turnOrder;
    if (resolvedTurnOrder === undefined) {
      const [{ maxOrder }] = await this.db
        .select({ maxOrder: max(groupMember.turnOrder) })
        .from(groupMember)
        .where(and(eq(groupMember.groupId, groupId), isNull(groupMember.deletedAt)));
      resolvedTurnOrder = (maxOrder ?? 0) + 1;
    } else {
      const [conflict] = await this.db
        .select({ id: groupMember.id })
        .from(groupMember)
        .where(
          and(
            eq(groupMember.groupId, groupId),
            eq(groupMember.turnOrder, resolvedTurnOrder),
            isNull(groupMember.deletedAt),
          ),
        )
        .limit(1);

      if (conflict) {
        throw new ConflictException(
          `turnOrder ${resolvedTurnOrder} is already taken in this group`,
        );
      }
    }

    const now = new Date();
    const [created] = await this.db
      .insert(groupMember)
      .values({
        id: createId(),
        groupId,
        personId: dto.personId,
        turnOrder: resolvedTurnOrder,
        status: 'ACTIVE',
        customDate: dto.customDate ? new Date(dto.customDate + 'T12:00:00.000Z') : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await this.recalculateGroupTotals(groupId, now);

    return this.findMemberWithPerson(created.id);
  }

  async removeMember(groupId: string, personId: string) {
    await this.assertTurnsNotInitialized(groupId);

    const [member] = await this.db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.personId, personId),
          isNull(groupMember.deletedAt),
        ),
      )
      .limit(1);

    if (!member) {
      throw new NotFoundException(`Member not found in group ${groupId}`);
    }

    const now = new Date();
    await this.db
      .update(groupMember)
      .set({ deletedAt: now, updatedAt: now, status: 'INACTIVE' })
      .where(eq(groupMember.id, member.id));

    await this.recalculateGroupTotals(groupId, now);

    return this.findMemberWithPerson(member.id);
  }

  async reorderMembers(groupId: string, dto: ReorderMembersDto) {
    await this.assertGroupExists(groupId);
    await this.assertTurnsNotInitialized(groupId);

    const items = dto.members;

    // Validate: no duplicate turnOrders in payload
    const incomingOrders = items.map((i) => i.turnOrder);
    const uniqueOrders = new Set(incomingOrders);
    if (uniqueOrders.size !== incomingOrders.length) {
      throw new ConflictException('Duplicate turnOrder values in payload');
    }

    // Fetch all active slots for this group, sorted by current turnOrder
    const existing = await this.db
      .select({ id: groupMember.id, personId: groupMember.personId, turnOrder: groupMember.turnOrder })
      .from(groupMember)
      .where(and(eq(groupMember.groupId, groupId), isNull(groupMember.deletedAt), eq(groupMember.status, 'ACTIVE')))
      .orderBy(groupMember.turnOrder);

    if (items.length !== existing.length) {
      throw new BadRequestException(
        `Payload has ${items.length} items but group has ${existing.length} active slots`,
      );
    }

    // Validate all personIds are active members of this group
    const existingPersonIds = new Set(existing.map((m) => m.personId));
    for (const item of items) {
      if (!existingPersonIds.has(item.personId)) {
        throw new NotFoundException(`Person ${item.personId} is not an active member of this group`);
      }
    }

    // Build slot → new turnOrder mapping.
    // For multi-slot persons: match i-th slot (sorted by current turnOrder) to
    // i-th turnOrder assigned to that person in the payload (in order of appearance).
    const payloadByPerson = new Map<string, number[]>();
    for (const item of items) {
      if (!payloadByPerson.has(item.personId)) payloadByPerson.set(item.personId, []);
      payloadByPerson.get(item.personId)!.push(item.turnOrder);
    }

    // Validate slot count per person matches
    const existingByPerson = new Map<string, typeof existing>();
    for (const slot of existing) {
      if (!existingByPerson.has(slot.personId)) existingByPerson.set(slot.personId, []);
      existingByPerson.get(slot.personId)!.push(slot);
    }

    for (const [personId, newOrders] of payloadByPerson) {
      const slots = existingByPerson.get(personId) ?? [];
      if (newOrders.length !== slots.length) {
        throw new BadRequestException(
          `Person ${personId} has ${slots.length} slot(s) but payload provides ${newOrders.length} turnOrder(s)`,
        );
      }
    }

    // Build update list: slot.id → newTurnOrder
    const updates: Array<{ id: string; turnOrder: number }> = [];
    const usedIndexByPerson = new Map<string, number>();

    for (const slot of existing) {
      const idx = usedIndexByPerson.get(slot.personId) ?? 0;
      const newOrder = payloadByPerson.get(slot.personId)![idx];
      updates.push({ id: slot.id, turnOrder: newOrder });
      usedIndexByPerson.set(slot.personId, idx + 1);
    }

    // Apply atomically: use a temp offset to avoid unique constraint violations mid-update
    const now = new Date();
    await this.db.transaction(async (tx) => {
      // Shift all current turnOrders to a high temp range to avoid conflicts
      for (const slot of existing) {
        await tx
          .update(groupMember)
          .set({ turnOrder: slot.turnOrder + 10000, updatedAt: now })
          .where(eq(groupMember.id, slot.id));
      }
      // Apply final values
      for (const u of updates) {
        await tx
          .update(groupMember)
          .set({ turnOrder: u.turnOrder, updatedAt: now })
          .where(eq(groupMember.id, u.id));
      }
    });

    return this.listMembers(groupId);
  }

  async updateMemberSlot(groupId: string, dto: UpdateMemberSlotDto) {
    await this.assertGroupExists(groupId);
    await this.assertTurnsNotInitialized(groupId);

    const [slot] = await this.db
      .select({ id: groupMember.id })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.personId, dto.personId),
          eq(groupMember.turnOrder, dto.turnOrder),
          isNull(groupMember.deletedAt),
        ),
      )
      .limit(1);

    if (!slot) {
      throw new NotFoundException(
        `No slot found for person ${dto.personId} with turnOrder ${dto.turnOrder} in group ${groupId}`,
      );
    }

    const customDate =
      dto.customDate === undefined || dto.customDate === null
        ? null
        : new Date(dto.customDate + 'T12:00:00.000Z');

    const now = new Date();
    await this.db
      .update(groupMember)
      .set({ customDate, updatedAt: now })
      .where(eq(groupMember.id, slot.id));

    return this.findMemberWithPerson(slot.id);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async findMemberWithPerson(memberId: string) {
    const [row] = await this.db
      .select({
        member: groupMember,
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          birthday: person.birthday,
          phone: person.phone,
          email: person.email,
        },
      })
      .from(groupMember)
      .innerJoin(person, eq(groupMember.personId, person.id))
      .where(eq(groupMember.id, memberId))
      .limit(1);
    return row;
  }

  private async recalculateGroupTotals(groupId: string, now: Date) {
    const [g] = await this.db
      .select({ contributionAmount: group.contributionAmount })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(groupMember)
      .where(and(eq(groupMember.groupId, groupId), isNull(groupMember.deletedAt)));

    const participantCount = Number(total);
    const totalAmountPerTurn = (parseFloat(g.contributionAmount) * participantCount).toFixed(2);

    await this.db
      .update(group)
      .set({ participantCount, totalAmountPerTurn, updatedAt: now })
      .where(eq(group.id, groupId));
  }

  private async assertGroupExists(groupId: string) {
    const [g] = await this.db
      .select({ id: group.id })
      .from(group)
      .where(and(eq(group.id, groupId), isNull(group.deletedAt)))
      .limit(1);
    if (!g) throw new NotFoundException(`Group ${groupId} not found`);
  }

  private async assertTurnsNotInitialized(groupId: string) {
    const [existing] = await this.db
      .select({ id: turn.id })
      .from(turn)
      .where(eq(turn.groupId, groupId))
      .limit(1);
    if (existing) {
      throw new BadRequestException(
        'Cannot modify members after turns have been initialized',
      );
    }
  }
}
