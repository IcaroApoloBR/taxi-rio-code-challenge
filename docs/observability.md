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

Nomes sugeridos:
- `http_requests_total`
- `http_request_duration_seconds`
- `worker_events_processed_total`
- `worker_event_processing_duration_seconds`
- `rabbitmq_queue_messages_ready`
- `rabbitmq_queue_messages_unacked`
- `corridas_oldest_message_age_seconds`

A métrica de fila pode vir do endpoint Prometheus do RabbitMQ ou de exporter. Documentar a origem escolhida.

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

## 6. Alertas propostos

Os limiares são iniciais para ambiente local de demonstração e devem ser validados pelo teste de carga.

### Alerta A — APIHighErrorRate
Disparar se a proporção de respostas 5xx exceder 5% durante 5 minutos, com volume mínimo de requisições para evitar ruído.

Justificativa: falhas persistentes na API impedem criação e acompanhamento de corridas.

### Alerta B — CorridasQueueBacklog
Disparar se a fila de eventos acumular mais de 100 mensagens prontas por 5 minutos, ou se a idade da mensagem mais antiga superar 60 segundos.

Justificativa: backlog prolongado indica que o Worker não acompanha a taxa de publicação ou está falhando; isso aumenta a defasagem de histórico/cache.

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
