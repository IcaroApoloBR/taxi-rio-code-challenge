# Teste de Carga — k6

## Objetivo

Avaliar comportamento básico da API sob carga controlada e registrar limites observados no ambiente local. O teste não pretende provar capacidade de produção.

## Cenário sugerido

- Endpoint principal: `POST /corridas`.
- Usuário: token de passageiro de teste.
- Cada iteração usa uma `Idempotency-Key` nova para representar uma nova solicitação.
- Cenário separado pode testar repetição da mesma chave para verificar idempotência.
- Validar respostas esperadas e taxa de erro.
- Usar ramp-up gradual, patamar curto e ramp-down.

## Métricas a observar

- Requisições por segundo.
- Latência p50, p90 e p95.
- Taxa de erro HTTP.
- Tempo de resposta da API.
- Profundidade/idade das filas RabbitMQ.
- Tempo de processamento do Worker.
- Recursos consumidos pelos containers, se disponíveis.

## Relatório — preencher após executar

### Ambiente
- Máquina/CPU/RAM: Intel Core i5-8265U @ 1.60 GHz, 4 núcleos, 8 processadores lógicos, 17020735488 bytes de RAM. O Docker Desktop limitava os containers a 7,681 GiB.
- Docker/Compose: cliente e engine 29.9.3, Compose v5.7.0. Imagem `grafana/k6` contra `http://host.docker.internal:3000`.
- Configuração de VUs e duração: sobe até 5 VUs em 10 s, segura 20 s e desce em 10 s. Cada iteração cria uma corrida da Ana com `Idempotency-Key` nova. O login acontece uma vez no `setup`.
- Commit testado: a execução foi em 2026-11-10, contra as imagens locais. O código medido é o de `f80f46c` a `b0d583f`.

### Resultado
- Total de requisições: 672 HTTP. 671 iterações de criação e 1 login.
- Throughput: 16,76 requisições/s no período todo, incluindo a rampa.
- p50: 22,6 ms (`med` do `http_req_duration`).
- p90: 52,06 ms.
- p95: 73,51 ms. Máximo 221,54 ms. Média 30,57 ms.
- Taxa de erro: 0,00% (0 de 672). Os 672 checks passaram.
- Pico de mensagens na fila: não ficou registrado por fila. Durante o teste o Prometheus ainda coletava o `/metrics` agregado, sem label `queue`. Logo depois, `corridas.history` e `corridas.status-cache` estavam com 0 prontas. O total agregado `rabbitmq_queue_messages_ready` estava em 1, que é a mensagem antiga de `corridas.dead-letter`. O contador agregado `rabbitmq_queue_messages_published_total` estava em 672.
- Idade máxima observada: `max_over_time(corridas_oldest_message_age_seconds[15m])` = 1,481 s.
- Falhas/limitações: uma amostra no meio do teste mostrou MongoDB a 96,53% de CPU e 267,1 MiB, API a 29,06% e 513,2 MiB, MySQL a 17,86% e 495,5 MiB, Worker a 17,49% e 124,8 MiB, RabbitMQ a 8,78% e 136,2 MiB, Redis a 10,48% e 18,24 MiB. É uma amostra, não uma média.

### Descobertas
Com 5 VUs a API respondeu sem erro e o p95 ficou em 73,51 ms. A criação grava MySQL e outbox; MongoDB e Redis entram depois, no Worker. A amostra de CPU do MongoDB foi a mais alta, mas essa amostra não mede a latência do `POST /api/corridas`. Não há dado para apontar o MongoDB como gargalo da resposta HTTP.

### O que mudaria
Nada neste volume. O próximo passo, se a carga subisse, seria repetir o teste com o scrape `/metrics/per-object` já ativo e comparar `worker_event_processing_duration_seconds` com a CPU do MongoDB. Só então faria sentido mexer em concorrência do Worker ou em índice.

## Cuidados

- Não usar credenciais reais.
- Não executar contra produção ou serviços públicos.
- Não gerar volume desnecessário.
- O script deve poder ser executado localmente e seus parâmetros devem estar documentados.
