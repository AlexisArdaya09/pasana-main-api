import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { loadAuthConfig } from '../auth.config';
import { AuthenticatedUser, JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: loadAuthConfig().jwtSecret,
    });
  }

  /**
   * Re-reads the account on every request so a disabled or deleted user stops
   * being accepted immediately, instead of when their token expires.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    try {
      return await this.authService.me(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
