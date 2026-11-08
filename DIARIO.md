# DIARIO

> Diário cronológico e informal. Acrescentar entradas reais durante o trabalho. Não inventar falhas, comandos ou investigações que não aconteceram.

## Modelo de registro

### AAAA-MM-DD HH:mm — Título curto
- **O que tentei:** ...
- **O que aconteceu:** ...
- **Como investiguei:** ...
- **Aprendizado/decisão:** ...

## Preparação
- [ ] Registrar criação do repositório e estrutura inicial.
- [ ] Registrar primeira subida do Docker Compose e eventuais problemas.
- [ ] Registrar implementação e validação de JWT/autorização.
- [ ] Registrar teste de idempotência HTTP.
- [ ] Registrar publicação/consumo RabbitMQ e teste de redelivery.
- [ ] Registrar implementação de logs, métricas e tracing.
- [ ] Registrar teste k6, resultado observado e mudança feita.
- [ ] Registrar validação final do README em ambiente limpo.

### 2026-11-08 16:50 — Boot do RabbitMQ
- **O que tentei:** tirar o `sh -c` que ligava o plugin Prometheus e chamar o entrypoint oficial com `rabbitmq-server`.
- **O que aconteceu:** o `docker` não está no PATH deste ambiente, então o management e a porta 15692 não foram exercitados.
- **Como investiguei:** li o `docker-entrypoint.sh` atual da imagem oficial. Ele não cria mais o usuário; só reduz o privilégio quando o comando começa com `rabbitmq`. `RABBITMQ_DEFAULT_USER` é lido pelo próprio broker. O `sh -c` anterior pulava essa redução de privilégio.
- **Aprendizado/decisão:** copiar `enabled_plugins` e então executar `docker-entrypoint.sh rabbitmq-server`. A issue ICA-5 permanece em andamento até o `whoami` do management passar.

### 2026-11-08 17:35 — Login JWT e fluxo nas telas de referência
- **O que tentei:** emitir JWT no `POST /api/auth/login`, deixar o motorista ver corridas sem colar o UUID e percorrer as telas de passageiro e motorista.
- **O que aconteceu:** `pnpm --filter @taxi/api test` passou 15 testes. No navegador, Ana entrou, pediu Maracanã → Sambódromo com 10% e cartão, Manuel aceitou, iniciou e finalizou. A guia do passageiro foi sozinha para o recibo de R$ 20,00, a avaliação voltou para a solicitação e o histórico mostrou a corrida.
- **Como investiguei:** o watch da API acusou um instante em que `cancel` ainda recebia `user.sub` depois que a assinatura passou a receber o ator. O arquivo foi salvo de novo e o Nest subiu com 0 erros.
- **Aprendizado/decisão:** o token emitido usa a mesma chave RS256 dos tokens prontos. Cotação, mapa e chat permanecem ilustrativos.

## Observação

Uma linha por ocorrência é suficiente. O valor deste documento está em mostrar evidências do processo de investigação, inclusive erros e decisões revertidas.
