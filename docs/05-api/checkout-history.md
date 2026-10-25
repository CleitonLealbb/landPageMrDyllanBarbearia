# Checkout — Fase 2D.1: históricos somente leitura

Implementa consultas e conferência sem criar correções, editar PENDING, alterar pagamentos ou reverter movimentos. Nenhuma mudança de schema é necessária para esta subfase.

## Contratos

Todos os endpoints exigem sessão autenticada, tenant ativo e vínculo revalidado. Tenant, papel e operador vêm exclusivamente da sessão. Respostas privadas com `Cache-Control: private, no-store`; erros seguem o tradutor existente.

| Endpoint | Resposta |
| --- | --- |
| GET `/api/checkout/sales` | Página de vendas com cliente mínimo, profissionais históricos, estado, datas, quantidade e total original. |
| GET `/api/checkout/sales/[id]` | Contrato anterior preservado. |
| GET `/api/checkout/sales/[id]?include=history` | Contrato complementar com operador, cliente atual, caixa mínimo, cancelamento, estoque, pagamentos, gorjetas e, conforme papel, comissão e auditoria. |
| GET `/api/checkout/cash-sessions` | Página de sessões abertas/fechadas, inclusive de caixas inativos e dias anteriores. |
| GET `/api/checkout/cash-sessions/[id]` | Abertura/fechamento originais, totais da sessão inteira, saldo calculado e página dos movimentos. |

Nenhum POST/PATCH/DELETE foi acrescentado. O histórico não consome chave de idempotência, cria ator/auditoria ou altera dados. Leituras relacionadas usam o cliente injetado em transação `RepeatableRead`, com timeout de 20 segundos e espera de 5 segundos; um TransactionClient injetado continua pertencendo ao chamador.

## Permissões

- BARBERSHOP_OWNER: vendas e caixas do tenant; comissão, auditoria resumida e notas do caixa.
- ASSISTANT: vendas e caixas do tenant; sem comissão interna, auditoria ou notas privadas da sessão na resposta complementar.
- BARBER: somente vendas com pelo menos um componente próprio e todos os componentes/gorjetas pertencentes ao seu vínculo. Vendas com profissionais mistos não são disponibilizadas. Sem consulta de caixas, movimentos financeiros de caixa, comissão interna ou auditoria nesta API complementar.

O GET individual sem `include=history` conserva a projeção e as permissões anteriores. DTOs novos não expõem objetos Prisma, tenant, credenciais, e-mail, custo de produto, dados PIX, metadados arbitrários de auditoria ou identificadores de atores internos. IDs de recursos são usados como referências de navegação, nunca como nomes visíveis.

## Filtros e paginação

Listagens aceitam `period` com os presets do Dashboard: today, yesterday, week, month, previousMonth, year e custom. O padrão é month. custom exige start/end em YYYY-MM-DD; limite de 366 dias. Limites financeiros usam meia-noite local da barbearia, início inclusivo e fim exclusivo, inclusive em transições de horário de verão.

- `status`: estados de venda ou OPEN/CLOSED para sessões. Em vendas, VOIDED seleciona comandas descartadas e inclui os legados CANCELED sem finalizedAt; CANCELED seleciona exclusivamente cancelamentos financeiros com finalização anterior.
- `customerId`, `professionalId`: referências opcionais, sempre subordinadas ao tenant.
- `customerQuery`, `professionalQuery`: nome normalizado com NFKC/espaços, entre 2 e 80 caracteres. Cliente usa cadastro atual; profissional usa snapshot histórico. Incluem vínculos históricos inativos, sem carregar toda a base de clientes.
- Vendas: `dateField=createdAt|finalizedAt|voidedAt|canceledAt`, padrão createdAt; `cashSessionId` opcional. A data voidedAt considera canceledAt somente para descartes legados, sem alterar seus dados originais.
- Sessões: `dateField=openedAt|closedAt`, padrão openedAt; `cashRegisterId` opcional. Filtros de cliente/profissional localizam sessões por vendas ou reversões vinculadas. O detalhe sempre confere a sessão inteira, não apenas o subconjunto filtrado.

Query desconhecida, duplicada, estado/data/cursor inválido ou identidade/tenant fornecido pelo cliente é rejeitada. O barbeiro não pode selecionar outro professionalId.

`pageSize` padrão 20, máximo 50. Paginação por cursor em ordem decrescente de createdAt/id para vendas e movimentos, openedAt/id para sessões. O campo de referência filtra o período; não altera essa ordenação estável. Retorno: items, pageSize, hasMore, nextCursor e period. Não há contagem total estimada nem paginação por offset.

O cursor inclui data e desempate por ID, com fingerprint dos filtros, operador, papel, tenant e recurso. Não depende da existência posterior da linha. Alterar filtros exige reiniciar a paginação; o cliente trata o cursor como opaco. Cada página é uma nova fotografia de leitura; não se promete uma fotografia única para toda a navegação de um caixa aberto.

No detalhe de caixa, apenas pageSize/cursor são aceitos e paginam movimentos. Totais e saldo são calculados a partir de todos os movimentos da sessão. Fechamento esperado, contado e diferença originais não são regravados. Auditoria complementar de venda exibe no máximo 50 eventos recentes, com indicador de existência de mais eventos.

## Interface

Áreas Nova venda, Histórico de vendas e, para papéis autorizados, Histórico de caixas na tela existente `/dashboard?view=checkout`. O controlador da venda permanece montado ao navegar: carrinho, pagamentos e intenção idempotente não são reinicializados. Históricos oferecem filtros, páginas, atualização, estados de carregamento/erro/vazio e detalhes somente leitura. A venda vinculada a um movimento pode ser consultada a partir da conferência do caixa.

