# DECISIONS

> Registro vivo. Manter de 3 a 8 decisões relevantes, com fatos observados durante a implementação. Não registrar como executado algo que ainda é apenas proposta.

## D-001 — MySQL como fonte da verdade
- **Contexto:** estado atual e transacional das corridas precisa ser consistente.
- **Alternativas:** MySQL, MongoDB como banco principal, ou Redis.
- **Escolha:** MySQL para corridas e operações transacionais; MongoDB para histórico; Redis como cache.
- **Trade-off:** mais de uma tecnologia para operar, mas responsabilidades e garantias ficam claras.

## D-002 — Transactional Outbox
- **Contexto:** persistência no banco e publicação no broker não são uma transação única.
- **Alternativas:** publicar diretamente após salvar; publicar antes de salvar; usar outbox.
- **Escolha:** persistir corrida e evento outbox na mesma transação; publicar assincronamente.
- **Trade-off:** processo/tabela adicional e possível publicação repetida; consumidores idempotentes tratam redelivery.

## D-003 — Idempotência no banco e no consumidor
- **Contexto:** cliente pode repetir POST e RabbitMQ pode redeliver eventos.
- **Alternativas:** controlar somente em memória, Redis ou banco.
- **Escolha:** chave única e hash de request no MySQL; `eventId` único no MongoDB; atualização versionada no Redis.
- **Trade-off:** mais metadados e constraints, com proteção consistente contra duplicidade.

## D-004 — JWT estático RS256 para demonstração
- **Contexto:** requisito pede token estático pré-gerado + JWKS ou chave pública.
- **Alternativas:** serviço de identidade/JWKS completo ou chave pública local.
- **Escolha:** validar tokens de teste RS256 com chave pública configurada.
- **Trade-off:** sem rotação/discovery automatizados; reduz dependências e atende ao escopo.

## D-005 — RabbitMQ ou outro broker em um sistema novo?
- **Contexto:** o desafio define RabbitMQ, mas pede opinião sobre a escolha se o sistema começasse do zero.
- **Alternativas:** RabbitMQ, Kafka, Redis Streams, NATS JetStream ou SQS (se a plataforma fosse cloud específica).
- **Escolha para este desafio:** RabbitMQ, pois é requisito explícito e atende bem a filas de trabalho, roteamento por tópicos, ack, retry e DLQ.
- **Escolha hipotética do zero:** manteria RabbitMQ para um fluxo de comandos/eventos de negócio com volume moderado, necessidade de roteamento e processamento assíncrono. Consideraria Kafka se houvesse necessidade dominante de replay de grandes volumes, retenção longa, múltiplos consumidores independentes e streaming/event log em escala. Consideraria NATS JetStream para uma plataforma que priorizasse simplicidade operacional e baixa latência. A decisão dependeria de throughput, retenção, ordenação, operação da equipe e infraestrutura já existente.
- **Trade-off:** RabbitMQ é adequado ao padrão de fila de trabalho, mas não deve ser tratado automaticamente como event store durável de longo prazo.

## D-006 — Parte 3 fora do escopo
- **Contexto:** tempo limitado e ausência de experiência prática suficiente com Kubernetes.
- **Alternativas:** implementar manifestos superficiais ou concentrar a entrega nas Partes 1 e 2.
- **Escolha:** não implementar Kubernetes; priorizar fundação sólida e operação demonstrável.
- **Trade-off:** não demonstrar experiência de cluster, mas evitar uma entrega superficial e preservar a qualidade do core.

## D-007 — UI deliberadamente simples
- **Contexto:** o enunciado informa que design não será avaliado.
- **Alternativas:** reproduzir aplicativo completo ou construir interface mínima para exercitar API.
- **Escolha:** UI web funcional com login/token, criação, listagem e acompanhamento.
- **Trade-off:** menor fidelidade visual, maior tempo dedicado à arquitetura, segurança e observabilidade.

## D-008 — Cache-aside com proteção de versão
- **Contexto:** Redis deve acelerar leitura, mas não pode se tornar fonte da verdade.
- **Alternativas:** cache-aside, write-through ou leitura exclusiva do Redis.
- **Escolha:** cache-aside; Worker atualiza projeção de status com versão; API consulta MySQL em cache miss.
- **Trade-off:** consistência eventual entre MySQL e Redis; leitura pode observar breve atraso após alteração.
