# Checkout administrativo — Fases 2B, 2C e 2D.1

A Fase 2D.1 acrescenta históricos somente leitura de vendas e caixas, sem edição ou correções financeiras. Contratos, permissões, paginação e proposta futura de destinação dos produtos estão em [Históricos do Checkout](checkout-history.md). O encerramento de uma comanda antes do pagamento agora usa descarte `VOIDED`, separado do cancelamento financeiro `CANCELED`.

## Bootstrap e interface (Fase 2C)

`GET /api/checkout/bootstrap` exige `checkout:sales`, sessão autenticada e tenant ativo. A identidade, o papel e o tenant vêm exclusivamente da sessão e são revalidados pelas funções existentes. A única query permitida é `customerQuery`; parâmetros de tenant, papel ou operador são rejeitados com 400. A resposta usa DTO explícito e `Cache-Control: private, no-store`.

O DTO contém `operator` (ID, nome, papel, vínculo profissional e permissões efetivas), `services` (ID, nome, preço em centavos, duração e categoria ativa), `packages` (ID, nome, preço, duração e serviços componentes ativos), `professionals` (ID, nome e IDs dos serviços habilitados), `products` (ID, nome, preço de venda e saldo disponível), `cashRegisters` (ID e nome), `openSessions` e `customers`. Todas as consultas são limitadas ao tenant e a registros ativos. Não são retornados objetos Prisma, e-mails, credenciais, tokens, dados PIX, custos, notas privadas ou comissões.

| Papel | Visibilidade e operações |
| --- | --- |
| BARBERSHOP_OWNER | Catálogo, profissionais ativos, caixas e sessões; venda, caixa, desconto e cancelamento conforme os endpoints existentes. |
| ASSISTANT | Catálogo, profissionais, caixas e sessões necessários às operações já permitidas; venda, descarte de comanda PENDING e caixa, sem desconto manual nem cancelamento financeiro. |
| BARBER | Serviços e combos habilitados para seu próprio vínculo, produtos e somente seu profissional; sessão com ID, ID do caixa e estado OPEN, sem valores ou dados do operador da abertura. Pode finalizar ou descartar somente seus próprios atendimentos; não movimenta caixa, aplica desconto ou cancela venda PAID. |

Para proprietário e assistente, a sessão aberta também inclui abertura, nome do operador e **saldo de abertura**. Esse valor não representa o saldo operacional corrente. O fechamento calcula no servidor o saldo esperado, contado e a diferença. A leitura do bootstrap não concede autorização para escrita; cada endpoint conserva sua autorização e validação transacional.

Clientes não são carregados sem termo. `customerQuery` aceita até 80 caracteres, normaliza Unicode NFKC e espaços e exige pelo menos dois caracteres após normalização. A busca por nome retorna no máximo 20 clientes ativos vinculados ao tenant, somente ID e nome. O estoque informado é uma fotografia; a finalização continua revalidando e debitando o saldo dentro da transação, podendo responder 409.

A interface fica em `/dashboard?view=checkout` e usa os endpoints transacionais da Fase 2B. O carrinho permanece editável antes da criação; depois de PENDING, itens, cliente, desconto e gorjeta ficam congelados. Totais no carrinho são estimativas; pagamentos usam exclusivamente o total devolvido pelo servidor. Dinheiro, PIX manual e cartões manuais permitem divisão do valor, confirmação individual e troco somente em dinheiro. Não há integração automática de pagamentos.

Cada tentativa mantém sua chave e seu corpo durante repetição. Enquanto há envio ou resposta incerta, os controles ficam bloqueados; a ação de repetição reutiliza a requisição original. Operações de caixa iguais, explicitamente iniciadas após confirmação, recebem novas chaves. Uma nova venda só começa após PAID, VOIDED ou CANCELED. O estado da tentativa é mantido em memória da tela; evite navegar ou recarregar durante uma operação sem confirmação. Há aviso de saída do navegador para venda pendente/resposta incerta e recuperação de uma venda conhecida por ID com GET autorizado. O histórico geral é somente leitura; não há persistência local de dados de clientes/pagamentos.

