import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import { group } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupSortBy, ListGroupsQueryDto, SortOrder } from './dto/list-groups.query';

@Injectable()
export class GroupService {
  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase,
  ) {}

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
      .values({ id: createId(), ...dto, createdAt: now, updatedAt: now })
      .returning();

    return created;
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findOne(id);

    const [updated] = await this.db
      .update(group)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(group.id, id))
      .returning();

    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);

    const [updated] = await this.db
      .update(group)
      .set({ deletedAt: new Date() })
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
}
