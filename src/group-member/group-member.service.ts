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

    const [duplicate] = await this.db
      .select({ id: groupMember.id })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.personId, dto.personId),
          isNull(groupMember.deletedAt),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictException(
        `Person ${dto.personId} is already a member of this group`,
      );
    }

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
