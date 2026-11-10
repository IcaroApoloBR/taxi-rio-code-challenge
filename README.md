# TAXI.RIO — Corridas

Serviço de corridas do desafio técnico. O passageiro pede, o motorista aceita e avança o status, e o Worker registra o histórico. Tudo sobe com Docker Compose. Quem for avaliar precisa de Docker Desktop ou Docker Engine com Compose.

O registro do trabalho está em quatro arquivos:

| Arquivo | O que contém |
| --- | --- |
| `DECISIONS.md` | As oito decisões fechadas, inclusive a fila que começa sem mensagem |
| `DIARIO.md` | O que foi observado de fato, com identificadores |
| `LIMITES.md` | O que ficou de fora e o que foi conferido |
| `docs/architecture.md` | Fluxo, persistência, topologia e leitura da corrida |

## Como subir

Na raiz do repositório:

```bash
cp .env.example .env
docker compose up --build
```

A primeira subida constrói API, Worker e UI. As contas de login ficam na memória do processo da API. Corrida, idempotência e outbox vão para o MySQL. Os valores do `.env.example` são fictícios e servem só para esta máquina.

| Serviço | Endereço | Para que serve |
| --- | --- | --- |
| Interface | http://localhost:5173 | Fluxo de passageiro e motorista |
| Swagger | http://localhost:3000/api/docs | Os mesmos passos pela API |
| Health | http://localhost:3000/api/health | Processo da API no ar |
| Métricas da API | http://localhost:3000/api/metrics | Prometheus da API |
| Métricas do Worker | http://localhost:9101/metrics | Prometheus do Worker |
| Prometheus | http://localhost:9090 | Consultas e alertas em `/alerts` |
| Jaeger | http://localhost:16686 | Trace da API até o Worker |
| RabbitMQ | http://localhost:15672 | Filas. Usuário `local_rabbit`, senha `local_rabbit_password` |

As outras senhas locais estão no `.env.example`: MySQL `corridas` / `local_corridas_password`, Redis `local_redis_password`, Mongo `local_admin` / `local_mongo_password`.

## Contas de demonstração

O botão **Preencher conta de demonstração** já coloca a primeira conta. `GET /api/auth/demonstracao` lista as mesmas.

| Papel | Acesso | Senha / telefone |
| --- | --- | --- |
| Passageira Ana | `ana@demo.taxi.rio` | `(21) 98888-1001` |
| Passageiro Bruno | `bruno@demo.taxi.rio` | `(21) 98888-1002` |
| Motorista | RATR `100001` | `demo-livre` |
| Segundo motorista | RATR `100002` | `demo-livre` |

Um e-mail novo no login de passageiro cria uma conta na memória do processo. Reiniciar a API apaga essas contas novas. Ana, Bruno e os dois motoristas voltam com o processo.

## Testar na interface

Abra http://localhost:5173 em duas abas, ou em uma janela anônima para a segunda. Cada aba guarda o próprio token.

1. Na primeira aba, preencha a conta da Ana e entre.
2. Mantenha Maracanã → Sambódromo Marquês de Sapucaí e toque em **Avançar**. A cotação vem de `POST /api/corridas/cotacao`.
3. Escolha um desconto e a forma de pagamento. **OK** cria a corrida.
4. Na segunda aba, entre como motorista com o RATR `100001`. Com o status **Livre**, a oferta aparece quando o desconto pedido cabe no máximo do motorista e a forma de pagamento está aceita. Cartão de débito começa desligado. Dinheiro permanece obrigatório.
5. **Aceitar**, **Iniciar corrida** e **Finalizar corrida**. A aba da Ana acompanha sozinha, com atualização a cada 3 segundos, e pede a avaliação no fim.
6. **Minhas corridas**, no menu da Ana, lista o histórico dela. **Cancelar** só vale enquanto a corrida está pedida ou aceita, antes de começar.

![Login da passageira](docs/screenshots/01-login-passageiro.png)

![Pedido com origem e destino](docs/screenshots/03-passageiro-pedido.png)

![Cotação, desconto e pagamento](docs/screenshots/04-cotacao.png)

![Corrida aguardando um motorista](docs/screenshots/02-passageiro-aguardando.png)

![Oferta na tela do motorista](docs/screenshots/05-motorista-oferta.png)

Dois caminhos que devem falhar de propósito:

- O motorista `100002` recebe `409` se tentar avançar a corrida que o `100001` já aceitou.
- O mesmo motorista recebe `409` com código `DRIVER_BUSY` se aceitar uma segunda corrida antes de encerrar a atual.

A tarifa muda com a origem e o destino. Há duas rotas de referência e, para os outros endereços, uma estimativa determinística. Os valores são de demonstração, não a tarifa oficial do município.

## Testar no Swagger

