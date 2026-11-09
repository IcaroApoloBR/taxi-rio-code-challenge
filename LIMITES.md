# LIMITES

## Estado local atual

- As contas do login continuam na memória. Reiniciar a API apaga essas contas e não apaga as corridas do MySQL.
- Com `MYSQL_HOST` definido, corrida, idempotência e outbox ficam no MySQL. Sem `MYSQL_HOST`, os testes seguem em memória.
- O outbox publica `corrida.criada` e `corrida.status_alterado`. O Worker grava o histórico em `ride_events` no MongoDB e a projeção `ride:{id}:status` no Redis, com TTL de 300 segundos. Uma versão menor não substitui uma maior.
- O GET da corrida continua lendo o documento no MySQL. Se a projeção está ausente ou mais antiga, a API repõe o Redis a partir do MySQL.
- A fila de retry espera 5 segundos. Na quarta entrega da mesma fila a mensagem vai para `corridas.dead-letter`. JSON inválido vai direto para essa fila.
- Foi conferido o redelivery do mesmo `eventId`: o MongoDB manteve um único documento. Ainda não foi forçada uma queda do Worker entre gravar o efeito e o ack.

## Não implementado por decisão de escopo

- Parte 3 — Kubernetes, Helm, Kustomize, probes, requests/limits e KEDA.
- Matching real entre passageiros e motoristas.
- Geolocalização e mapa real. A tela desenha um percurso ilustrativo.
- Tarifa oficial. A API devolve uma estimativa fixa para a demonstração.
- Substituição automática de motorista.
- Chat persistido, push notifications e integrações externas. As mensagens ficam só no navegador.
- Provedor real de identidade. O login local assina JWT com a chave privada de desenvolvimento e compara senhas de demonstração em texto.
- Deploy em cloud e alta disponibilidade.

## Riscos que devem ser avaliados

- **Outbox publisher:** confirmar que falhas e reinícios não deixam eventos permanentemente pendentes.
- **Redelivery:** validar comportamento sob falha entre efeitos do consumidor e ack.
- **Consistência do cache:** eventos fora de ordem não podem regredir versão do status.
- **Autorização por recurso:** perfil válido não significa acesso a qualquer corrida.
- **Observabilidade:** métricas precisam evitar labels de alta cardinalidade.
- **DLQ:** mensagens mortas precisam ser identificáveis e passíveis de inspeção.
- **Segredos:** credenciais locais são apenas de desenvolvimento e não representam gestão de segredo de produção.
- **Carga:** resultados do k6 representam somente o ambiente local e o cenário descrito no relatório.

## O que faria com mais tempo

1. Política de retry/backoff mais completa e ferramenta simples de inspeção/reprocessamento da DLQ.
2. Testes concorrentes de aceitação de corrida e idempotência.
3. Testes de contrato para eventos.
4. Autenticação integrada a um provedor com rotação JWKS.
5. Melhorias de acessibilidade e internacionalização na UI.
6. Testes de resiliência com indisponibilidade temporária de Redis, MongoDB e RabbitMQ.
7. Deploy Kubernetes com probes, recursos, secrets e autoscaling do Worker.

## Parte 3

Não implementada. A decisão foi priorizar profundidade nas Partes 1 e 2 dentro do tempo sugerido pelo desafio, em vez de entregar manifestos Kubernetes sem domínio suficiente para explicar e validar as escolhas.
