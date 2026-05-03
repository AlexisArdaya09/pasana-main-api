import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import { group, groupMember, person, turn } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupSortBy, ListGroupsQueryDto, SortOrder } from './dto/list-groups.query';
import { InitializeTurnsDto } from './dto/initialize-turns.dto';

// ─── Date helpers ──────────────────────────────────────────────────────────────

function toNum(v: string | number): number {
  return typeof v === 'string' ? parseFloat(v) : v;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + weeks * 7));
}

/**
 * Returns the next occurrence of `birthday` (month + day only) that falls
 * on or after `fromDate`, searching year by year if needed.
 *
 * Example:
 *   birthday = 1990-03-15, fromDate = 2025-06-01 → 2026-03-15
 *   birthday = 1990-03-15, fromDate = 2025-01-01 → 2025-03-15
 *
 * Feb 29 birthdays fall on Feb 28 in non-leap years.
 */
function nextBirthdayFrom(birthday: Date, fromDate: Date): Date {
  const bMonth = birthday.getUTCMonth();
  const bDay = birthday.getUTCDate();

  const fromYear = fromDate.getUTCFullYear();
  const candidate = new Date(Date.UTC(fromYear, bMonth, bDay));

  return candidate >= fromDate
    ? candidate
    : new Date(Date.UTC(fromYear + 1, bMonth, bDay));
}

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class GroupService {
  constructor(@Inject('DB_CONNECTION') private readonly db: NodePgDatabase) {}

  async findAll(query: ListGroupsQueryDto): Promise<OffsetPage<typeof group.$inferSelect>> {
    const {
      name,
      sortBy = GroupSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
      page = 0,
      size = 10,
    } = query;

    const conditions = [isNull(group.deletedAt)];
    if (name) conditions.push(ilike(group.name, `%${name}%`));
    const where = and(...conditions);

    const orderCol = sortBy === GroupSortBy.NAME ? group.name : group.createdAt;
    const orderFn = sortOrder === SortOrder.DESC ? desc : asc;
    const offset = page * size;

    const [content, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(group)
        .where(where)
        .orderBy(orderFn(orderCol))
        .limit(size)
        .offset(offset),
      this.db.select({ total: count() }).from(group).where(where),
    ]);

    return createOffsetPage(content, Number(total), page, size);
  }

  async findOne(id: string) {
    const [found] = await this.db
      .select()
      .from(group)
      .where(and(eq(group.id, id), isNull(group.deletedAt)))
      .limit(1);

    if (!found) throw new NotFoundException(`Group ${id} not found`);
    return found;
  }

  async create(dto: CreateGroupDto) {
    const now = new Date();
    const [created] = await this.db
      .insert(group)
      .values({
        id: createId(),
        name: dto.name,
        description: dto.description ?? null,
        frequency: dto.frequency,
        contributionAmount: dto.contributionAmount.toFixed(2),
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }

  async update(id: string, dto: UpdateGroupDto) {
    const existing = await this.findOne(id);

    if (existing.status === 'COMPLETED') {
      throw new BadRequestException('Cannot update a completed group');
    }

    const patch: Partial<typeof group.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.frequency !== undefined) patch.frequency = dto.frequency;
    if (dto.contributionAmount !== undefined)
      patch.contributionAmount = dto.contributionAmount.toFixed(2);

    const [updated] = await this.db
      .update(group)
      .set(patch)
      .where(eq(group.id, id))
      .returning();
    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    const [updated] = await this.db
      .update(group)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(group.id, id))
      .returning();
    return updated;
  }

  async hardDelete(id: string) {
    const [existing] = await this.db
      .select()
      .from(group)
      .where(eq(group.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException(`Group ${id} not found`);
    await this.db.delete(group).where(eq(group.id, id));
  }

  // ─── Turn initialization ──────────────────────────────────────────────────

  /**
   * Creates one Turn per active member and activates the first one.
   *
   * WEEKLY / MONTHLY:
   *   Turns are ordered by `group_member.turn_order` and spaced by the
   *   group frequency from `startDate`.
   *
   * BIRTHDAY:
   *   Each member's `scheduledDate` = their next birthday on or after
   *   `startDate`.  Turns are sorted by that date (ascending).
   *   `turnOrder` in group_member acts only as a tiebreaker when two
   *   members share the same birthday.
   */
  async initializeTurns(groupId: string, dto: InitializeTurnsDto = {}) {
    const g = await this.findOne(groupId);

    const existingTurns = await this.db
      .select({ id: turn.id })
      .from(turn)
      .where(eq(turn.groupId, groupId))
      .limit(1);

    if (existingTurns.length > 0) {
      throw new BadRequestException('Turns already initialized for this group');
    }

    // Join members with person to get birthday (needed for BIRTHDAY frequency)
    const rows = await this.db
      .select({
        memberId: groupMember.id,
        personId: groupMember.personId,
        turnOrder: groupMember.turnOrder,
        birthday: person.birthday,
        firstName: person.firstName,
        lastName: person.lastName,
      })
      .from(groupMember)
      .innerJoin(person, eq(groupMember.personId, person.id))
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.status, 'ACTIVE')));

    if (rows.length === 0) {
      throw new BadRequestException('Group has no active members');
    }

    // Use provided startDate or default to today (UTC noon to avoid timezone drift)
    const anchorDate = dto.startDate
      ? new Date(dto.startDate + 'T12:00:00.000Z')
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

    const orderedMembers = this.orderMembersForTurns(rows, g.frequency, anchorDate);

    const contributionAmount = toNum(g.contributionAmount);
    const totalExpected = (contributionAmount * orderedMembers.length).toFixed(2);
    const now = new Date();

    const turnsToInsert = orderedMembers.map((entry, index) => ({
      id: createId(),
      groupId,
      turnNumber: index + 1,
      beneficiaryId: entry.personId,
      status: (index === 0 ? 'ACTIVE' : 'PENDING') as 'ACTIVE' | 'PENDING',
      totalExpectedAmount: totalExpected,
      totalPaidAmount: '0.00',
      scheduledDate: entry.scheduledDate,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    const createdTurns = await this.db.insert(turn).values(turnsToInsert).returning();

    // Set group dates: startDate = first turn, endDate = last turn
    const groupStartDate = orderedMembers[0].scheduledDate;
    const groupEndDate = orderedMembers[orderedMembers.length - 1].scheduledDate;

    const [updatedGroup] = await this.db
      .update(group)
      .set({ startDate: groupStartDate, endDate: groupEndDate, updatedAt: now })
      .where(eq(group.id, groupId))
      .returning();

    return {
      group: updatedGroup,
      turns: createdTurns.map((t, i) => ({
        ...t,
        beneficiary: {
          personId: orderedMembers[i].personId,
          firstName: orderedMembers[i].firstName,
          lastName: orderedMembers[i].lastName,
        },
      })),
      totalTurns: createdTurns.length,
      contributionAmount,
      totalExpectedPerTurn: parseFloat(totalExpected),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private orderMembersForTurns(
    rows: Array<{
      personId: string;
      turnOrder: number;
      birthday: Date;
      firstName: string;
      lastName: string;
    }>,
    frequency: string,
    startDate: Date,
  ): Array<{
    personId: string;
    firstName: string;
    lastName: string;
    scheduledDate: Date;
  }> {
    if (frequency === 'BIRTHDAY') {
      return this.orderByBirthday(rows, startDate);
    }

    // WEEKLY / MONTHLY: respect manual turnOrder
    const sorted = [...rows].sort((a, b) => a.turnOrder - b.turnOrder);
    return sorted.map((m, index) => ({
      personId: m.personId,
      firstName: m.firstName,
      lastName: m.lastName,
      scheduledDate:
        frequency === 'WEEKLY'
          ? addWeeks(startDate, index)
          : addMonths(startDate, index),
    }));
  }

  private orderByBirthday(
    rows: Array<{
      personId: string;
      turnOrder: number;
      birthday: Date;
      firstName: string;
      lastName: string;
    }>,
    startDate: Date,
  ): Array<{
    personId: string;
    firstName: string;
    lastName: string;
    scheduledDate: Date;
  }> {
    // Compute each member's next birthday from startDate
    const withDates = rows.map((m) => ({
      ...m,
      scheduledDate: nextBirthdayFrom(new Date(m.birthday), startDate),
    }));

    // Sort by scheduledDate ASC; use turnOrder as tiebreaker for same birthday
    withDates.sort((a, b) => {
      const diff = a.scheduledDate.getTime() - b.scheduledDate.getTime();
      return diff !== 0 ? diff : a.turnOrder - b.turnOrder;
    });

    return withDates.map(({ personId, firstName, lastName, scheduledDate }) => ({
      personId,
      firstName,
      lastName,
      scheduledDate,
    }));
  }
}