Abra http://localhost:3000/api/docs. O topo da página repete o fluxo. O login devolve HTTP 200 e um JWT RS256, com emissor `taxi-rio-local` e audiência `taxi-rio-api`, válido por 8 horas.

1. `GET /api/auth/demonstracao` para ver as contas.
2. `POST /api/auth/login` como passageiro. Copie o `accessToken` e use **Authorize**.
3. `POST /api/corridas/cotacao` e depois `POST /api/corridas` com o header `Idempotency-Key`.
4. `POST /api/auth/login` como motorista e troque o token em **Authorize**.
5. `GET /api/corridas/disponiveis` e `PATCH /api/corridas/{id}/status` na ordem `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`.
6. Volte ao token da Ana: `GET /api/corridas/{id}` e `POST /api/corridas/{id}/avaliacao`.

Sem token, ou com token inválido, a API responde `401`. Passageiro não muda status. Motorista não cria corrida nem lê a de outro passageiro. Esses casos respondem `403`. A mesma `Idempotency-Key` com o mesmo corpo devolve a corrida original. A mesma chave com outro corpo responde `409` e código `IDEMPOTENCY_CONFLICT`. A chave vale para quem a enviou.

![Swagger com o fluxo e as operações](docs/screenshots/06-swagger.png)

## Acompanhar uma corrida

O header `X-Correlation-Id` da resposta é o valor que aparece nos logs. Ele é diferente do `trace_id`.

1. Crie a corrida e guarde o header e o `trace_id` do log JSON da API (`docker compose logs api`).
2. No Jaeger, serviço `api`, abra o span `POST /api/corridas` pelo atributo `correlation_id`.
3. O span `mysql ride transaction` é filho desse HTTP. O span `publish outbox event` abre outro trace e aponta para a transação com `FOLLOWS_FROM`.
4. No serviço `worker`, o span `consume corridas.history` aponta para a publicação com `FOLLOWS_FROM`. A gravação no MongoDB é filha do consumo. O Redis entra no mesmo desenho quando o evento é `corrida.status_alterado`.

Exemplo observado em 2026-11-10: corrida `c527cc71-640a-46c0-8b85-76dd56c3e6dc`, correlation `corrida-trace-link`, trace HTTP `ec4607b4019a5faafd8cfe20302a1998`. O log da API trouxe esse `trace_id`. O Worker registrou o mesmo `correlationId`.

Os logs são JSON na saída padrão, com `correlation_id`, `trace_id` e `span_id`. As métricas da API são `http_requests_total`, `http_request_duration_seconds`, `http_request_errors_total` e `corridas_oldest_message_age_seconds`. As do Worker são `worker_events_processed_total`, `worker_events_failed_total` e `worker_event_processing_duration_seconds`. O rótulo de rota é o template, sem identificador da corrida.

O Prometheus carrega quatro regras de `observability/alerts.yml`. As duas regras do desafio são `APIHighErrorRate` (mais de 5% de erro HTTP por 5 minutos, com pelo menos 20 pedidos) e `CorridasQueueBacklog` (mais de 100 mensagens prontas, mensagem do topo acima de 60 segundos, ou evento no outbox sem publicar há mais de 60 segundos). `ApiTargetDown` e `WorkerTargetDown` avisam se o scrape cair. O mesmo grupo está em `observability/alerts-prometheusrule.yaml` para um Prometheus Operator. O Alertmanager não faz parte desta entrega. Um teste de 40 segundos não dispara uma regra com `for: 5m`.

![Regras carregadas no Prometheus](docs/screenshots/07-prometheus-alertas.png)

O detalhe das métricas, do scrape por fila e dos traces está em `docs/observability.md`.

## Testes e carga

Na raiz, com Node.js 22 e pnpm 9.15.4, e sem `MYSQL_HOST`, `REDIS_HOST`, `RABBITMQ_URL` nem `MONGO_URL` no ambiente:

```bash
pnpm install
pnpm lint
pnpm test
```

Os testes usam os repositórios em memória. O workflow `.github/workflows/ci.yml` instala, roda lint e testes, e constrói as imagens da API, do Worker e da UI.

O k6 está em `load/create-ride.js`. Com a API no ar:

```bash
docker run --rm \
  -e API_BASE_URL=http://host.docker.internal:3000 \
  -v "$PWD/load:/scripts" \
  grafana/k6 run /scripts/create-ride.js
```

No Git Bash, o destino `/scripts` pode ser reescrito pelo shell. Nesse caso, prefixe o comando com `MSYS_NO_PATHCONV=1`. A execução de 2026-11-10 fez 672 requisições, 0% de erro e p95 de 73,51 ms. O relatório completo está em `docs/load-test.md`. O esboço do desafio chama essa pasta de `loadtest/`. Aqui o script é `load/create-ride.js`.

## Tecnologias

