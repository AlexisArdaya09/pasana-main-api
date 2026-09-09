/**
 * Auth configuration read from environment variables.
 *
 * Nothing here has a usable default: a missing secret must fail loudly at
 * boot instead of silently starting an app that anyone can sign into.
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  /** SPA URL that receives the token after the Google redirect. */
  frontendOAuthRedirect: string;
  /** Only these emails may sign in with Google. Everything else is rejected. */
  allowedEmails: string[];
  superAdmin: {
    email: string;
    username: string;
    password: string;
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadAuthConfig(): AuthConfig {
  return {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    google: {
      clientId: required('GOOGLE_CLIENT_ID'),
      clientSecret: required('GOOGLE_CLIENT_SECRET'),
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:3000/auth/google/callback',
    },
    frontendOAuthRedirect:
      process.env.FRONTEND_OAUTH_REDIRECT ??
      'http://localhost:4200/auth/google/callback',
    allowedEmails: (process.env.AUTH_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    superAdmin: {
      email: (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase(),
      username: process.env.SUPER_ADMIN_USERNAME ?? 'superadmin',
      password: process.env.SUPER_ADMIN_PASSWORD ?? '',
    },
  };
}
