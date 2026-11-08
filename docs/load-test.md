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
- Máquina/CPU/RAM:
- Docker/Compose:
- Configuração de VUs e duração:
- Commit testado:

### Resultado
- Total de requisições:
- Throughput:
- p50:
- p90:
- p95:
- Taxa de erro:
- Pico de mensagens na fila:
- Idade máxima observada:
- Falhas/limitações:

### Descobertas
Descrever gargalos observados com evidência. Não inferir que o banco, broker ou aplicação é o gargalo sem métrica que sustente a conclusão.

### O que mudaria
Relacionar cada mudança a um achado do teste. Ex.: ajustar índice, pool de conexão, concorrência do Worker ou cache, somente se os dados apontarem nessa direção.

## Cuidados

- Não usar credenciais reais.
- Não executar contra produção ou serviços públicos.
- Não gerar volume desnecessário.
- O script deve poder ser executado localmente e seus parâmetros devem estar documentados.
