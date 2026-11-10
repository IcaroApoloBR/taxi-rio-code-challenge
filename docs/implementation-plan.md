# Plano de Implementação

Este plano foi executado. Para subir a stack e julgar o fluxo, use o README. Kubernetes ficou de fora, como registram a D-006 e `LIMITES.md`.

## Princípio de priorização

O tempo sugerido pelo avaliador é de 6 a 8 horas. O objetivo não é construir uma plataforma de produção completa; é entregar um recorte coeso, executável e explicável.

Não gastar tempo em design elaborado, Kubernetes, geolocalização, matching, pagamentos ou integrações externas.

## Sequência sugerida

### Etapa 0 — Preparação (30 min)
- Criar repositório e estrutura.
- Definir package manager e convenções.
- Criar `.env.example`, `.gitignore` e primeiro commit.
- Registrar decisões iniciais.

### Etapa 1 — Fundação local (45–60 min)
- Docker Compose para MySQL, Redis, MongoDB e RabbitMQ.
- Healthchecks e volumes.
- API, Worker e UI como serviços separados.
- Validar que `docker compose up --build` inicia a stack.

### Etapa 2 — Domínio e API (90 min)
- Modelo Ride e transições.
- JWT RS256 com chave pública de teste.
- Guards de autenticação/perfil.
- POST, GET list/detail e PATCH status.
- Isolamento por passageiro e motorista atribuído.
- Idempotência no MySQL.

### Etapa 3 — Eventos e Worker (75–90 min)
- Outbox transacional.
- Exchange, filas, routing keys e DLQ.
- Worker com ack manual.
- Persistência idempotente no MongoDB.
- Atualização versionada do Redis.
- Teste de redelivery.

### Etapa 4 — UI funcional (45–60 min)
- Entrada de token.
- Criar corrida.
- Listar corridas próprias.
- Consultar status e atualizar visualização.
- Estados loading, vazio e erro.
- Sem polimento visual além do necessário.

### Etapa 5 — Testes e CI (45–60 min)
- Testes de regras e fluxo feliz.
- Dois ou mais cenários de falha.
- Workflow lint/test/build.
- Validar build das imagens.

### Etapa 6 — Operação (90–120 min)
- Logs JSON e correlation ID.
- Métricas API/Worker/RabbitMQ.
- Prometheus + Jaeger + propagação de trace.
- Dois alertas.
- Script k6 e relatório curto.

### Etapa 7 — Fechamento (30 min)
- README copiável e validado do zero.
- Atualizar DECISIONS, DIARIO e LIMITES.
- Revisar commits e evidências.
- Preparar roteiro de demonstração.

## Ordem de corte se o tempo estourar

1. Preservar API, regras, persistência e autorização.
2. Preservar idempotência e processamento duplicado.
3. Preservar testes e Compose reproduzível.
4. Preservar métricas e logs.
5. Implementar tracing ponta a ponta.
6. Implementar k6 e relatório simples.
7. Não implementar Kubernetes.

Não remover silenciosamente requisito: registrar qualquer item não concluído em `LIMITES.md`.

## Critério de pronto

O projeto está pronto quando uma pessoa avaliadora consegue subir a stack com comandos documentados, executar o fluxo passageiro → motorista → Worker, reproduzir os cenários de segurança/idempotência, observar métricas/logs/trace e entender as decisões sem explicação externa.
