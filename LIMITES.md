# LIMITES

## Estado local atual

- As contas do login continuam na memória. Reiniciar a API apaga essas contas e não apaga as corridas do MySQL.
- Com `MYSQL_HOST` definido, corrida, idempotência e outbox ficam no MySQL. Sem `MYSQL_HOST`, os testes seguem em memória.
- O outbox publica `corrida.criada` e `corrida.status_alterado`. O Worker grava o histórico em `ride_events` no MongoDB e a projeção `ride:{id}:status` no Redis, com TTL de 300 segundos. Uma versão menor não substitui uma maior.
- O GET da corrida continua lendo o documento no MySQL. Se a projeção está ausente ou mais antiga, a API repõe o Redis a partir do MySQL.
- A fila de retry espera 5 segundos. Na quarta entrega da mesma fila a mensagem vai para `corridas.dead-letter`. JSON inválido vai direto para essa fila.
- Foi conferido o redelivery do mesmo `eventId`: o MongoDB manteve um único documento. O teste do Worker garante que uma falha do handler faz `nack` sem requeue e sem `ack`. Ainda não foi derrubado o processo entre gravar o efeito e o ack.
- Logs JSON da API e do Worker carregam `correlation_id`. O trace da corrida `c527cc71-640a-46c0-8b85-76dd56c3e6dc` liga o HTTP ao MySQL e, por `FOLLOWS_FROM`, a publicação ao consumo.
- O k6 local de 5 VUs por cerca de 40 s está em `docs/load-test.md`. Não representa produção.

## Não implementado por decisão de escopo

- Parte 3 — Kubernetes, Helm, Kustomize, probes, requests/limits e KEDA.
- Matching real entre passageiros e motoristas.
- Geolocalização e mapa real. A tela desenha um percurso ilustrativo.
- Tarifa oficial. A cotação muda com a origem e o destino. Dois trajetos de referência repetem os valores da tela; os demais saem de uma conta determinística sobre o texto. Não é a tarifa municipal.
- Substituição automática de motorista.
- Chat persistido, push notifications e integrações externas. As mensagens ficam só no navegador.
- Provedor real de identidade. O login local assina JWT com a chave privada de desenvolvimento e compara senhas de demonstração em texto.
- Deploy em cloud e alta disponibilidade.

## O que foi conferido

- O outbox só grava `published_at` depois do confirm do RabbitMQ. Uma falha de publicação deixa a linha pendente e o publicador tenta de novo.
- Uma falha do handler faz `nack` sem requeue e sem `ack`. JSON inválido e a quarta entrega vão para `corridas.dead-letter`.
- Uma versão menor não substitui a projeção do Redis. O teste compara a regra com o script Lua.
- Passageiro não lê corrida de outro passageiro, motorista não cria corrida, e dois motoristas não aceitam a mesma corrida.
- As métricas HTTP usam a rota do template. Não há `ride_id`, usuário nem URL crua como label.
- O k6 descreve só a máquina local e o cenário de `docs/load-test.md`.

Continua sem uma queda forçada do processo entre o insert no MongoDB e o ack. As credenciais do Compose são de desenvolvimento.

## O que faria com mais tempo

1. Política de retry/backoff mais completa e ferramenta simples de inspeção/reprocessamento da DLQ.
2. Testes de contrato para eventos.
3. Autenticação integrada a um provedor com rotação JWKS.
4. Melhorias de acessibilidade e internacionalização na UI.
5. Testes de resiliência com indisponibilidade temporária de Redis, MongoDB e RabbitMQ.
6. Deploy Kubernetes com probes, recursos, secrets e autoscaling do Worker.

## Parte 3

Não implementada. A decisão foi priorizar profundidade nas Partes 1 e 2 dentro do tempo sugerido pelo desafio, em vez de entregar manifestos Kubernetes sem domínio suficiente para explicar e validar as escolhas.
