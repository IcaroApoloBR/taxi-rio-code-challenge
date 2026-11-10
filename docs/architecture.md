# Arquitetura

## 1. Objetivo arquitetural

Implementar o menor sistema distribuído que satisfaça o fluxo exigido, mantendo responsabilidades explícitas e permitindo explicar cada componente. Evitar microserviços adicionais ou abstrações sem necessidade.

## 2. Componentes

### UI — React + TypeScript
- Aplicação web independente.
- Envia JWT no header `Authorization: Bearer <token>`.
- Permite inserir/selecionar token de demonstração.
- Cria corrida, lista corridas do passageiro e atualiza status exibido por polling simples.
- Não é responsável por aplicar autorização: a API é a autoridade.

### API — NestJS + TypeScript
- Expõe endpoints REST.
- Valida JWT e perfil.
- Aplica regras de negócio e transições de status.
- Persiste corridas e registros de idempotência no MySQL.
- Registra evento de domínio/outbox na mesma transação da alteração de negócio.
- Expõe `/health`, `/metrics` e endpoints funcionais.

### MySQL
- Fonte da verdade para corridas, estado atual, idempotência e outbox.
- Transações protegem gravações relacionadas.
- Índices devem atender consultas por passageiro e data/status.

### RabbitMQ
- Transporta eventos de domínio de forma assíncrona.
- Exchange recomendado: `corridas.events` (tipo `topic`, durável).
- Filas duráveis independentes para histórico e cache.
- Dead-letter exchange/fila para mensagens que excederem a política de retry.

### Worker — Node.js + TypeScript
- Processo independente da API.
- Consome eventos.
- Persiste histórico no MongoDB.
- Atualiza cache de status no Redis.
- Implementa confirmação manual (ack) após concluir o processamento.
- É idempotente diante de redelivery.

### Redis
- Cache de leitura do status atual.
- Cache não é fonte da verdade.
- Deve ser possível reconstruir o status consultando MySQL se a chave não existir ou estiver desatualizada.

### MongoDB
- Armazena histórico/auditoria de eventos processados.
- Não substitui o estado transacional atual no MySQL.
- Cada evento possui identificador único para evitar duplicação lógica.

## 3. Fluxo de criação

1. UI envia `POST /corridas`, JWT e `Idempotency-Key`.
2. API valida JWT, perfil de passageiro e payload.
3. API abre transação MySQL.
4. API verifica a chave de idempotência e o hash do payload.
5. API cria corrida e registro outbox na mesma transação.
6. API confirma a transação e responde com a corrida.
7. Publicador outbox envia `corrida.criada` ao RabbitMQ.
8. Worker consome evento e grava histórico no MongoDB.
9. O worker confirma a mensagem somente após persistência bem-sucedida.

A resposta HTTP não deve depender de o Worker terminar o histórico. A corrida já está persistida; o processamento assíncrono pode ocorrer depois.

## 4. Fluxo de alteração de status

1. Motorista autenticado envia `PATCH /corridas/:id/status`.
2. API valida perfil, transição permitida e vínculo/atribuição do motorista.
3. API atualiza o estado no MySQL e grava evento outbox na mesma transação.
4. Publicador envia `corrida.status_alterado`.
5. Worker grava histórico no MongoDB e atualiza Redis.
6. A UI consulta `GET /corridas/:id` a cada 3 segundos. A API lê a corrida no MySQL. Se a projeção do Redis falta ou está mais antiga, a API a repõe. Se a projeção está mais nova, status, motorista, versão e atualização vêm dela.

## 5. Transactional Outbox

### Problema
Uma gravação no MySQL e uma publicação no RabbitMQ são duas operações independentes. Se a primeira funcionar e a segunda falhar, o estado pode mudar sem que o evento seja publicado.

### Abordagem
Gravar a alteração de negócio e o evento pendente na mesma transação MySQL. Um publicador lê registros pendentes, publica no RabbitMQ e marca como publicados após confirmação do broker.

### Trade-offs
- Acrescenta uma tabela e um processo de publicação.
- Evita depender de dual-write não atômico.
- Pode publicar novamente se cair entre a confirmação do broker e a marcação no banco; por isso consumidores precisam ser idempotentes.

## 6. Topologia RabbitMQ

- Exchange: `corridas.events` (`topic`, durable).
- Routing keys:
  - `corrida.criada`
  - `corrida.status_alterado`
- Queue `corridas.history`: recebe ambos os eventos para histórico.
- Queue `corridas.status-cache`: recebe `corrida.status_alterado`.
- DLX: `corridas.dlx`.
- DLQ: `corridas.dead-letter`.

A separação de filas permite que a falha de um consumidor não bloqueie o outro. Cada fila tem a própria retry, com TTL de 5 segundos, para um retry do histórico não voltar à fila de status. Na quarta entrega da mesma fila, ou quando o JSON é inválido, a mensagem vai para `corridas.dead-letter`. A topologia está repetida em `apps/api/src/rides/rabbit-topology.ts` e `apps/worker/src/topology.ts` e os dois arquivos precisam permanecer iguais.

## 7. Consistência e leitura

- MySQL é a fonte da verdade.
- Redis é uma projeção/cache eventualmente consistente.
- MongoDB é trilha de eventos/auditoria, não o estado atual autoritativo.
- A API deve definir claramente se o GET prioriza cache ou banco. Em cache miss, consultar MySQL e repopular Redis.
- Para evitar que eventos antigos sobrescrevam estado novo no Redis, guardar `version` ou `updatedAt` e só aplicar atualização mais recente.

## 8. Diagrama de dependências

```text
React UI
   |
   | HTTP + JWT
   v
NestJS API -------> MySQL
   |                  |
   |                  +-- rides
   |                  +-- idempotency_records
   |                  +-- outbox_events
   |
   +-- Outbox Publisher --> RabbitMQ
                               |
                 +-------------+-------------+
                 |                           |
                 v                           v
          History Worker              Status Worker
                 |                           |
                 v                           v
              MongoDB                      Redis

API + Worker + RabbitMQ --> Prometheus
API + Worker ------------> OpenTelemetry --> Jaeger
```

## 9. Decisões fechadas na implementação

- API e Worker não compartilham um pacote de eventos. O envelope e a topologia estão duplicados de propósito, para cada processo subir sozinho.
- O retry espera 5 segundos. A quarta entrega da mesma fila vai para a DLQ. Não há backoff crescente.
- A projeção `ride:{id}:status` expira em 300 segundos.
- Passageiro e motorista consultam a API a cada 3 segundos e limpam o intervalo ao sair da tela.
- Não há política de retenção além do que MySQL, MongoDB e o volume local guardam. Logs saem em stdout.
