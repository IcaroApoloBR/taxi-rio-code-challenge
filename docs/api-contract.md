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

A API valida assinatura RS256, emissor, audiência e expiração. O perfil vem de claim assinada; não aceitar role enviada no body das corridas.

### GET /auth/demonstracao

Público. Lista as contas fictícias já cadastradas, com e-mail, telefone, RATR e senha de demonstração.

### POST /auth/login

Público. Emite um JWT RS256 válido por 8 horas, assinado com a chave privada local.

Passageiro:

```json
{ "role": "passenger", "email": "ana@demo.taxi.rio", "phone": "(21) 98888-1001" }
```

Se o e-mail não existir, a conta é criada na memória do processo. Se existir e o telefone não conferir, `401`.

Motorista:

```json
{ "role": "driver", "ratr": "100001", "password": "demo-livre" }
```

RATR desconhecido ou senha incorreta: `401`. Não há autocadastro de motorista.

Resposta `200`: `accessToken`, `tokenType`, `expiresIn` e `profile`.

### GET /auth/me

**Acesso:** qualquer token válido. Devolve o perfil do `sub`.

Os tokens pré-gerados em `keys/demo-tokens.json` continuam válidos e correspondem a `passenger-a`, `passenger-b` e `driver-a`.

## POST /corridas

**Acesso:** passageiro.

Headers:
- `Authorization: Bearer <token>`
- `Idempotency-Key: <chave-unica>`

Body sugerido:

```json
{
  "pickup": "Maracanã",
  "destination": "Sambódromo Marquês de Sapucaí",
  "discountPercent": 10,
  "paymentMethod": "credit_card"
}
```

`discountPercent` aceita `0`, `10`, `20`, `30` ou `40`. `paymentMethod` aceita `credit_card`, `debit_card` ou `cash`. Os dois são opcionais e valem `0` e `credit_card` quando ausentes.

Sucesso: `201 Created`, com identificador, status, cotação ilustrativa (`distanceKm`, `durationMin`, `fareFlag`, `baseCents`, `amountCents`) e `createdAt`.

A cotação é determinística e serve para a interface. Não é tarifa oficial.

Repetição com a mesma chave, o mesmo ator e o mesmo payload: devolve a corrida original, sem criar outra. A chave considera origem, destino, desconto e pagamento.

Mesma chave com payload diferente: `409 Conflict`.

## POST /corridas/cotacao

**Acesso:** passageiro.

Devolve distância, tempo, bandeira e as cinco opções de desconto sem gravar corrida. `driversAvailable` é ilustrativo e vale 1.

## GET /corridas/disponiveis

**Acesso:** motorista.

Lista corridas `REQUESTED`, da mais antiga para a mais nova.

## GET /corridas/atribuida

**Acesso:** motorista.

Devolve a corrida `ACCEPTED` ou `IN_PROGRESS` daquele motorista. Sem corrida ativa: `404`.

Um motorista não aceita outra corrida enquanto tiver uma ativa: `409` com código `DRIVER_BUSY`.

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

A API valida transição, atribuição do motorista e concorrência. No aceite, copia nome, veículo, placa e avaliação do motorista para a corrida. Resposta `200 OK` com estado atualizado.

## POST /corridas/:id/cancel

**Acesso:** passageiro dono, em `REQUESTED` ou `ACCEPTED`; ou motorista atribuído, em `ACCEPTED`.

Status resultante: `CANCELLED`. Corrida de outro ator: `404`. Corrida já iniciada, concluída ou cancelada: `409`.

## POST /corridas/:id/avaliacao

**Acesso:** passageiro dono, somente com status `COMPLETED`.

```json
{ "score": 5, "comment": "Trajeto direto." }
```

`score` de 1 a 5. Comentário opcional, até 280 caracteres. Segunda avaliação: `409`.

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