Limites desta fase: sem impressão ou emissão fiscal; sem provisionamento de caixa por esta tela; sem saldo operacional ao vivo. Testes de UI usam os componentes renderizados e o controlador real com transporte HTTP simulado; nenhum banco externo é acessado nas validações locais.

## Contratos transacionais preservados (Fase 2B)

Requer sessão administrativa e tenant ativo. O cliente não envia `barbershopId`, operador, preços ou snapshots. Respostas usam `Cache-Control: private, no-store`. Dinheiro em centavos inteiros, percentuais em pontos-base inteiros; limite monetário por total: 2.147.483.647 centavos.

Cada POST exige `Idempotency-Key` de 1–200 caracteres: letras ASCII, números, ponto, `_`, `:` ou `-`. Repetir a mesma chave/entrada/operador reproduz status e corpo da resposta original, inclusive após mudança de estado. Outro conteúdo ou operador recebe 409. A chave é independente por tenant e operação; nenhuma chave é consumida quando ocorre rollback. Após conflito transitório, repetir a mesma requisição/chave; após editar o conteúdo, usar outra chave.

| Método e caminho | Corpo ou query | Permissão |
| --- | --- | --- |
| POST `/api/checkout/cash-sessions/open` | `cashRegisterId`, `shift`, `openingBalanceCents` | OWNER, ASSISTANT |
| GET `/api/checkout/cash-sessions/current` | query obrigatória `cashRegisterId` | OWNER, ASSISTANT |
| POST `/api/checkout/cash-sessions/[id]/close` | `countedBalanceCents`, `notes?` | OWNER, ASSISTANT |
| POST `/api/checkout/cash-movements` | `cashSessionId`, `kind: SUPPLY ou WITHDRAWAL`, `amountCents`, `reason` | OWNER, ASSISTANT |
| POST `/api/checkout/sales` | `customerId?`, `items`, `discount?`, `tips?` | OWNER, ASSISTANT, BARBER próprio |
| GET `/api/checkout/sales/[id]` | ID no caminho | OWNER, ASSISTANT, BARBER próprio |
| PATCH `/api/checkout/sales/[id]` | `expectedVersion`, `customerId?`, `items`, `discount?`, `tips?` e `Idempotency-Key` | OWNER, ASSISTANT, BARBER próprio |
| POST `/api/checkout/sales/[id]/finalize` | `cashSessionId`, `expectedVersion`, `payments` | OWNER, ASSISTANT, BARBER próprio |
| POST `/api/checkout/sales/[id]/void` | `reason`, `expectedVersion` | OWNER, ASSISTANT, BARBER próprio |
| POST `/api/checkout/sales/[id]/cancel` | `reason`, `cashSessionId?` | OWNER |

OWNER significa `BARBERSHOP_OWNER`. BARBER precisa ter ao menos um componente de serviço e ser o profissional de todos os componentes/gorjetas da comanda. Só OWNER aplica desconto manual nesta fase, pois ainda não existe política configurável de desconto comum/especial.

### Edição antes da finalização

`PATCH` substitui a composição completa de uma comanda exclusivamente `PENDING`, retornando 200 com snapshots e totais oficiais. Exige `expectedVersion` inteiro e a mesma política de idempotência dos POSTs. Tenant e identidade vêm somente da sessão. O serviço bloqueia a venda antes de conferir versão/estado e revalida o escopo anterior e o proposto, cliente, catálogo ativo, profissionais, duração, composição, rateio e descontos na mesma transação Serializable.

Os snapshots anteriores de itens e gorjetas recebem `removedAt`, autor tenant-safe e motivo; componentes permanecem ligados ao item original. Novos snapshots representam a composição vigente. A edição incrementa `Sale.version` e registra antes/depois na auditoria imutável, sem criar pagamentos, movimentos de estoque/caixa ou comissão. Gorjetas nessa etapa são somente snapshots previstos. Não se pode salvar uma composição vazia: use o descarte. Comandas com desconto manual existente exigem proprietário para edição; assistente/barbeiro não podem removê-lo implicitamente.

