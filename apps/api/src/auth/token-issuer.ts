import { existsSync, readFileSync } from 'node:fs';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { AuthUser } from './auth-user';

const expiresInSeconds = 60 * 60 * 8;

@Injectable()
export class TokenIssuer {
  private keyPromise: ReturnType<typeof importPKCS8> | null = null;
  private readonly issuer = process.env.JWT_ISSUER ?? 'taxi-rio-local';
  private readonly audience = process.env.JWT_AUDIENCE ?? 'taxi-rio-api';

  async sign(user: AuthUser): Promise<{ token: string; expiresIn: number }> {
    const key = await this.privateKey();
    const token = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(user.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${expiresInSeconds}s`)
      .sign(key);
    return { token, expiresIn: expiresInSeconds };
  }

  private privateKey(): ReturnType<typeof importPKCS8> {
    if (!this.keyPromise) {
      const path = resolvePrivateKeyPath();
      if (!path) {
        throw new ServiceUnavailableException(
          'Chave privada local ausente. Execute node scripts/generate-demo-tokens.mjs.',
        );
      }
      this.keyPromise = importPKCS8(readFileSync(path, 'utf8'), 'RS256');
    }
    return this.keyPromise;
  }
}

function resolvePrivateKeyPath(): string | null {
  const configured = process.env.JWT_PRIVATE_KEY_PATH;
  const candidates = configured
    ? [configured]
    : ['keys/jwt-private.pem', '../../keys/jwt-private.pem', '/app/keys/jwt-private.pem'];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
