import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import * as bcrypt from 'bcrypt';
import { userAccount } from '../database/schema';
import { AuthConfig, loadAuthConfig } from './auth.config';
import { AuthenticatedUser, JwtPayload } from './types/jwt-payload.type';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface GoogleProfileParams {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  private readonly config: AuthConfig = loadAuthConfig();

  constructor(
    @Inject('DB_CONNECTION') private readonly db: NodePgDatabase,
    private readonly jwtService: JwtService,
  ) {}

  /** Email + password sign in. Google-only accounts have no hash and are rejected. */
  async login(email: string, password: string): Promise<AuthTokens> {
    const account = await this.findByEmail(email);

    // Same generic message for "no user" and "wrong password": telling them
    // apart lets an attacker enumerate valid emails.
    if (!account?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(password, account.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!account.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    return this.issueTokens(account);
  }

  /**
   * Google sign in. The account must already exist OR the email must be in the
   * allowlist — nobody else can get in, and no account is created for them.
   */
  async loginWithGoogle(params: GoogleProfileParams): Promise<AuthTokens> {
    const email = params.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);

    if (!existing) {
      if (!this.isEmailAllowed(email)) {
        throw new ForbiddenException('This Google account is not authorized');
      }
      const created = await this.createGoogleAccount(params, email);
      return this.issueTokens(created);
    }

    if (!existing.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    // Link the Google identity to the pre-existing account on first sign in.
    if (!existing.googleId) {
      const [updated] = await this.db
        .update(userAccount)
        .set({ googleId: params.googleId, updatedAt: new Date() })
        .where(eq(userAccount.id, existing.id))
        .returning();
      return this.issueTokens(updated);
    }

    if (existing.googleId !== params.googleId) {
      throw new ForbiddenException(
        'This email is already linked to a different Google account',
      );
    }

    return this.issueTokens(existing);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const account = await this.findById(payload.sub);
    if (!account || !account.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(account, false);
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const account = await this.findById(userId);
    if (!account) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return this.toAuthenticatedUser(account);
  }

  isEmailAllowed(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return (
      this.config.allowedEmails.includes(normalized) ||
      normalized === this.config.superAdmin.email
    );
  }

  private async createGoogleAccount(
    params: GoogleProfileParams,
    email: string,
  ): Promise<typeof userAccount.$inferSelect> {
    const username = await this.uniqueUsernameFrom(email);
    const now = new Date();
    const [created] = await this.db
      .insert(userAccount)
      .values({
        id: createId(),
        username,
        email,
        passwordHash: null,
        googleId: params.googleId,
        role: email === this.config.superAdmin.email ? 'SUPER_ADMIN' : 'ADMIN',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }

  /** Derives a username from the email, adding a suffix if it is taken. */
  private async uniqueUsernameFrom(email: string): Promise<string> {
    const base = email.split('@')[0].slice(0, 90) || 'user';
    let candidate = base;

    for (let attempt = 1; attempt <= 20; attempt++) {
      const [taken] = await this.db
        .select({ id: userAccount.id })
        .from(userAccount)
        .where(eq(userAccount.username, candidate))
        .limit(1);
      if (!taken) return candidate;
      candidate = `${base}${attempt}`;
    }

    return `${base}-${createId().slice(0, 8)}`;
  }

  private async issueTokens(
    account: typeof userAccount.$inferSelect,
    touchLastLogin = true,
  ): Promise<AuthTokens> {
    if (touchLastLogin) {
      await this.db
        .update(userAccount)
        .set({ lastLoginAt: new Date() })
        .where(eq(userAccount.id, account.id));
    }

    const payload: JwtPayload = {
      sub: account.id,
      email: account.email,
      role: account.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: this.toAuthenticatedUser(account),
    };
  }

  private toAuthenticatedUser(
    account: typeof userAccount.$inferSelect,
  ): AuthenticatedUser {
    return {
      id: account.id,
      email: account.email,
      username: account.username,
      role: account.role,
      personId: account.personId,
    };
  }

  private async findByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(userAccount)
      .where(
        and(
          eq(userAccount.email, email.trim().toLowerCase()),
          isNull(userAccount.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(userAccount)
      .where(and(eq(userAccount.id, id), isNull(userAccount.deletedAt)))
      .limit(1);
    return row ?? null;
  }
}
