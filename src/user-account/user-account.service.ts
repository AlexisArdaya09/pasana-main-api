import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { createId } from '@paralleldrive/cuid2';
import { person, userAccount } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import { UpdateUserAccountDto } from './dto/update-user-account.dto';
import {
  ListUserAccountsQueryDto,
  SortOrder,
  UserAccountSortBy,
} from './dto/list-user-accounts.query';

const BCRYPT_ROUNDS = 10;

export type UserAccountPublic = Omit<
  typeof userAccount.$inferSelect,
  'passwordHash'
>;

@Injectable()
export class UserAccountService {
  constructor(@Inject('DB_CONNECTION') private readonly db: NodePgDatabase) {}

  private mapPublic(row: typeof userAccount.$inferSelect): UserAccountPublic {
    const { passwordHash, ...rest } = row;
    void passwordHash;
    return rest;
  }

  private async assertUniqueField(
    field: 'username' | 'email',
    value: string,
    excludeAccountId?: string,
  ) {
    const col = userAccount[field];
    const rows = await this.db
      .select({ id: userAccount.id })
      .from(userAccount)
      .where(and(eq(col, value), isNull(userAccount.deletedAt)));

    const taken = excludeAccountId
      ? rows.filter((r) => r.id !== excludeAccountId)
      : rows;

    if (taken.length > 0) {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      throw new ConflictException(`${label} "${value}" is already taken`);
    }
  }

  async findAll(
    query: ListUserAccountsQueryDto,
  ): Promise<OffsetPage<UserAccountPublic>> {
    const {
      username,
      sortBy = UserAccountSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
      page = 0,
      size = 10,
    } = query;

    const conditions = [isNull(userAccount.deletedAt)];
    if (username) conditions.push(ilike(userAccount.username, `%${username}%`));
    const where = and(...conditions);

    const orderCol =
      sortBy === UserAccountSortBy.USERNAME
        ? userAccount.username
        : userAccount.createdAt;
    const orderFn = sortOrder === SortOrder.DESC ? desc : asc;
    const offset = page * size;

    const rows = await this.db
      .select()
      .from(userAccount)
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(size)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(userAccount)
      .where(where);

    const content = rows.map((r) => this.mapPublic(r));

    return createOffsetPage(content, Number(total), page, size);
  }

  async findOne(id: string): Promise<UserAccountPublic> {
    const [found] = await this.db
      .select()
      .from(userAccount)
      .where(and(eq(userAccount.id, id), isNull(userAccount.deletedAt)))
      .limit(1);

    if (!found) throw new NotFoundException(`User account ${id} not found`);

    return this.mapPublic(found);
  }

  async create(dto: CreateUserAccountDto): Promise<UserAccountPublic> {
    if (dto.personId) {
      const [p] = await this.db
        .select()
        .from(person)
        .where(and(eq(person.id, dto.personId), isNull(person.deletedAt)))
        .limit(1);

      if (!p) throw new NotFoundException(`Person ${dto.personId} not found`);

      const [existingForPerson] = await this.db
        .select()
        .from(userAccount)
        .where(eq(userAccount.personId, dto.personId))
        .limit(1);

      if (existingForPerson) {
        throw new ConflictException(
          existingForPerson.deletedAt
            ? `Person ${dto.personId} has a removed user account; hard-delete it before creating a new one`
            : `Person ${dto.personId} already has a user account`,
        );
      }
    }

    await Promise.all([
      this.assertUniqueField('username', dto.username),
      this.assertUniqueField('email', dto.email),
    ]);

    const id = createId();
    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const [created] = await this.db
      .insert(userAccount)
      .values({
        id,
        personId: dto.personId ?? null,
        username: dto.username,
        email: dto.email,
        passwordHash,
        passwordExpired: dto.passwordExpired ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.mapPublic(created);
  }

  async update(
    id: string,
    dto: UpdateUserAccountDto,
  ): Promise<UserAccountPublic> {
    await this.findOne(id);

    await Promise.all([
      dto.username !== undefined ? this.assertUniqueField('username', dto.username, id) : Promise.resolve(),
      dto.email !== undefined ? this.assertUniqueField('email', dto.email, id) : Promise.resolve(),
    ]);

    const patch: Partial<typeof userAccount.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.username !== undefined) patch.username = dto.username;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.passwordExpired !== undefined) patch.passwordExpired = dto.passwordExpired;
    if (dto.password !== undefined) {
      patch.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    const [updated] = await this.db
      .update(userAccount)
      .set(patch)
      .where(eq(userAccount.id, id))
      .returning();

    return this.mapPublic(updated);
  }

  async softDelete(id: string): Promise<UserAccountPublic> {
    await this.findOne(id);

    const [updated] = await this.db
      .update(userAccount)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(userAccount.id, id))
      .returning();

    return this.mapPublic(updated);
  }

  async hardDelete(id: string) {
    const [existing] = await this.db
      .select()
      .from(userAccount)
      .where(eq(userAccount.id, id))
      .limit(1);

    if (!existing) throw new NotFoundException(`User account ${id} not found`);

    await this.db.delete(userAccount).where(eq(userAccount.id, id));
  }
}