A migration nova `20261024170000_checkout_pending_snapshots` mantém dados legados ativos (metadados de remoção nulos), DELETE proibido e imutabilidade após encerramento. A unicidade de gorjetas ativas é um índice parcial SQL; Prisma 6.6 não o representa em `@@unique`. Finalização, cancelamento, consultas, escopo profissional, histórico e Dashboard usam apenas snapshots ativos. Verificações de efeitos financeiros para editar/descartar continuam abrangendo também os retirados. Nenhuma migration anterior foi alterada e a nova migration não foi aplicada durante esta implementação.

Na interface, “Voltar e editar comanda” hidrata os snapshots atuais. “Cancelar alterações” abandona apenas o rascunho; “Salvar alterações e voltar ao pagamento” envia o PATCH. Preços de catálogo e totais são recalculados no servidor ao salvar; a prévia é identificada como estimada. Mudança de composição financeira ou total desconfirma os rascunhos de pagamento e mostra “Revisão necessária”. Valores manuais ficam visíveis para correção quando inválidos/excedentes; o último pagamento automático acompanha o restante. Confirmação manual e regras de dinheiro/troco permanecem obrigatórias. Respostas incertas repetem a mesma chave/payload; conflitos exigem revisar ou carregar explicitamente a versão atual, abandonando as alterações locais. GET de consulta e históricos permanecem disponíveis; a ação redundante “Consultar venda” saiu da comanda.

Os testes locais usam serviços reais com clientes injetados e adaptadores controlados de commit/rollback. Eles não comprovam execução das triggers, MVCC ou concorrência real do PostgreSQL. A migration ainda precisa dessa validação em banco descartável autorizado, separadamente.

Criação retorna 201 e a venda PENDING; venda anônima omite customerId. Itens aceitos:

```json
{
  "items": [
    { "kind": "SERVICE", "catalogId": "service-id", "professionalId": "professional-id", "quantity": 1 },
    { "kind": "PRODUCT", "catalogId": "product-id", "quantity": 2 },
    {
      "kind": "PACKAGE", "catalogId": "package-id", "quantity": 1,
      "components": [
        { "serviceId": "service-id", "professionalId": "professional-id" },
        { "serviceId": "beard-id", "professionalId": "professional-id" }
      ]
    }
  ],
  "discount": { "kind": "PERCENT", "basisPoints": 1000 },
  "tips": [{ "professionalId": "professional-id", "amountCents": 1000 }]
}
```

Alternativa de desconto: `{ "kind": "FIXED", "amountCents": 500 }`. Catálogo, cliente e profissionais precisam estar ativos e pertencer ao tenant. Cada profissional deve estar habilitado para seu serviço. A composição enviada de um combo deve corresponder exatamente ao catálogo, sem serviços duplicados. Preços, nomes, duração por unidade, profissionais, composição e comissão são preservados em cada snapshot. A edição PENDING cria novos snapshots vigentes, mantendo os anteriores retirados; após encerramento não podem mudar. Combo rateia seu preço pelos preços originais dos serviços; centavos restantes seguem a ordem persistida do catálogo. Desconto é rateado entre itens e componentes antes da comissão. Gorjeta fica fora da base. Catálogo sem duração positiva impede nova venda de serviço/combo; produto mantém null.

Finalização retorna 200. Exemplo de total R$ 127,00:

```json
{
  "cashSessionId": "open-cash-session-id",
  "expectedVersion": 0,
  "payments": [
    { "method": "PIX", "appliedCents": 7700, "confirmed": true },
    { "method": "CASH", "appliedCents": 5000, "cashReceivedCents": 6000, "confirmed": true }
  ]
}
```

Métodos: CASH, PIX, CREDIT_CARD e DEBIT_CARD. `confirmed: true` é obrigatório, representando confirmação manual; não há gateway. Valores aplicados precisam ser positivos e somar exatamente o total. CASH exige valor recebido igual ou maior ao aplicado; diferença é troco. Outros métodos não aceitam cashReceivedCents. Venda de total zero aceita payments vazio, mas exige caixa aberto. Ainda não há pagamento parcial pendente. Apenas a finalização baixa estoque e gera comissão. Mudança de catálogo depois da criação não recalcula a venda. Snapshot histórico de serviço sem duração impede finalização até resolução explícita fora desta API; não há backfill automático.

