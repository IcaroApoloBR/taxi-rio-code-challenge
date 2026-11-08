# Contexto de Produto — TAXI.RIO

## 1. Visão geral

O TAXI.RIO é uma solução pública de mobilidade urbana associada à Prefeitura do Rio de Janeiro. Seu propósito é conectar passageiros e taxistas, oferecendo uma experiência de solicitação de corridas com transparência tarifária, segurança e eficiência.

A IplanRio apresenta o TAXI.RIO como uma plataforma de mobilidade que conecta passageiros e taxistas e informa sua expansão para outros municípios. A página institucional também menciona adoção para corridas corporativas e evolução contínua da experiência.

Referências:
- https://www.iplan.rio/
- https://www.iplan.rio/produtos/taxi-rio

Os números e funcionalidades publicados no site institucional são contexto do produto, não requisitos deste desafio. O escopo implementável é exclusivamente o fluxo simplificado descrito no enunciado técnico.

## 2. Problema delimitado pelo desafio

Construir um serviço chamado `corridas` que permita:
1. Passageiro autenticado criar uma corrida.
2. Passageiro consultar apenas as próprias corridas.
3. Motorista autenticado aceitar e avançar o status de uma corrida.
4. Sistema propagar mudanças por eventos.
5. Worker registrar histórico e atualizar cache.
6. UI apresentar criação, listagem e acompanhamento de status.

## 3. Atores e permissões

### Passageiro
- Pode criar uma corrida.
- Pode consultar corridas próprias.
- Não pode alterar status.
- Não pode consultar corridas de outro passageiro.

### Motorista
- Pode alterar status de corrida conforme as regras de transição.
- Não pode criar corridas em nome de passageiros.
- Não deve alterar corridas já atribuídas a outro motorista.

### Operação / sistema
- API valida identidade, perfil e regras de negócio.
- Worker processa eventos de forma assíncrona.
- Infraestrutura fornece persistência, mensageria, cache e observabilidade.

## 4. Fora do escopo funcional

Não implementar neste desafio:
- Geolocalização real, mapas ou cálculo de rotas.
- Matching/distribuição automática de motoristas.
- Tarifação real, bandeiras ou cálculo de descontos.
- Pagamento, cartão, voucher ou faturamento.
- Chat, notificações push ou SMS.
- Agendamento de corridas.
- Integrações com serviços municipais externos.
- Aplicativos nativos Android/iOS.
- Painel administrativo completo.

Esses itens podem ser citados como possíveis evoluções, mas não devem competir com o fluxo principal.

## 5. Princípios de produto

- Transparência: status e falhas devem ser explícitos para o usuário.
- Segurança: cada ator só executa ações autorizadas.
- Confiabilidade: falhas de mensageria não podem apagar uma corrida já persistida.
- Rastreabilidade: uma corrida deve poder ser investigada por identificador e correlation ID.
- Simplicidade: UI funcional, sem investimento excessivo em design, pois o enunciado informa que design não será avaliado.
