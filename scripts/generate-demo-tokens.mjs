import { createSign, generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keysDir = join(root, 'keys');
const privatePath = join(keysDir, 'jwt-private.pem');
const publicPath = join(keysDir, 'jwt-public.pem');

mkdirSync(keysDir, { recursive: true });

if (!existsSync(privatePath) || !existsSync(publicPath)) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));
}

const privatePem = readFileSync(privatePath);
const issuer = 'taxi-rio-local';
const audience = 'taxi-rio-api';

function sign(claims) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(privatePem, 'base64url')}`;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

const now = Math.floor(Date.now() / 1000);
const longLived = now + 60 * 60 * 24 * 365 * 4;

const tokens = {
  passengerA: sign({ sub: 'passenger-a', role: 'passenger', iss: issuer, aud: audience, iat: now, exp: longLived }),
  passengerB: sign({ sub: 'passenger-b', role: 'passenger', iss: issuer, aud: audience, iat: now, exp: longLived }),
  driverA: sign({ sub: 'driver-a', role: 'driver', iss: issuer, aud: audience, iat: now, exp: longLived }),
  expiredPassenger: sign({ sub: 'passenger-a', role: 'passenger', iss: issuer, aud: audience, iat: now - 120, exp: now - 60 }),
};

writeFileSync(join(keysDir, 'demo-tokens.json'), `${JSON.stringify(tokens, null, 2)}\n`);
writeFileSync(
  join(root, 'apps', 'web', 'src', 'demo-tokens.ts'),
  `export const demoTokens = {\n  passengerA: ${JSON.stringify(tokens.passengerA)},\n  passengerB: ${JSON.stringify(tokens.passengerB)},\n  driverA: ${JSON.stringify(tokens.driverA)},\n} as const;\n`,
);
