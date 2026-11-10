# Chaves JWT de demonstração

O par RS256 desta pasta só assina tokens do emissor `taxi-rio-local` para a audiência `taxi-rio-api`. Não protege nenhum ambiente real.

`keys/jwt-private.pem` entra no repositório porque o login e os tokens de `keys/demo-tokens.json` precisam do mesmo par numa cópia nova e no GitHub Actions. Sem a chave privada, `POST /api/auth/login` responde 503.

Gere outro par, se quiser, com `node scripts/generate-demo-tokens.mjs` depois de apagar os dois PEM. Não use estas chaves fora deste desafio.
