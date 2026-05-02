import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull, ne, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { createId } from '@paralleldrive/cuid2';
import { person, userAccount } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import {
  ListPersonsQueryDto,
  PersonSortBy,
  SortOrder,
} from './dto/list-persons.query';

const BCRYPT_ROUNDS = 10;

export type PersonWithAccount = typeof person.$inferSelect & {
  userAccount: Omit<typeof userAccount.$inferSelect, 'passwordHash'>;
};

@Injectable()
export class PersonService {
  constructor(@Inject('DB_CONNECTION') private readonly db: NodePgDatabase) {}

  private mapAccount(row: typeof userAccount.$inferSelect) {
    const { passwordHash, ...rest } = row;
    void passwordHash;
    return rest;
  }

  private async assertUniquePersonField(
    field: 'dni' | 'phone' | 'email',
    value: string,
    excludePersonId?: string,
  ) {
    const col = person[field];
    const rows = await this.db
      .select({ id: person.id })
      .from(person)
      .where(and(eq(col, value), isNull(person.deletedAt)));

    const taken = excludePersonId
      ? rows.filter((r) => r.id !== excludePersonId)
      : rows;

    if (taken.length > 0) {
      const label = field === 'dni' ? 'DNI' : field.charAt(0).toUpperCase() + field.slice(1);
      throw new ConflictException(`${label} "${value}" is already in use`);
    }
  }

  private async assertUniqueAccountField(
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
    query: ListPersonsQueryDto,
  ): Promise<OffsetPage<PersonWithAccount>> {
    const {
      firstName,
      lastName,
      sortBy = PersonSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
      page = 0,
      size = 10,
    } = query;

    const conditions: SQL[] = [
      isNull(person.deletedAt),
      isNull(userAccount.deletedAt),
    ];
    if (firstName) conditions.push(ilike(person.firstName, `%${firstName}%`));
    if (lastName) conditions.push(ilike(person.lastName, `%${lastName}%`));
    const where = and(...conditions);

    const orderCol =
      sortBy === PersonSortBy.FIRST_NAME
        ? person.firstName
        : sortBy === PersonSortBy.LAST_NAME
          ? person.lastName
          : sortBy === PersonSortBy.DNI
            ? person.dni
            : person.createdAt;
    const orderFn = sortOrder === SortOrder.DESC ? desc : asc;
    const offset = page * size;

    const rows = await this.db
      .select({ p: person, ua: userAccount })
      .from(person)
      .innerJoin(userAccount, eq(person.id, userAccount.personId))
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(size)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(person)
      .innerJoin(userAccount, eq(person.id, userAccount.personId))
      .where(where);

    const content: PersonWithAccount[] = rows.map(({ p, ua }) => ({
      ...p,
      userAccount: this.mapAccount(ua),
    }));

    return createOffsetPage(content, Number(total), page, size);
  }

  async findOne(id: string): Promise<PersonWithAccount> {
    const [row] = await this.db
      .select({ p: person, ua: userAccount })
      .from(person)
      .innerJoin(userAccount, eq(person.id, userAccount.personId))
      .where(
        and(
          eq(person.id, id),
          isNull(person.deletedAt),
          isNull(userAccount.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException(`Person ${id} not found`);

    return { ...row.p, userAccount: this.mapAccount(row.ua) };
  }

  async create(dto: CreatePersonDto): Promise<PersonWithAccount> {
    await Promise.all([
      this.assertUniquePersonField('dni', dto.dni),
      this.assertUniquePersonField('phone', dto.phone),
      this.assertUniquePersonField('email', dto.email),
      this.assertUniqueAccountField('username', dto.username),
      this.assertUniqueAccountField('email', dto.email),
    ]);

    const personId = createId();
    const accountId = createId();
    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const birthday = new Date(dto.birthday + 'T12:00:00.000Z');

    await this.db.transaction(async (tx) => {
      await tx.insert(person).values({
        id: personId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthday,
        dni: dto.dni,
        phone: dto.phone,
        email: dto.email,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(userAccount).values({
        id: accountId,
        personId,
        username: dto.username,
        email: dto.email,
        passwordHash,
        passwordExpired: dto.passwordExpired ?? false,
        createdAt: now,
        updatedAt: now,
      });
    });

    return this.findOne(personId);
  }

  async update(id: string, dto: UpdatePersonDto): Promise<PersonWithAccount> {
    await this.findOne(id);

    await Promise.all([
      dto.dni !== undefined ? this.assertUniquePersonField('dni', dto.dni, id) : Promise.resolve(),
      dto.phone !== undefined ? this.assertUniquePersonField('phone', dto.phone, id) : Promise.resolve(),
      dto.email !== undefined ? this.assertUniquePersonField('email', dto.email, id) : Promise.resolve(),
    ]);

    const patch: Partial<typeof person.$inferInsert> = { updatedAt: new Date() };
    if (dto.firstName !== undefined) patch.firstName = dto.firstName;
    if (dto.lastName !== undefined) patch.lastName = dto.lastName;
    if (dto.birthday !== undefined) {
      patch.birthday = new Date(dto.birthday + 'T12:00:00.000Z');
    }
    if (dto.dni !== undefined) patch.dni = dto.dni;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.email !== undefined) patch.email = dto.email;

    await this.db.update(person).set(patch).where(eq(person.id, id));

    return this.findOne(id);
  }

  async softDelete(id: string) {
    await this.findOne(id);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(person)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(person.id, id));
      await tx
        .update(userAccount)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(userAccount.personId, id));
    });

    return this.findOneIncludingDeleted(id);
  }

  async hardDelete(id: string) {
    const [existing] = await this.db
      .select()
      .from(person)
      .where(eq(person.id, id))
      .limit(1);

    if (!existing) throw new NotFoundException(`Person ${id} not found`);

    await this.db.transaction(async (tx) => {
      await tx.delete(userAccount).where(eq(userAccount.personId, id));
      await tx.delete(person).where(eq(person.id, id));
    });
  }

  private async findOneIncludingDeleted(id: string): Promise<PersonWithAccount> {
    const [row] = await this.db
      .select({ p: person, ua: userAccount })
      .from(person)
      .innerJoin(userAccount, eq(person.id, userAccount.personId))
      .where(eq(person.id, id))
      .limit(1);

    if (!row) throw new NotFoundException(`Person ${id} not found`);

    return { ...row.p, userAccount: this.mapAccount(row.ua) };
  }
}
