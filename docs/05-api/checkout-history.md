# Checkout — Histórico e conferência

As consultas e agregações são somente leitura. A interface organiza comandas abertas, histórico financeiro e descartes, e encaminha operações autorizadas aos contratos transacionais já existentes. Nenhuma mudança de schema ou migration foi criada nesta reformulação.

## Contratos

Todos os endpoints exigem sessão autenticada, tenant ativo e vínculo revalidado. Tenant, papel e operador vêm exclusivamente da sessão. Respostas privadas com `Cache-Control: private, no-store`; erros seguem o tradutor existente.

| Endpoint | Resposta |
| --- | --- |
| GET `/api/checkout/sales` | Página de vendas com cliente mínimo, profissionais históricos, estado, datas, quantidade, total original e `paymentMethods` únicos em ordem CASH, PIX, DEBIT_CARD, CREDIT_CARD. Métodos estornados continuam históricos; a seleção ocorre na mesma consulta, sem N+1. |
| GET `/api/checkout/sales/[id]` | Contrato anterior preservado. |
| GET `/api/checkout/sales/[id]?include=history` | Contrato complementar com operador, cliente atual, caixa mínimo, cancelamento, estoque, pagamentos, gorjetas e, conforme papel, comissão e auditoria. |
| GET `/api/checkout/cash-sessions` | Página de sessões abertas/fechadas, inclusive de caixas inativos e dias anteriores. |
| GET `/api/checkout/cash-sessions/[id]` | Abertura/fechamento originais, totais da sessão inteira, saldo calculado e página dos movimentos. |

Nenhum endpoint de escrita foi acrescentado. Os GETs não consomem chave de idempotência, criam ator/auditoria ou alteram dados. Leituras relacionadas usam o cliente injetado em transação `RepeatableRead`, com timeout de 20 segundos e espera de 5 segundos; um TransactionClient injetado continua pertencendo ao chamador. Descarte e cancelamento na interface usam seus POSTs existentes, com chave de idempotência, motivo e autorização no backend.

## Permissões

- BARBERSHOP_OWNER: vendas e caixas do tenant; comissão, auditoria resumida e notas do caixa.
- ASSISTANT: vendas e caixas do tenant; sem comissão interna, auditoria ou notas privadas da sessão na resposta complementar.
- BARBER: somente vendas com pelo menos um componente próprio e todos os componentes/gorjetas pertencentes ao seu vínculo. Vendas com profissionais mistos não são disponibilizadas. Sem consulta de caixas, movimentos financeiros de caixa, comissão interna ou auditoria nesta API complementar.

O GET individual sem `include=history` conserva a projeção e as permissões anteriores. DTOs novos não expõem objetos Prisma, tenant, credenciais, e-mail, custo de produto, dados PIX, metadados arbitrários de auditoria ou identificadores de atores internos. IDs de recursos são usados como referências de navegação, nunca como nomes visíveis.

## Filtros e paginação

Listagens aceitam `period` com os presets do Dashboard: today, yesterday, week, month, previousMonth, year e custom. O padrão é month. custom exige start/end em YYYY-MM-DD; limite de 366 dias. Limites financeiros usam meia-noite local da barbearia, início inclusivo e fim exclusivo, inclusive em transições de horário de verão.

- `view=history|open`: contexto da listagem de vendas. O padrão history inclui PAID e CANCELED com finalização anterior. open inclui somente PENDING. `status=PENDING` sem view continua selecionando o contexto aberto para compatibilidade.
- `includeVoided=true|false`: exclusivo de vendas; false por padrão. No histórico principal, true inclui VOIDED e legados CANCELED sem finalizedAt. Não pode ser combinado com open.
- `status`: estados de venda ou OPEN/CLOSED para sessões. Em vendas, VOIDED exige includeVoided=true, seleciona descartadas e inclui os legados CANCELED sem finalizedAt; CANCELED seleciona exclusivamente cancelamentos financeiros com finalização anterior. Filtros incompatíveis com o contexto são rejeitados.
- `customerId`, `professionalId`: referências opcionais, sempre subordinadas ao tenant.
- `customerQuery`, `professionalQuery`: nome normalizado com NFKC/espaços, entre 2 e 80 caracteres. Cliente usa cadastro atual; profissional usa snapshot histórico. Incluem vínculos históricos inativos, sem carregar toda a base de clientes.
- Vendas: `dateField=createdAt|finalizedAt|voidedAt|canceledAt`, padrão createdAt; `cashSessionId` opcional. A data voidedAt considera canceledAt somente para descartes legados, sem alterar seus dados originais.
- Sessões: `dateField=openedAt|closedAt`, padrão openedAt; `cashRegisterId` opcional. Filtros de cliente/profissional localizam sessões por vendas ou reversões vinculadas. O detalhe sempre confere a sessão inteira, não apenas o subconjunto filtrado.

