# TAXI.RIO — Corridas

Starter de monorepo para o desafio técnico. A documentação de produto, domínio, arquitetura e decisões está em `docs/`, `DECISIONS.md`, `DIARIO.md` e `LIMITES.md`.

## Requisitos locais

- Docker Desktop ou Docker Engine com Compose.
- Node.js 22 e pnpm 9 (somente para desenvolvimento fora dos containers).

## Primeira execução

```bash
cp .env.example .env
docker compose up --build
```

Serviços:
- UI: http://localhost:5173
- API health: http://localhost:3000/api/health
- API metrics: http://localhost:3000/api/metrics
- Prometheus: http://localhost:9090
- RabbitMQ Management: http://localhost:15672
- Jaeger: http://localhost:16686

Credenciais locais do RabbitMQ: consultar `.env`. Todos os valores padrão são fictícios e exclusivos para desenvolvimento local. O arquivo `observability/rabbitmq/enabled_plugins` é copiado para dentro do container e o entrypoint oficial segue com `rabbitmq-server`, para o processo não permanecer como root. Usuário e senha vêm de `RABBITMQ_DEFAULT_USER` e `RABBITMQ_DEFAULT_PASS`, lidos pelo RabbitMQ na primeira inicialização do volume.

## Execução local sem Docker

A API desta etapa guarda as corridas em memória. Reiniciar o processo apaga os dados. MySQL, RabbitMQ e o Worker ficam para quando o Docker estiver disponível.

```bash
node scripts/generate-demo-tokens.mjs
pnpm --filter @taxi/api start:dev
pnpm --filter @taxi/web dev
```

- API: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs
- UI: http://localhost:5173

Os tokens de demonstração ficam em `keys/demo-tokens.json`. A chave privada não entra no Git.

## Estado atual do starter

Esta base fornece:
- Monorepo pnpm.
- Compose com MySQL, Redis, MongoDB, RabbitMQ, API, Worker, UI, Prometheus e Jaeger.
- Endpoint de health da API, métricas básicas de runtime e corridas em memória, com JWT, idempotência e Swagger.
- Worker conectado à exchange/fila de eventos (consumo demonstrativo).
- UI de passageiro e motorista, no formato das telas de referência, contra a API local.
- Login local que emite JWT RS256. Contas de demonstração: `ana@demo.taxi.rio` / `(21) 98888-1001` e RATR `100001` / `demo-livre`. Há também Bruno (`bruno@demo.taxi.rio`, `(21) 98888-1002`) e o motorista RATR `100002`.

## Testar o fluxo

Abra a UI em uma aba como passageiro e em outra como motorista. Cada aba guarda o próprio token.

1. Passageiro: preencher a conta de demonstração, entrar, manter Maracanã → Sambódromo e tocar em Avançar.
2. Escolher um desconto e a forma de pagamento. OK cria a corrida.
3. Motorista: entrar com RATR `100001`. Com o status Livre, a corrida aparece se o desconto pedido for menor ou igual ao máximo do motorista e o pagamento estiver aceito. Cartão de débito começa desligado; dinheiro permanece obrigatório.
4. Aceitar, iniciar e finalizar. O passageiro acompanha sozinho e avalia no final.
5. O histórico fica no menu do passageiro. Cancelar só funciona antes da corrida começar.

No Swagger (`/api/docs`), o mesmo caminho está descrito no topo da página:

1. `GET /api/auth/demonstracao`
2. `POST /api/auth/login` e Authorize com o `accessToken`
3. `POST /api/corridas/cotacao` e `POST /api/corridas` com `Idempotency-Key`
4. Trocar o token pelo do motorista
5. `GET /api/corridas/disponiveis` e `PATCH /api/corridas/{id}/status` na ordem `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`
6. Voltar ao passageiro e chamar `POST /api/corridas/{id}/avaliacao`

Para o caminho negativo, use `POST /api/corridas/{id}/cancel` enquanto o status for `REQUESTED` ou `ACCEPTED`. Um segundo motorista (`100002`) recebe `409` se tentar avançar a corrida do primeiro. O mesmo motorista recebe `409` com código `DRIVER_BUSY` se aceitar outra corrida antes de encerrar a atual.
- Workflow inicial de CI.

Ainda NÃO implementa o fluxo completo do desafio:
- Persistência de corridas no MySQL.
- Transactional Outbox e publicação confiável.
- Histórico MongoDB e projeção Redis.
- Tracing distribuído real.
- Métricas de negócio/latência/erros/fila exigidas.
- Testes de integração e k6.

O `ack` do Worker atual é provisório e deve ser substituído por processamento persistente idempotente antes de considerar o fluxo concluído.

## Próximas etapas

Siga `docs/implementation-plan.md`. Não trate o starter como solução final. Atualize `DECISIONS.md`, `DIARIO.md` e `LIMITES.md` com fatos observados durante o desenvolvimento.
