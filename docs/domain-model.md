# Modelo de Domínio

## 1. Entidade Ride

Representa uma solicitação de corrida no escopo reduzido do desafio.

Campos sugeridos:
- `id`: UUID.
- `passengerId`: identificador do passageiro autenticado.
- `driverId`: identificador do motorista; inicialmente nulo.
- `status`: estado atual.
- `pickup`: origem textual simplificada.
- `destination`: destino textual simplificado.
- `createdAt`, `updatedAt`: timestamps UTC.
- `version`: inteiro incremental para controle de concorrência.

Não coletar endereço real ou dados pessoais além do estritamente necessário para a demonstração.

## 2. Estados

Estados mínimos:
- `REQUESTED`: corrida criada, aguardando motorista.
- `ACCEPTED`: motorista aceitou.
- `IN_PROGRESS`: corrida iniciada.
- `COMPLETED`: corrida finalizada.

Transições propostas:

```text
REQUESTED -> ACCEPTED -> IN_PROGRESS -> COMPLETED
```

Transições reversas e estados de cancelamento ficam fora do escopo inicial, salvo se o enunciado ou a implementação exigir explicitamente. Uma transição inválida deve retornar `409 Conflict`.

## 3. Regras de negócio

1. Toda corrida pertence a exatamente um passageiro.
2. Passageiro só pode criar e consultar as próprias corridas.
3. Somente motorista pode alterar status.
4. O primeiro motorista que aceitar uma corrida `REQUESTED` fica associado a ela.
5. Após associação, somente o motorista atribuído pode avançar o status.
6. A corrida só avança uma etapa por requisição.
7. Atualização concorrente deve ser protegida por transação/controle de versão.
8. Uma corrida concluída não pode ser alterada novamente.

A regra do primeiro motorista que aceita é uma simplificação necessária porque o desafio não define mecanismo de despacho ou atribuição de corrida.

## 4. Contrato de eventos

Envelope comum:

```json
{
  "eventId": "uuid",
  "eventType": "corrida.criada",
  "occurredAt": "2026-01-01T12:00:00.000Z",
  "correlationId": "uuid",
  "schemaVersion": 1,
  "payload": {}
}
```

### corrida.criada

Payload mínimo:
- `rideId`
- `passengerId`
- `status`
- `createdAt`

### corrida.status_alterado

Payload mínimo:
- `rideId`
- `passengerId`
- `driverId`
- `previousStatus`
- `status`
- `version`
- `updatedAt`

Não incluir JWT, segredo, endereço completo ou informação desnecessária no evento.

## 5. Persistência sugerida

### MySQL — `rides`
Armazena o estado atual da corrida.

### MySQL — `idempotency_records`
- `key` (unique)
- `actor_id`
- `request_hash`
- `response_status`
- `response_body`
- `created_at`

A chave deve ser vinculada ao ator e à operação. Reutilizar a mesma chave com payload diferente deve resultar em conflito.

### MySQL — `outbox_events`
- `id`
- `aggregate_id`
- `event_type`
- `payload`
- `correlation_id`
- `created_at`
- `published_at`
- `attempts`

### MongoDB — `ride_events`
- `eventId` com índice unique
- `rideId`
- `eventType`
- `occurredAt`
- `correlationId`
- `payload`
- `processedAt`

### Redis
Chave conceitual: `ride:{rideId}:status`, com status, versão e timestamp. Definir TTL explícito e documentado.

## 6. Concorrência

A aceitação deve ser atômica: atualizar somente se `status = REQUESTED` e `driver_id IS NULL`. Se duas requisições concorrentes tentarem aceitar, apenas uma deve vencer. A outra recebe `409 Conflict`.

Para atualizações subsequentes, validar `driverId` e a versão/estado atual no banco dentro de uma transação.
