# Observabilidade

## 1. Objetivo

Permitir responder:
- A API está recebendo requisições?
- Quanto tempo elas levam?
- Quantas falham?
- Eventos estão acumulando na fila?
- Uma corrida específica chegou ao Worker?
- O processamento falhou em qual etapa?

Observabilidade deve estar integrada ao fluxo principal, não adicionada apenas no encerramento.

## 2. Logs estruturados

Emitir JSON em stdout, com campos comuns:
- `timestamp`
- `level`
- `service` (`api` ou `worker`)
- `message`
- `correlation_id`
- `trace_id` e `span_id`, quando disponíveis
- `ride_id`, quando aplicável
- `event_id`, quando aplicável
- `duration_ms`, quando aplicável

Não registrar JWT, chave privada, senha, payload sensível ou dados pessoais desnecessários.

## 3. Propagação de contexto

- API recebe ou gera `correlation_id`.
- Incluir o identificador no contexto da requisição e nos logs.
- Gravar `correlation_id` no evento/outbox.
- Publicar headers de tracing/contexto no RabbitMQ.
- Worker extrai contexto e registra os mesmos IDs.
- OpenTelemetry deve propagar trace context (W3C Trace Context) entre API e Worker.

Correlation ID ajuda a correlacionar logs; trace ID representa a execução distribuída. Não confundir os dois.

## 4. Métricas Prometheus

Expor `/metrics` na API e no Worker.

Métricas mínimas:
- contador de requisições por método, rota normalizada e status;
- histograma de duração HTTP;
- contador de erros;
- contador de eventos processados/falhos por tipo;
- duração de processamento;
- tamanho da fila (ready/unacked);
- idade/atraso do evento mais antigo, se disponível.

Evitar labels de alta cardinalidade, como `ride_id`, `user_id`, URL com ID ou correlation ID. Esses dados pertencem aos logs/traces.

Nomes implementados:
- `http_requests_total{method,route,status}`
- `http_request_duration_seconds{method,route}`
- `http_request_errors_total{method,route}` para respostas 5xx
- `worker_events_processed_total{event_type,result}`
- `worker_events_failed_total{event_type,result}`
- `worker_event_processing_duration_seconds{event_type}`
- `rabbitmq_queue_messages_ready` e `rabbitmq_queue_messages_unacked`, com o label `queue`, coletadas em `http://rabbitmq:15692/metrics/per-object`. O endpoint `/metrics` desta imagem só publica o total agregado, sem o nome da fila.
- `rabbitmq_queue_head_message_timestamp{queue}`. Com a fila vazia o valor vem `NaN`, então a comparação de idade ignora essa série.
- `corridas_oldest_message_age_seconds`, idade do evento de outbox ainda não publicado. Cobre o atraso antes da mensagem existir no RabbitMQ.

A rota HTTP entra normalizada, como `/api/corridas/:id`. Identificadores de corrida, usuário e correlation ID ficam nos logs e nos spans.

## 5. Tracing

Usar OpenTelemetry SDK nos processos API e Worker e exportar traces via OTLP para Jaeger.

Trace esperado:
1. Span HTTP `POST /corridas`.
2. Span de persistência MySQL.
3. Span de publicação outbox/RabbitMQ.
4. Span de consumo da mensagem no Worker.
5. Span de gravação no MongoDB.
6. Span de atualização do Redis.

Como a mensagem é assíncrona, representar a relação entre spans com propagação de contexto e, quando adequado, links de span. Não simular uma chamada síncrona contínua se o processamento ocorreu depois da resposta HTTP.

## 6. Alertas

Os limiares são iniciais para ambiente local de demonstração e devem ser validados pelo teste de carga.

### Alerta A — APIHighErrorRate
Disparar se a proporção de respostas 5xx exceder 5% durante 5 minutos e houver pelo menos 20 requisições nesse período.

A expressão usa `http_request_errors_total` e `http_requests_total`.

### Alerta B — CorridasQueueBacklog
Disparar se a soma de `rabbitmq_queue_messages_ready` nas filas `corridas.history` e `corridas.status-cache` passar de 100 por 5 minutos, se a idade da mensagem no topo dessas filas passar de 60 segundos, ou se `corridas_oldest_message_age_seconds` passar de 60.

A profundidade e o timestamp vêm de `/metrics/per-object`. A idade do outbox cobre o evento que ainda não chegou na fila.

Os nomes finais das métricas e expressões devem refletir exatamente a instrumentação implementada. Entregar:
- `observability/alerts.yml` — regras Prometheus carregadas no Compose.
- `observability/alerts-prometheusrule.yaml` — mesmas regras em CRD PrometheusRule, mesmo que o CRD não seja aplicado localmente.

## 7. Prometheus e Jaeger

Prometheus deve coletar API, Worker e métricas do RabbitMQ. Jaeger deve receber traces via OTLP. README deve informar URLs locais e um roteiro simples para encontrar uma corrida pelo trace/correlation ID.

## 8. Evidência mínima

No README ou relatório:
- screenshot/descrição de `/targets` com targets UP;
- exemplo de consulta de métricas;
- exemplo de alerta avaliado;
- trace de uma corrida API → Worker;
- logs da mesma operação com correlation ID.
