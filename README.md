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

Credenciais locais do RabbitMQ: consultar `.env`. Todos os valores padrão são fictícios e exclusivos para desenvolvimento local.

## Estado atual do starter

Esta base fornece:
- Monorepo pnpm.
- Compose com MySQL, Redis, MongoDB, RabbitMQ, API, Worker, UI, Prometheus e Jaeger.
- Endpoint de health da API e métricas básicas de runtime.
- Worker conectado à exchange/fila de eventos (consumo demonstrativo).
- UI inicial com verificação de conectividade.
- Workflow inicial de CI.

Ainda NÃO implementa o fluxo completo do desafio:
- JWT e autorização por perfil.
- Persistência de corridas no MySQL.
- Idempotência HTTP.
- Transactional Outbox e publicação confiável.
- Histórico MongoDB e projeção Redis.
- Tracing distribuído real.
- Métricas de negócio/latência/erros/fila exigidas.
- Testes de integração e k6.

O `ack` do Worker atual é provisório e deve ser substituído por processamento persistente idempotente antes de considerar o fluxo concluído.

## Próximas etapas

Siga `docs/implementation-plan.md`. Não trate o starter como solução final. Atualize `DECISIONS.md`, `DIARIO.md` e `LIMITES.md` com fatos observados durante o desenvolvimento.