| Peça | Versão usada |
| --- | --- |
| Node.js nas imagens | 22 |
| pnpm | 9.15.4 |
| API | NestJS 10, TypeScript, JWT RS256 |
| Interface | React 18, Vite 6 |
| Worker | Node, consumidor RabbitMQ com ack manual |
| MySQL | 8.4, fonte das corridas, da idempotência e do outbox |
| Redis | 7.4, projeção de status com versão |
| MongoDB | 8, histórico de eventos |
| RabbitMQ | 4, exchanges, retry e DLQ |
| Métricas | Prometheus, regras em `observability/` |
| Trace | OpenTelemetry, export OTLP para o Jaeger |
| Carga | k6 |
| CI | GitHub Actions |

A interface fala só com a API. Quem pode criar, ler ou mudar uma corrida é decidido no servidor.

## Mapa do repositório

O esboço do desafio cita `api/`, `worker/` e `ui/`. Neste monorepo os mesmos três serviços estão em `apps/api`, `apps/worker` e `apps/web`.

| Caminho | Conteúdo |
| --- | --- |
| `docker-compose.yml` | API, Worker, UI, MySQL, Redis, MongoDB, RabbitMQ, Prometheus e Jaeger |
| `apps/api` | HTTP, JWT, corridas, outbox e métricas |
| `apps/worker` | Consumo, MongoDB, Redis e DLQ |
| `apps/web` | Telas de passageiro e motorista |
| `observability/` | Scrape, alertas e o mesmo grupo em `PrometheusRule` |
| `load/create-ride.js` | Cenário curto de k6 |
| `docs/` | Arquitetura, observação, carga e as capturas |
| `.github/workflows/ci.yml` | Lint, teste e build das imagens |

A parte 3, Kubernetes, ficou de fora de propósito. A decisão está em `DECISIONS.md` (D-006), o limite em `LIMITES.md` e o registro em [ICA-13](https://linear.app/icaroapolo/issue/ICA-13/deixar-kubernetes-fora-desta-entrega). Não há manifesto vazio no repositório.

## Links

- Repositório: https://github.com/IcaroApoloBR/taxi-rio-code-challenge
- Actions: https://github.com/IcaroApoloBR/taxi-rio-code-challenge/actions
- [ICA-6](https://linear.app/icaroapolo/issue/ICA-6/preparar-o-repositorio-e-o-registro-de-decisoes) repositório e decisões
- [ICA-7](https://linear.app/icaroapolo/issue/ICA-7/proteger-o-fluxo-de-corrida-com-jwt-e-idempotencia) JWT e idempotência
- [ICA-8](https://linear.app/icaroapolo/issue/ICA-8/operar-o-fluxo-pelas-telas-de-passageiro-e-motorista) telas
- [ICA-9](https://linear.app/icaroapolo/issue/ICA-9/validar-a-subida-do-compose) Compose
- [ICA-10](https://linear.app/icaroapolo/issue/ICA-10/persistir-corridas-e-idempotencia-no-mysql) MySQL
- [ICA-11](https://linear.app/icaroapolo/issue/ICA-11/publicar-eventos-com-outbox-e-worker-idempotente) outbox e Worker
- [ICA-12](https://linear.app/icaroapolo/issue/ICA-12/cobrir-falhas-ci-e-a-observacao-do-fluxo) testes, CI e observação
- Swagger local: http://localhost:3000/api/docs
- Alertas locais: http://localhost:9090/alerts
- Jaeger local: http://localhost:16686

O plano que orientou a entrega está em `docs/implementation-plan.md`. Ele já foi executado.

## Declaração de uso de IA

Usei o Cursor, com o agente de código, para implementar a API, o Worker, a interface, a observação, os testes e esta documentação. As decisões e os limites foram revisados contra o que a aplicação faz de fato.

Uma sugestão foi recusada: tratar o consumo do Worker como filho do span HTTP. O processamento acontece depois da resposta, então a publicação e o consumo abrem traces próprios e se ligam com `FOLLOWS_FROM`.

Outra saída foi corrigida depois de conferida no Jaeger. Sem o gerenciador de contexto assíncrono, cada span saía num trace separado. A correção foi instalar `@opentelemetry/context-async-hooks` e chamar `AsyncLocalStorageContextManager`. O construtor de `BatchSpanProcessor` desta versão também recebe um único objeto `{ exporter, scheduledDelayMillis }`, e o scrape do RabbitMQ passou de `/metrics` para `/metrics/per-object` porque o endpoint agregado não traz o nome da fila.

## Fora desta entrega

A apresentação em vídeo, de até 10 minutos, ainda precisa ser gravada por quem entrega o desafio. O roteiro desta página cobre o que o vídeo precisa mostrar: subir o Compose, fazer a corrida nas duas telas, mostrar o `401`/`403` e a idempotência, e abrir um trace no Jaeger.

Kubernetes, mapa real, tarifa oficial, pagamento real, chat e geolocalização permanecem ilustrativos. O detalhe está em `LIMITES.md`.
