# Chaves JWT locais

Esta pasta é reservada para chaves de demonstração geradas localmente.

- Não adicionar chave privada ao Git.
- A chave pública pode ser usada pela API depois que o módulo JWT for implementado.
- Gerar tokens de teste com claims `sub`, `role`, `iss`, `aud`, `iat` e `exp`.
- Não usar credenciais ou dados pessoais reais.

A API valida tokens RS256 com `keys/jwt-public.pem`. Gere os tokens com `node scripts/generate-demo-tokens.mjs`. A chave privada fica em `keys/jwt-private.pem` e não deve ser versionada. O `POST /api/auth/login` usa essa mesma chave para emitir um JWT de 8 horas. Sem ela, o login responde 503 e os tokens já gerados continuam podendo ser validados.