Venda/consulta/finalização/cancelamento retornam DTO com totais, versão, estado, datas, `items` (incluindo `durationMinutesSnapshot` e `components`), `tips` e `payments`. Não retornam credenciais, dados de sessão ou ator interno. O replay devolve o DTO original; GET permite consultar o estado atual. Consulta de caixa retorna `{ "session": ... }` ou `{ "session": null }`. Abertura, movimento e fechamento retornam o recurso diretamente; abertura/movimento têm status 201, demais 200.

Cancelamento aceita exclusivamente PAID, exige motivo e reverte o total integral, incluindo gorjeta. Para reembolsar CASH informe sessão aberta com saldo suficiente; pode ser diferente da sessão original fechada. PIX/cartões apenas recebem registro interno de reembolso manual; o sistema não chama adquirente nem devolve PIX automaticamente. O operador precisa realizar a devolução externa correspondente. Não há edição/exclusão de itens, estorno parcial ou reabertura de caixa nesta API.

## Descarte antes do pagamento

Antes da persistência, **Limpar comanda** somente limpa estado local, sem HTTP, com confirmação quando há itens. Depois de persistir, `POST /api/checkout/sales/[id]/void` aceita somente PENDING, exige `expectedVersion` e motivo de até 500 caracteres normalizado (Unicode NFKC, espaços e remoção de caracteres invisíveis). Tenant e identidade vêm da sessão; barbeiro deve ser o profissional de todos os componentes e gorjetas, com ao menos um atendimento próprio. A permissão é verificada no handler e no serviço.

`sale.void` usa o TransactionClient injetado, Serializable, lock da venda e atualização condicional de versão. Confere ausência de pagamentos, movimentos de estoque/caixa e comissões. Atualiza somente estado, versão e metadados de descarte; auditoria e idempotência são gravadas na mesma transação. Não há chamada ao cancelamento nem escrita de reversões. Itens, totais e gorjetas previstas permanecem como snapshots, sem representar receita ou repasse. Finalização e descarte disputam a mesma venda: uma operação vence, a outra recebe 409, sem efeitos parciais.

Os únicos fluxos financeiros são PENDING → PAID, PENDING → VOIDED e PAID → CANCELED. VOIDED e CANCELED são imutáveis. O DTO atual inclui `closureKind` (`VOIDED`, `CANCELED`, `LEGACY_VOIDED` ou null), `voidedAt`, `voidReason`, `voidedByName` e `canceledByName`, sem expor o ator interno. Replays antigos continuam devolvendo exatamente o JSON armazenado, sem acrescentar campos. GET consulta o DTO atual.

O rodapé fixo mostra **Descartar comanda** ao lado da ação principal de finalização; exige confirmação com motivo e informa que nenhuma movimentação financeira será realizada. VOIDED mostra motivo, autor, horário, itens/totais e **Nova venda**. As mensagens são:

- Criação: “Comanda criada. Confirme os pagamentos para finalizar.”
- Finalização: “Venda finalizada com sucesso.”
- Descarte: “Comanda descartada. Nenhuma movimentação financeira foi realizada.”
- Cancelamento financeiro: “Venda cancelada. Os lançamentos aplicáveis foram revertidos.”

Registros legados CANCELED com `finalizedAt` nulo não são atualizados. O backend os classifica como `LEGACY_VOIDED`; histórico e comanda exibem **Descartada (legado)**. VOIDED e legados não entram em receita nem na quantidade/valor de cancelamentos financeiros. O Dashboard exige finalização anterior para contar CANCELED. Respostas idempotentes legadas e metadados originais permanecem intactos.

O descarte depende de duas novas migrations consecutivas: `20261024160000_checkout_sale_voided_enum` contém exclusivamente a extensão do enum; `20261024160100_checkout_sale_voided_guards` acrescenta metadados, FK composta, índices, check e guards. Não devem ser combinadas: o enum precisa estar commitado antes de ser usado. As migrations anteriores permanecem intactas, sem backfill de legados. Nenhuma migration foi aplicada nesta entrega; a nova versão exige aplicação autorizada das duas antes do uso real.