Não existem botões de edição, correção, reclassificação, ajuste, cancelamento ou reabertura nesses detalhes. Layout e componentes usam os tokens do design system existente.

## Descarte e cancelamento financeiro

Listas e detalhes retornam a classificação de domínio `closureKind`: VOIDED, CANCELED, LEGACY_VOIDED ou null. VOIDED é exibida como “Descartada”; CANCELED com finalizedAt nulo é LEGACY_VOIDED, exibida como “Descartada (legado)”. O status, os metadados originais e as respostas idempotentes armazenadas dos legados permanecem intactos. A leitura não migra nem corrige registros.

O descarte exibe motivo, autor e horário disponíveis e preserva os itens e totais originais somente para auditoria. Não representa receita ou cancelamento financeiro. O Dashboard consulta exclusivamente PAID por finalizedAt para receita e CANCELED com finalizedAt não nulo por canceledAt para cancelamentos; a comparação usa a mesma regra. Nenhum descarte é deduzido ou somado novamente como estorno financeiro.

Não se confirma reembolso externo de PIX/cartão/dinheiro, recuperação de comissão/gorjeta já repassada ou destino físico de produtos com base apenas nos lançamentos internos. Uma reversão de estoque legada é exibida como alteração de saldo, não como prova de devolução física.

## Complemento obrigatório do plano de estoque — não implementado

O cancelamento atual percorre todos os produtos e restaura o estoque no serviço `cancellation.ts`. Não existe trigger que devolva automaticamente o saldo: a trigger `checkout_validate_inventory_reversal` valida reversão integral, produto/item original e sinal exatamente oposto. Os uniques impedem segunda reversão da mesma origem e outro lançamento SALE/REVERSAL para o mesmo item e tipo.

Portanto, não há representação atual de destino físico ou devolução parcial. Antes de cancelar com substituição, propor uma migration aditiva, separada desta entrega, com:

1. Enum de destino RETURNED_TO_STOCK, KEPT_BY_CUSTOMER, REPLACED e NOT_APPLICABLE.
2. Registro imutável de destinação ligado por FKs compostas ao cancelamento/correção e SaleItem original, contendo quantidade, autor, instante real e motivo. Várias linhas por item permitem que unidades tenham destinos diferentes; a soma deve corresponder à quantidade cancelada. Serviços/combos usam NOT_APPLICABLE sem movimento de produto.
3. Vínculos tipados entre destinação e movimentos reais de estoque. RETURNED_TO_STOCK permite entrada apenas da quantidade fisicamente recebida; KEPT_BY_CUSTOMER não cria entrada. REPLACED exige também informar se o produto original retornou, qual produto substituto saiu e as quantidades reais: o enum isolado não resolve essa ambiguidade.
4. Para retorno parcial, não reutilizar `reversalOfId`: isso violaria a trigger de reversão integral. A menor proposta é reutilizar InventoryMovement ENTRY, com saleItemId/reversalOfId nulos como exigem os checks existentes, e registrar na destinação as FKs tipadas para a saída original e a entrada real, validando mesmo tenant/produto e quantidade. O motivo e o vínculo distinguem essa entrada de uma compra. Uniques da nova destinação impedem reutilizar uma entrada em duas compensações. Assim não é necessário alterar InventoryMovementKind nem enfraquecer a trigger/unique de reversão integral. Caso se exija um kind RETURN dedicado, sua extensão de enum/check seria uma alternativa maior a aprovar, não parte da proposta mínima.

O serviço futuro deve bloquear venda e saldos de produtos em ordem estável, validar toda a destinação, estornar os valores financeiros confirmados e lançar somente as entradas/saídas reais, na mesma transação. Cancelamento financeiro integral não significa retorno integral de produtos.

Nome proposto para o registro: SaleCancellationDisposition, ligado à futura CheckoutCorrection e ao SaleItem por FKs compostas; campos mínimos de destino, quantidade, motivo, ator, instante, saída original, entrada efetiva e saída da substituição. REPLACED precisa ainda declarar o retorno físico do original e identificar o item fornecido na substituta. A soma dos destinos e os vínculos/valores dos movimentos precisam de validação transacional e checks/triggers próprios. PENDING sem fornecimento e sem baixa não exige uma devolução fictícia nem deve ser classificado como produto devolvido. Essa proposta ainda não foi implementada nem aprovada como DDL final.

Para substituição/troca, não registrar a mesma saída duas vezes: a baixa da venda substituta deve ser o movimento de saída vinculado à troca. Se o cliente manteve o produto original, a substituta não pode baixar novamente esse mesmo fornecimento sem um novo fornecimento físico e uma regra explícita de modelagem. Essa distinção deve ser resolvida antes de implementar o fluxo; não existe transferência implícita de estoque ou recebimento nesta subfase.

Checks/FKs/uniques e validação transacional devem impedir destinação duplicada, soma superior à vendida, referências entre tenants e retorno acumulado superior à saída. Uma mesma chave retorna a destinação anterior; outra chave não autoriza uma segunda compensação. Falha intermediária deve desfazer cancelamento, destinação, estoques e substituta juntos.

Relatórios futuros separarão receita/estorno, unidades fornecidas, fisicamente retornadas, mantidas e substituídas, por competência e instante real. A auditoria terá origem, motivo e vínculos de movimentos; não inferirá destino para cancelamentos antigos. Dados legados continuam sem destinação documentada, sem backfill fictício. Schema e migrations não foram editados na Fase 2D.1.
