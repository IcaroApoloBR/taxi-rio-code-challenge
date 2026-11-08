# Testes e CI

## 1. Estratégia

Priorizar testes que protejam regras de negócio e integração entre componentes. Não perseguir cobertura de 100%.

## 2. Cenários mínimos obrigatórios

### Autenticação/autorização
1. Sem token: `401`.
2. Token inválido/expirado: `401`.
3. Passageiro cria corrida: `201`.
4. Passageiro lista apenas próprias corridas.
5. Passageiro tenta alterar status: `403`.
6. Motorista altera status: `200`.
7. Motorista tenta criar corrida: `403`.
8. Passageiro A tenta ler corrida do passageiro B: `404` ou `403`, conforme decisão documentada.

### Idempotência
9. Repetir POST com mesma `Idempotency-Key` e payload não cria segunda corrida.
10. Reutilizar chave com payload diferente retorna conflito.

### Worker
11. Evento válido é persistido no MongoDB e status atualizado no Redis.
12. Entregar o mesmo evento duas vezes não duplica histórico nem regrede status.
13. Falha transitória não confirma a mensagem prematuramente.
14. Mensagem irrecuperável chega à DLQ conforme política.

### Fluxo integrado
15. Passageiro cria corrida; evento é publicado; Worker processa; histórico e cache são atualizados; UI/API consegue consultar a corrida.

## 3. Tipos de teste

- Unitário: máquina de estados, validações, autorização e idempotência.
- Integração: repositórios MySQL, Redis, MongoDB e publicação/consumo RabbitMQ.
- E2E: fluxo HTTP com JWT e infraestrutura de teste.
- UI: teste mínimo dos estados essenciais, se houver tempo.

## 4. CI — GitHub Actions

Em push e pull request:
1. Instalar dependências com lockfile.
2. Lint.
3. Testes.
4. Build TypeScript/UI.
5. Build das imagens Docker.

Não exigir credenciais reais. Se os testes de integração usarem serviços, subir dependências como services/containers no workflow ou executar Compose de teste.

## 5. Critério de qualidade

- Testes determinísticos.
- Dados isolados por teste.
- Limpeza de recursos após execução.
- Nenhum teste depende de serviço externo público.
- Falhas devem apontar claramente qual regra foi violada.
