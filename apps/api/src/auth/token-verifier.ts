import { existsSync, readFileSync } from 'node:fs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { importSPKI, jwtVerify } from 'jose';
import { ActorRole, actorRoles, AuthUser } from './auth-user';

@Injectable()
export class TokenVerifier {
  private readonly keyPromise: ReturnType<typeof importSPKI>;
  private readonly issuer = process.env.JWT_ISSUER ?? 'taxi-rio-local';
  private readonly audience = process.env.JWT_AUDIENCE ?? 'taxi-rio-api';

  constructor() {
    const path = resolvePublicKeyPath();
    this.keyPromise = importSPKI(readFileSync(path, 'utf8'), 'RS256');
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const key = await this.keyPromise;
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new UnauthorizedException();
      }
      if (!isRole(payload.role)) {
        throw new UnauthorizedException();
      }
      return { sub: payload.sub, role: payload.role };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException();
    }
  }
}

function isRole(value: unknown): value is ActorRole {
  return actorRoles.some((role) => role === value);
}

function resolvePublicKeyPath(): string {
  const configured = process.env.JWT_PUBLIC_KEY_PATH;
  const candidates = configured
    ? [configured]
    : ['keys/jwt-public.pem', '../../keys/jwt-public.pem', '/app/keys/jwt-public.pem'];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('JWT public key was not found. Set JWT_PUBLIC_KEY_PATH.');
  }
  return found;
}
