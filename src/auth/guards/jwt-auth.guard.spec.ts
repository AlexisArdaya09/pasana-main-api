import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function contextFor(handler: object, cls: object = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('lets through handlers explicitly marked @Public()', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) => (key === IS_PUBLIC_KEY ? true : undefined));

    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(contextFor(() => undefined))).toBe(true);
  });

  it('falls back to JWT validation for anything not marked public', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const guard = new JwtAuthGuard(reflector);
    // Passport's canActivate is what enforces the token; the point here is that
    // an unannotated handler reaches it instead of being waved through.
    const passportCanActivate = jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)) as {
          canActivate: () => boolean;
        },
        'canActivate',
      )
      .mockReturnValue(true);

    guard.canActivate(contextFor(() => undefined));

    expect(passportCanActivate).toHaveBeenCalled();
    passportCanActivate.mockRestore();
  });
});
