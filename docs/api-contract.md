# Contrato da API

> Contrato inicial proposto. Ajustar nomes/campos à implementação final e manter este documento sincronizado com os DTOs e testes.

## Convenções

- Base path: `/api` ou `/` — escolher um e manter consistente.
- JSON em requests/responses.
- Datas em ISO 8601 UTC.
- IDs UUID.
- JWT no header `Authorization: Bearer <token>`.
- Respostas de erro com formato consistente.

## Autenticação e autorização

Claims esperadas:
- `sub`: ID do ator.
- `role`: `passenger` ou `driver`.
- `iss`, `aud`, `iat`, `exp`.

A API valida assinatura, emissor, audiência e expiração. O perfil vem de claim assinada; não aceitar role enviada no body.

## POST /corridas

**Acesso:** passageiro.

Headers:
- `Authorization: Bearer <token>`
- `Idempotency-Key: <chave-unica>`

Body sugerido:

```json
{
  "pickup": "Origem de demonstração",
  "destination": "Destino de demonstração"
}
```

Sucesso: `201 Created`, com `id`, `status`, `createdAt`.

Repetição com mesma chave e mesmo payload: retornar resposta original ou resultado equivalente documentado, sem criar outra corrida.

Mesma chave com payload diferente: `409 Conflict`.

## GET /corridas

**Acesso:** passageiro.

Retorna somente corridas cujo `passengerId` corresponda ao `sub` do token. Não aceitar `passengerId` arbitrário como mecanismo de autorização.

## GET /corridas/:id

**Acesso:** passageiro proprietário da corrida. A API consulta Redis primeiro e usa MySQL em cache miss. A autorização de propriedade deve ser validada de forma segura; não permitir que o cache contorne autorização.

## PATCH /corridas/:id/status

**Acesso:** motorista.

Body:

```json
{
  "status": "ACCEPTED"
}
```

Status permitidos: `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`.

A API valida transição, atribuição do motorista e concorrência. Resposta `200 OK` com estado atualizado.

## Códigos HTTP mínimos

| Situação | Código |
|---|---:|
| Requisição válida | 200/201 |
| Sem token | 401 |
| Token inválido/expirado | 401 |
| Perfil sem permissão | 403 |
| Corrida inexistente ou não acessível | 404 |
| Transição inválida/conflito de versão | 409 |
| Payload inválido | 400 ou 422 |
| Erro inesperado | 500 |

Para evitar enumeração de recursos, decidir se corrida de outro passageiro retorna `404` em vez de `403`; documentar e testar a escolha.

## Erro padronizado

```json
{
  "statusCode": 409,
  "code": "RIDE_STATUS_CONFLICT",
  "message": "A corrida não pode avançar a partir do status atual.",
  "correlationId": "uuid"
}
```

Nunca retornar stack trace, token, segredo ou detalhes internos ao cliente.
