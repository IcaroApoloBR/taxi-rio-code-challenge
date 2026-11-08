# LIMITES

## Não implementado por decisão de escopo

- Parte 3 — Kubernetes, Helm, Kustomize, probes, requests/limits e KEDA.
- Matching real entre passageiros e motoristas.
- Geolocalização, mapas, rotas e cálculo de distância.
- Tarifação, bandeiras, descontos e pagamentos.
- Cancelamento e substituição automática de motorista.
- Chat, push notifications e integrações externas.
- Autenticação integrada a provedor real de identidade.
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
