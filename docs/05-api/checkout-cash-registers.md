# Administração de caixas físicos

Somente `BARBERSHOP_OWNER`, autenticado em tenant ativo, acessa a configuração em `/dashboard/configuracoes/caixa-pdv` e os endpoints abaixo. Assistentes e barbeiros continuam usando apenas os contratos de operação já autorizados. A sessão fornece identidade, papel e tenant; os payloads não aceitam esses campos.

- `GET /api/checkout/cash-registers`: `{ registers: [{ id, name, active, hasOpenSession, openSession: { id, status } | null }] }`. Inclui ativos e inativos do tenant. Sem saldos, dados pessoais ou campos internos.
- `POST /api/checkout/cash-registers`: `{ name }`, resposta 201 `{ id, name, active }`. Ativo por padrão. Não cria sessão, saldo ou movimento.
- `PATCH /api/checkout/cash-registers/[id]`: `{ name?, active? }`, ao menos um campo, resposta 200 `{ id, name, active }`.
- Não existe DELETE. Cadastros e sessões históricas são preservados.

POST/PATCH exigem `Idempotency-Key`. Replay do mesmo operador/conteúdo devolve o resultado anterior sem repetir cadastro ou auditoria; conteúdo diferente na mesma operação/chave retorna 409. Uma nova intenção deve usar nova chave. Os eventos são `cash_register.created`, `cash_register.renamed`, `cash_register.activated`, `cash_register.deactivated`, com ator e antes/depois; não vinculam venda fictícia.

Nomes usam trim, limite de 80 caracteres e rejeitam controles/caracteres invisíveis. A constraint existente `(barbershopId, name)` garante unicidade concorrente, sensível a maiúsculas/minúsculas conforme o banco atual. Conflitos de unicidade retornam 409 seguro, sem detalhes SQL.

O cadastro não possui version. Administração e abertura de sessão usam transação Serializable e o mesmo `SELECT ... FOR UPDATE` tenant-safe no CashRegister antes de validar estado. Uma sessão OPEN impede inativação; caixa inativo impede abertura. Conflitos transacionais retornam 409, sem repetição automática de trabalho financeiro. Atualizações parciais preservam campos não enviados. Fechamento, movimentos e totais mantêm seus contratos.

No Checkout sem caixa ativo, somente o proprietário recebe “Configurar caixas”. O diálogo usa a configuração real e recarrega bootstrap/seletor após criação/ativação, preservando a comanda. Abertura recusada com 409 atualiza os dados antes de apresentar o conflito. A página de Configurações também permite administrar caixas existentes. Históricos continuam consultando sessões de caixas inativos e podem exibir o nome atual; nenhum snapshot financeiro é reescrito.

Os testes automatizados usam mocks e um adaptador transacional controlado para rollback, idempotência e ordenação de comandos. Não substituem validação de locks/MVCC em PostgreSQL real. Nenhum banco externo ou migration é necessário para executar esses testes.
