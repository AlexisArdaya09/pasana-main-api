import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthService, AuthTokens } from '../auth.service';
import { loadAuthConfig } from '../auth.config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    const config = loadAuthConfig();
    super({
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<AuthTokens> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google did not return an email');
    }

    return this.authService.loginWithGoogle({
      googleId: profile.id,
      email,
      firstName: profile.name?.givenName ?? 'User',
      lastName: profile.name?.familyName ?? '',
    });
  }
}
