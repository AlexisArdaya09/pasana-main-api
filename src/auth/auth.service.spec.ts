import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { fakeDb } from '../common/testing/drizzle-mock';
import { AuthService } from './auth.service';

const ALLOWED_EMAIL = 'allowed@example.com';
const SUPER_ADMIN_EMAIL = 'boss@example.com';
const OUTSIDER_EMAIL = 'attacker@example.com';

const googleProfile = {
  googleId: 'google-123',
  email: OUTSIDER_EMAIL,
  firstName: 'Mallory',
  lastName: 'Outsider',
};

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    personId: null,
    username: 'allowed',
    email: ALLOWED_EMAIL,
    passwordHash: null,
    passwordExpired: false,
    googleId: 'google-123',
    role: 'ADMIN',
    isActive: true,
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(queue: unknown[][]) {
  const db = fakeDb(queue);
  const jwt = new JwtService({});
  return {
    db,
    service: new AuthService(db as unknown as NodePgDatabase, jwt),
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.AUTH_ALLOWED_EMAILS = `${ALLOWED_EMAIL}, other@example.com`;
    process.env.SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;
  });

  describe('isEmailAllowed', () => {
    it('accepts allowlisted emails regardless of casing or padding', () => {
      const { service } = buildService([]);
      expect(service.isEmailAllowed(`  ${ALLOWED_EMAIL.toUpperCase()} `)).toBe(true);
    });

    it('accepts the super admin even if not in the allowlist', () => {
      const { service } = buildService([]);
      expect(service.isEmailAllowed(SUPER_ADMIN_EMAIL)).toBe(true);
    });

    it('rejects anyone else', () => {
      const { service } = buildService([]);
      expect(service.isEmailAllowed(OUTSIDER_EMAIL)).toBe(false);
    });
  });

  describe('loginWithGoogle', () => {
    it('refuses an unknown email and creates no account', async () => {
      // Only one query runs: the email lookup, which finds nothing.
      const { db, service } = buildService([[]]);

      await expect(service.loginWithGoogle(googleProfile)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // No insert consumed a queued result → no account was created.
      expect(db.pending()).toBe(0);
    });

    it('creates an account for an allowlisted email on first sign in', async () => {
      const created = buildAccount({ email: ALLOWED_EMAIL });
      const { service } = buildService([
        [], // email lookup: no account yet
        [], // username availability check: free
        [created], // insert ... returning
        [], // lastLoginAt update
      ]);

      const result = await service.loginWithGoogle({
        ...googleProfile,
        email: ALLOWED_EMAIL,
      });

      expect(result.user.email).toBe(ALLOWED_EMAIL);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('refuses a disabled account', async () => {
      const { service } = buildService([[buildAccount({ isActive: false })]]);

      await expect(
        service.loginWithGoogle({ ...googleProfile, email: ALLOWED_EMAIL }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses when the email is linked to a different Google account', async () => {
      const { service } = buildService([
        [buildAccount({ googleId: 'some-other-google-id' })],
      ]);

      await expect(
        service.loginWithGoogle({ ...googleProfile, email: ALLOWED_EMAIL }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('links the Google identity to a pre-existing password account', async () => {
      const existing = buildAccount({ googleId: null, passwordHash: 'hash' });
      const linked = { ...existing, googleId: googleProfile.googleId };
      const { service } = buildService([
        [existing], // email lookup
        [linked], // update ... returning
        [], // lastLoginAt update
      ]);

      const result = await service.loginWithGoogle({
        ...googleProfile,
        email: ALLOWED_EMAIL,
      });

      expect(result.user.id).toBe(existing.id);
    });
  });

  describe('login', () => {
    it('rejects a Google-only account that has no password', async () => {
      const { service } = buildService([[buildAccount({ passwordHash: null })]]);

      await expect(
        service.login(ALLOWED_EMAIL, 'whatever'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      const { service } = buildService([[]]);

      await expect(service.login('ghost@example.com', 'x')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-horse', 4);
      const { service } = buildService([[buildAccount({ passwordHash })]]);

      await expect(
        service.login(ALLOWED_EMAIL, 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues tokens for valid credentials', async () => {
      const password = 'correct-horse';
      const passwordHash = await bcrypt.hash(password, 4);
      const { service } = buildService([
        [buildAccount({ passwordHash })],
        [], // lastLoginAt update
      ]);

      const result = await service.login(ALLOWED_EMAIL, password);

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user.email).toBe(ALLOWED_EMAIL);
    });

    it('refuses a disabled account even with the right password', async () => {
      const password = 'correct-horse';
      const passwordHash = await bcrypt.hash(password, 4);
      const { service } = buildService([
        [buildAccount({ passwordHash, isActive: false })],
      ]);

      await expect(service.login(ALLOWED_EMAIL, password)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('refresh', () => {
    it('rejects a token that is not a valid refresh token', async () => {
      const { service } = buildService([]);

      await expect(service.refresh('not-a-jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token whose account no longer exists', async () => {
      const jwt = new JwtService({});
      const token = await jwt.signAsync(
        { sub: 'gone', email: ALLOWED_EMAIL, role: 'ADMIN' },
        { secret: 'test-refresh-secret', expiresIn: '5m' },
      );
      const { service } = buildService([[]]);

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