Testes estáticos verificam os artefatos SQL; testes de serviços exercitam isolamento do cliente, rollback e disputa com adaptador controlado. Esses testes não comprovam locks, triggers ou MVCC no PostgreSQL real. A integração real exige validação posterior em banco descartável já migrado e explicitamente autorizado.

`tests/integration/checkout-void-postgres.test.ts` contém dois cenários reais opt-in, ignorados na suíte padrão. Exige `CHECKOUT_VOID_POSTGRES_URL` explícita para localhost/127.0.0.1 e confirmação `CHECKOUT_VOID_POSTGRES_CONFIRM=LOCAL_DISPOSABLE`, antes de importar Prisma ou construir clientes. Não aceita host externo nem fallback para DATABASE_URL. Usa dois clientes, transações independentes e consulta `pg_blocking_pids` para comprovar sobreposição; valida os dois vencedores possíveis, 409 do perdedor, ausência de efeitos parciais e replay. Não executa DDL, migrations ou seed. As fixtures próprias têm prefixo `CHECKOUT_VOID_TEST` e permanecem exclusivamente nesse banco local descartável, pois as triggers impedem exclusão do histórico. O banco local inteiro deve ser descartado após a validação. Nesta entrega os dois cenários reais não foram executados.

Erros retornam `{ "message": "..." }`: 400 entrada/pagamento inválido; 401 sem sessão; 403 papel/atendimento não autorizado; 404 recurso do tenant não encontrado; 409 estado, estoque, saldo, versão, chave ou concorrência conflitante; 413 corpo acima de 64 KiB; 422 cadastro/snapshot sem duração válida ou total fora do limite; 503 transação indisponível/timeout; 500 erro inesperado genérico. Não são expostos SQL, nomes de constraints ou detalhes do Prisma. Entradas têm limites de 100 itens, quantidade 100 por item, 1.000 componentes executáveis, 50 gorjetas e 20 pagamentos.

Na entrega da Fase 2B, a migration aditiva de duração não foi aplicada automaticamente. A disponibilização de cada versão exige aplicação das respectivas migrations por operação autorizada.

Na tradução de erros, códigos estruturados do Prisma têm prioridade. P2002/P2034 e P2010 com SQLSTATE 23505/40001/40P01 continuam 409 de conflito; P2003/P2004/P2025 e P2010 com 23503/23514 são 409 de integridade. P2010 com 23P01 (exclusion violation) também é 409. Os tratamentos existentes de 22003/55P03 estruturados permanecem; os timeouts conhecidos continuam 503.

O Prisma 6.6 apresentou CHECK violation 23514 como `PrismaClientUnknownRequestError` no ensaio descartável. Apenas nessa classe, a apresentação reconhece o envelope completo de erro PostgreSQL do conector (`ConnectorError` → `QueryError` → `PostgresError`), com o campo code no formato `"23514"` ou `SqlState(E23514)`. É exigido um único envelope com formato reconhecido; números soltos, SQL, JSON e mensagens arbitrárias não são usados para inferir SQLSTATE. Outros formatos falham de forma conservadora com 500.

| SQLSTATE no envelope reconhecido | Tratamento |
| --- | --- |
| 23514 — CHECK violation | 409, conflito com o estado dos dados |
| 23503 — foreign key violation | 409, mesmo tratamento de integridade |
| 23505 — unique violation | 409, conflito; repetir com a mesma chave/conteúdo |
| 23P01 — exclusion violation | 409, conflito de integridade |
| 40001 — serialization failure | 409, atualizar/repetir com a mesma chave/conteúdo |
| 40P01 — deadlock detected | 409, atualizar/repetir com a mesma chave/conteúdo |

Essa classificação adicional existe somente na apresentação HTTP: não altera `isConflict`, transações, retries ou leitura de resultado idempotente. O erro continua sendo propagado até o rollback antes da tradução. Todos os corpos usam somente mensagens estáticas: sem SQLSTATE, query, tabela, coluna, constraint ou stack. Erros desconhecidos fora desses casos continuam 500 com `{"message":"Erro interno do servidor."}`.