Query desconhecida, duplicada, estado/data/cursor inválido ou identidade/tenant fornecido pelo cliente é rejeitada. O barbeiro não pode selecionar outro professionalId.

`pageSize` padrão 20, máximo 50. Paginação por cursor em ordem decrescente de createdAt/id para vendas e movimentos, openedAt/id para sessões. O campo de referência filtra o período; não altera essa ordenação estável. Retorno: items, pageSize, hasMore, nextCursor e period. Não há contagem total estimada nem paginação por offset.

O cursor inclui data e desempate por ID, com fingerprint dos filtros, operador, papel, tenant e recurso. Não depende da existência posterior da linha. Alterar filtros exige reiniciar a paginação; o cliente trata o cursor como opaco. Cada página é uma nova fotografia de leitura; não se promete uma fotografia única para toda a navegação de um caixa aberto.

No detalhe de caixa, apenas pageSize/cursor são aceitos e paginam movimentos. Totais e saldo são calculados a partir de todos os movimentos da sessão. Fechamento esperado, contado e diferença originais não são regravados. Auditoria complementar de venda exibe no máximo 50 eventos recentes, com indicador de existência de mais eventos.

### Indicadores financeiros da sessão

O detalhe acrescenta `paymentTotals` com método, `appliedCents` original, `refundedCents` acumulado e `netAppliedCents` (aplicado menos estornado). Considera somente pagamentos de vendas que foram finalizadas na sessão original, mesmo quando o estorno ocorreu posteriormente em outra sessão. Os quatro métodos têm ordem estável e zero quando não há movimento.

`cashReceivedCents` e `cashChangeCents` preservam dinheiro entregue e troco originais. `cashOriginalEffectCents` é a diferença calculada no servidor. `finalizedSalesTotalCents` inclui vendas PAID e CANCELED com finalizedAt; `currentlyPaidSalesTotalCents` inclui somente PAID; `canceledSalesTotalCents` inclui somente CANCELED com finalização anterior. PENDING, VOIDED e cancelamentos legados sem finalização ficam excluídos.

Essas agregações são consultas de grupo da sessão inteira, independentes de página/cursor, sem N+1 e dentro da mesma fotografia de leitura. O saldo físico `ledgerBalanceCents` mantém seu cálculo original exclusivamente por CashMovement. PIX/cartões e estornos financeiros de outra sessão não alteram esse saldo. Reversões físicas pertencem somente à sessão do respectivo CashMovement; os valores originais do fechamento permanecem intactos. Nenhum total financeiro é refeito no frontend.

## Interface

Áreas Nova venda, Histórico de vendas e, para papéis autorizados, Histórico de caixas na tela existente `/dashboard?view=checkout`. O controlador da venda permanece montado ao navegar. O histórico principal mostra vendas finalizadas/canceladas; comandas PENDING possuem contexto separado. Descartes só aparecem com o filtro ativo. Linhas compactas mostram identificação curta, data no timezone da barbearia, cliente, profissional/múltiplos, total original, métodos históricos, badge e menu de ações. A venda vinculada a um movimento continua consultável pela conferência.

O detalhe usa Sheet lateral com cabeçalho e ações fixos e rolagem somente no conteúdo interno, com seções recolhíveis. PENDING permite continuar, editar no Checkout e descartar; PAID permite cancelamento somente para proprietário; CANCELED e VOIDED são somente leitura. A retomada obtém a versão atual por GET e não sobrescreve outra comanda em andamento ou rascunho local. Pagamentos da mesma comanda são preservados, exigindo revisão se a composição mudou.

Cancelamento e descarte exigem confirmação/motivo. Devolução em dinheiro seleciona sessão aberta e continua validada pelo backend. Duplo envio é bloqueado. Resposta incerta mantém conteúdo/chave e impede fechar até repetir com segurança; uma falha de leitura após confirmação não repete a operação financeira. Não há exclusão, correção/reclassificação de pagamento, comprovante fictício, reabertura nem ajuste financeiro novo. Layout e componentes usam os tokens do design system existente.

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
