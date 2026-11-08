# Segurança, JWT e Idempotência

## 1. JWT

### Escolha recomendada para o desafio
Usar JWT de demonstração pré-gerado, assinado com RS256, e validar a assinatura com chave pública carregada por configuração. Isso atende ao requisito de token estático e evita introduzir um serviço de identidade externo.

JWKS pode ser uma evolução, mas adiciona endpoint/discovery e rotação de chaves que não são essenciais para o fluxo mínimo.

### Validações obrigatórias
- Assinatura válida.
- Algoritmo explicitamente permitido (RS256).
- `iss` esperado.
- `aud` esperado.
- `exp` válido.
- `sub` presente.
- `role` dentro dos perfis aceitos.

Não confiar em `alg` escolhido livremente pelo token. Não registrar JWT completo em logs.

### Tokens de demonstração
Gerar tokens para:
- passageiro A;
- passageiro B;
- motorista A.

`POST /api/auth/login` emite outro JWT RS256, com as mesmas claims e validade de 8 horas, usando a chave privada local. Não substitui um provedor de identidade: as contas de demonstração ficam na memória do processo.

Chaves privadas e tokens de teste devem ser claramente identificados como locais/demonstração. Nunca usar chaves reais ou dados pessoais. A chave pública pode ser versionada se for explicitamente uma chave de teste; a privada pode ser gerada localmente por script e ignorada pelo Git.

## 2. Autorização

- Passageiro: `POST /corridas`, `POST /corridas/cotacao`, `GET /corridas`, `GET /corridas/:id` somente próprias, cancelamento das próprias e avaliação depois de `COMPLETED`.
- Motorista: `GET /corridas/disponiveis`, `GET /corridas/atribuida`, `PATCH /corridas/:id/status` e cancelamento da corrida que ele aceitou, antes de iniciar.
- Perfil não autorizado: `403`.
- Ausência ou invalidade de credencial: `401`.

Autorização por perfil não substitui autorização por recurso. A API também deve validar propriedade da corrida e vínculo com motorista.

## 3. Idempotência de criação

O cliente envia `Idempotency-Key` em `POST /corridas`.

A API calcula hash canônico do payload e registra chave + ator + hash + resposta na mesma transação da criação.

Comportamentos:
- Mesma chave, mesmo ator, mesmo payload: não cria duplicata; devolve a resposta armazenada.
- Mesma chave, payload diferente: `409 Conflict`.
- Mesma chave usada por outro ator: não compartilhar resultado; tratar como escopo independente ou conflito conforme a constraint adotada.

A constraint única no banco é a proteção final contra concorrência. Não depender apenas de memória ou cache.

## 4. Idempotência do Worker

RabbitMQ trabalha com entrega at-least-once: mensagens podem ser entregues novamente.

- Todo evento possui `eventId` estável.
- MongoDB tem índice unique em `eventId`.
- Persistência do histórico usa insert/upsert idempotente.
- Redis recebe atualização com versão; evento antigo não sobrescreve estado mais novo.
- A mensagem só recebe ack após os efeitos necessários serem confirmados.

Se o processamento falhar, não dar ack. Aplicar retry limitado e DLQ para evitar loop infinito.

## 5. Segredos e configuração

- Configuração por variáveis de ambiente.
- `.env` no `.gitignore`.
- `.env.example` somente com valores fictícios.
- Não colocar senha real em compose, logs ou README.
- Não expor portas administrativas desnecessariamente.
- Em ambiente local, credenciais de infraestrutura devem ser explicitamente de desenvolvimento.

## 6. Limites de segurança

Este é um exercício local, não uma avaliação de conformidade para produção. Não implementar alegações de segurança que não tenham sido verificadas. Documentar ausência de rate limiting, gestão real de identidade, rotação automatizada de chaves e política formal de retenção, se permanecerem fora do escopo.
