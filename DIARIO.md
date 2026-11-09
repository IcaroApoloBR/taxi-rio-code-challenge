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

### 2026-11-08 17:57 — Revisão do fluxo na interface
- **O que tentei:** conferir o caminho passageiro → motorista contra o enunciado e tirar o que escondia a ação.
- **O que aconteceu:** a API já cobria criar, listar só as próprias, aceitar e avançar. A lista da interface mostrava só corridas encerradas, e o motorista ocultava ofertas fora do desconto sem dizer por quê.
- **Como investiguei:** li o contrato e as telas. Ajustei a lista, o aviso do motorista, o foco visível e os botões principais fixos na base.
- **Aprendizado/decisão:** mapa, tarifa e chat continuam ilustrativos. O que a etapa entrega é o fluxo autenticado da corrida.

### 2026-11-09 15:19 — MySQL no código e Docker na máquina
- **O que tentei:** instalar WSL e Docker Desktop e passar a gravação da corrida para o MySQL.
- **O que aconteceu:** o winget instalou WSL 2.7.14 e Docker Desktop 4.99.0. O DISM devolveu 3010 nos recursos de virtualização. O cliente `docker` 29.9.3 existe em `Program Files`, mas o motor parou com `Virtual Machine Platform not enabled`. Os 15 testes da API continuaram verdes, ainda em memória.
- **Como investiguei:** o log `com.docker.backend.exe.log` registra `engine linux/wsl failed to start: checking preconditions: Virtual Machine Platform not enabled`.
- **Aprendizado/decisão:** a API usa MySQL só quando `MYSQL_HOST` existe; os testes não definem essa variável. O Compose fica para depois do reinício do Windows.

### 2026-11-09 16:10 — Compose no ar e corrida no MySQL
- **O que tentei:** depois do reinício, subir a stack e gravar uma corrida que sobrevivesse ao restart da API.
- **O que aconteceu:** o motor WSL do Docker ficou pronto. MySQL, Redis, MongoDB e RabbitMQ ficaram healthy. A primeira imagem da API quebrou porque o `node_modules` do Windows entrou no `COPY`. A criação da corrida também falhou ao gravar o JSON da idempotência como `[object Object]`.
- **Como investiguei:** o log do Nest mostrou `ER_INVALID_JSON_TEXT`. O `HEX(pickup)` de um pedido feito pelo Node veio `C3A3`, que é o `ã`. Depois do restart, `GET /api/corridas` devolveu a mesma corrida.
- **Aprendizado/decisão:** o corpo da idempotência entra com `CAST(? AS JSON)`. O management do RabbitMQ autenticou `local_rabbit`.

### 2026-11-09 16:50 — Outbox, histórico e projeção
- **O que tentei:** gravar o evento na mesma transação da corrida, publicar no RabbitMQ e fazer o Worker persistir MongoDB e Redis.
- **O que aconteceu:** a corrida `f52fcf9f-d9ad-4ebc-a21d-79e1cec391f0` saiu como `corrida.criada`, com correlation `corrida-outbox-check`, e o outbox ficou `published`. O aceite chegou ao Redis como versão 2 e `ACCEPTED`. O cancelamento foi para a versão 3. Republicar o mesmo evento manteve um documento no MongoDB. Um evento de versão 1 não voltou o status. O JSON inválido ficou em `corridas.dead-letter`. A fila `corridas.history` antiga, sem dead-letter, foi recriada na subida.
- **Como investiguei:** os 15 testes da API passaram sem `MYSQL_HOST`. No Compose, o Worker registrou `processed`, `duplicate` e `Invalid event; sending to DLQ`. O `rabbitmqctl list_queues` demorou e avisou timeout de 60 segundos, mas listou a DLQ com 1 mensagem.
- **Aprendizado/decisão:** o GET da corrida segue no MySQL e só repõe a projeção. A queda entre o efeito do Worker e o ack ainda não foi forçada.

## Observação

Uma linha por ocorrência é suficiente. O valor deste documento está em mostrar evidências do processo de investigação, inclusive erros e decisões revertidas.
