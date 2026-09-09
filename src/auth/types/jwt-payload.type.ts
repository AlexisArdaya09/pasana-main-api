import { UserRole } from '../../database/schema/user-account/user-account.schema';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  personId: string | null;
}
