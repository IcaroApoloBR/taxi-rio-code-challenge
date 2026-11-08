# Coding Guidelines

## Princípios

- TypeScript strict; evitar `any`.
- Preferir soluções simples e explícitas.
- Separar domínio, aplicação, infraestrutura e transporte sem criar camadas vazias.
- Não duplicar regras de negócio entre controller, worker e UI.
- Validar entrada na borda; não confiar no cliente.
- Usar nomes de domínio consistentes em português ou inglês, sem misturar convenções arbitrariamente.

## API / NestJS

- Controllers cuidam de HTTP e delegam para serviços/use cases.
- DTOs validam e transformam entrada.
- Guards cuidam de autenticação/autorização por perfil.
- Regras de transição ficam em serviço de domínio.
- Repositórios encapsulam persistência.
- Erros de domínio são mapeados para HTTP de forma consistente.
- Configuração validada no bootstrap; falhar cedo se variável obrigatória estiver ausente.

## Worker

- Consumidor separado da API.
- Ack manual após persistência dos efeitos.
- Handler idempotente.
- Retry limitado e DLQ.
- Logs incluem event ID, correlation ID e trace context.
- Encerrar processo de forma graciosa, parando consumo e aguardando handlers em andamento dentro de limite razoável.

## React

- Componentes pequenos, com responsabilidades claras.
- Estados explícitos: loading, empty, success e error.
- Token não deve ser enviado em query string nem escrito em logs.
- UI não decide autorização; apenas apresenta ações compatíveis com o perfil.
- Polling com intervalo moderado e cleanup ao desmontar.
- Evitar abstrações de estado global se estado local/contexto for suficiente.

## Testes

- Testar comportamento e regras, não detalhes internos.
- Cobrir cenários negativos de autorização.
- Testar duplicidade e concorrência.
- Não depender de relógio real quando relógio controlável resolver.
- Usar fixtures de teste sem dados pessoais.

## Operação

- Logs JSON em stdout.
- Métricas sem IDs individuais como labels.
- Healthcheck de liveness separado de readiness quando necessário.
- Não engolir exceções silenciosamente.
- Não expor segredos ou dados sensíveis em traces/logs.
