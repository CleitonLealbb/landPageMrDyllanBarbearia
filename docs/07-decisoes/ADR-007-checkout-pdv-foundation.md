# ADR-007 — Fundação persistente do Checkout/PDV (Fase 2A)

Data: 22/10/2026. Escopo autorizado: schema, migration aditiva não aplicada, documentação e testes estruturais. Branch inicial limpa: `feat/checkout-pdv`, igual à `main` e `origin/main` em `a0f6f85`.

## Contexto e limites

O projeto persiste barbearias, identidades administrativas, profissionais, clientes, serviços, categorias e combos. Agenda e Checkout ainda não têm infraestrutura transacional. O Dashboard integrado mantém os indicadores financeiros indisponíveis. Esta ADR não habilita vendas, caixa ou indicadores em produção.

Não foram criados Appointment, cupons operacionais, APIs, interface ou integrações financeiras. Autenticação, permissões em execução, TV, APIs mobile, dependências e migrations anteriores permanecem intactas.

## Identidades e autorização aprovada

Os papéis reais são `BARBERSHOP_OWNER`, `BARBER` e `ASSISTANT`, reutilizados por `TenantRole`. `SUPER_ADMIN` não possui tenant na sessão e não é um operador implícito do PDV. `USER` e `PROFESSIONAL` são tipos de identidade da sessão, não novos papéis.

`CheckoutActor` é um snapshot imutável do operador: tipo, identificador, nome e papel na ocasião. Para USER, uma FK composta aponta ao vínculo `BarbershopUser(barbershopId, userId)`; para PROFESSIONAL, aponta a `Professional(barbershopId, id)`. Um CHECK exige exatamente a identidade correspondente. O mesmo usuário pode ter vários snapshots; não se deve atualizar um snapshot para refletir mudanças de nome/papel. Os vínculos referenciados não podem ser apagados enquanto houver histórico.

O papel histórico nunca autoriza uma nova ação. A futura API precisa revalidar a sessão existente e obter tenant e operador no servidor:

| Papel | Regra aprovada para implementação posterior |
| --- | --- |
| BARBERSHOP_OWNER | Todas as operações do tenant |
| ASSISTANT | Vender e operar caixa; sem cancelamento nem desconto especial |
| BARBER | Finalizar apenas os próprios atendimentos; sem cancelar ou descontar |

O limite do que constitui desconto **especial** ainda precisa ser configurado. Até essa configuração existir, a implementação deverá restringir desconto manual ao proprietário. A regra de próprios atendimentos exige validar todos os componentes da venda, não apenas o operador. Atendimento de agenda depende da Fase 3.

## Modelos e relações

Todos os 16 novos modelos possuem `barbershopId`, FK restritiva para Barbershop e `@@unique([barbershopId, id])`. Toda relação operacional inclui o tenant. Nenhuma relação nova usa exclusão em cascata nem `SET NULL`.

| Modelo | Responsabilidade |
| --- | --- |
| CheckoutActor | Identidade e papel histórico do operador |
| ProductCategory | Categoria opcional de produto; reutiliza CategoryStatus |
| Product | SKU, barcode opcional, nome, descrição, preço/custo e inativação |
| InventoryBalance | Um saldo inteiro por produto/tenant e versão para compare-and-swap |
| InventoryMovement | Razão imutável de abertura, entrada, venda, ajuste e reversão |
| Sale | Comanda, cliente tenant opcional, origem, operador, caixa, totais e ciclo de vida |
| SaleItem | Snapshot de serviço, combo ou produto, quantidade, preços e desconto alocado |
| SaleServiceComponent | Serviço executável por unidade do item, profissional e snapshot do rateio/comissão |
| SaleTip | Destinação integral da gorjeta por profissional |
| Payment | Método manualmente confirmado, valor aplicado, recebido em dinheiro e troco |
| CommissionEntry | Crédito de comissão ou lançamento compensatório, com base e percentual históricos |
| CashRegister | Caixa físico, desativável |
| CashSession | Operador, turno, abertura, fechamento e conferência |
| CashMovement | Abertura, suprimento, sangria, recebimento em espécie e reversão |
| CheckoutAuditEvent | Operador, ação, entidade, entidadeId, instante e metadados mínimos |
| CheckoutIdempotency | Chave por operação/tenant, hash e resultado de uma transação concluída |

`BarbershopCustomer` recebe somente uma nova chave única `(barbershopId, id)`, necessária para a FK do cliente da venda. Os demais ajustes em modelos existentes são apenas relações inversas do Prisma; não mudam suas colunas. Todos os modelos e campos anteriores são preservados.

Enums novos: CheckoutIdentityType, ProductStatus, InventoryMovementKind, SaleOrigin, SaleStatus, SaleItemKind, CheckoutDiscountKind, PaymentMethod, PaymentStatus, CommissionEntryKind, CommissionEntryStatus, CashSessionStatus e CashMovementKind. Não se reutilizou ServiceStatus para produtos por seu significado específico. CategoryStatus e TenantRole são reutilizados sem mudanças.

## Dinheiro, descontos e snapshots

Todos os valores monetários são `Int` em centavos. A capacidade de cada campo é a do INTEGER PostgreSQL: até 2.147.483.647 centavos. Quantidades também são inteiras. Valores fora da capacidade devem ser recusados, nunca truncados. Cálculos SQL intermediários usam `bigint` para evitar overflow; o serviço futuro deverá usar operações inteiras seguras/BigInt e validar limites antes da persistência.

Percentuais novos são pontos-base: 10.000 = 100%. O campo legado `Professional.commission` permanece inalterado; o percentual inteiro existente deverá ser convertido multiplicando por 100, validando 0–10.000. Não reinterpretar silenciosamente o campo existente como pontos-base.

Convenção determinística registrada nesta fundação: arredondamento de valores não negativos para o centavo mais próximo, com empate para cima: `(baseCents * basisPoints + 5000) / 10000`, com divisão inteira. Não há uso de float.

- Subtotal do item = preço unitário praticado × quantidade.
- Total do item = subtotal − desconto atribuído.
- Total da venda = subtotal de serviços (inclui combos) + subtotal de produtos − desconto + gorjetas.
- Desconto manual é fixo ou percentual sobre a soma dos subtotais, sem gorjeta na base.
- Um único `discountKind` impede acumular cupom e desconto manual.
- `COUPON` e `couponCodeSnapshot` estão reservados. Um CHECK bloqueia seu uso até haver validade, limites e resgate transacional; não há cupom fictício nesta versão.
- Nome, preço praticado, preço original e quantidade são preservados no item. Mudanças no catálogo não recalculam vendas anteriores.
- Referências ao catálogo são opcionais para preservar snapshots independentes, mas os tipos não podem apontar a outro tipo de catálogo. Para vender produto com baixa, a referência ao produto é necessária no movimento correspondente.

Os checks garantem as equações de cada registro. A igualdade entre agregados de tabelas diferentes — soma de itens, componentes, pagamentos e gorjetas — é responsabilidade da futura transação de finalização e deverá ter testes de integração. Não há uma engine de checkout implementada nesta migration.

## Combos, comissão e gorjeta

Cada unidade de um serviço ou combo pode ter componentes executáveis identificados por `unitOrdinal` e `componentOrdinal`. Produto não tem componente de serviço. O componente preserva serviço, profissional, nomes, preço original, peso usado no rateio, valor bruto alocado, desconto alocado, base líquida, pontos-base e valor da comissão.

Regra aprovada: o preço do combo é distribuído proporcionalmente aos preços originais dos serviços. O desconto atribuído ao item deve ser rateado entre seus componentes; a comissão incide **depois** desse desconto. A implementação posterior usará maiores restos para reconciliar centavos, com desempate por ordem estável dos componentes. Se os preços originais somarem zero e houver valor a distribuir, o checkout deve recusar a operação e pedir correção do catálogo, sem inventar uma base de rateio.

Cada componente gera no máximo um EARNED e uma REVERSAL. A comissão histórica usa o snapshot, nunca o percentual atual do profissional. Uma FK composta também garante que o profissional da comissão é o do componente. Triggers conferem base, percentual e valor contra o componente; valores históricos não podem ser editados.

Gorjeta fica em `SaleTip`, integralmente destinada ao profissional, fora da receita de serviço e da comissão. Sua soma deve corresponder a `Sale.tipCents`. Produtos não geram comissão automática.

No cancelamento, inserir uma comissão REVERSAL com os mesmos valores positivos; o tipo determina o sinal contábil. A referência ao EARNED é única por tenant. Depois da reversão, o original pode mudar de POSTED para REVERSED, sem mudar snapshots. Ao somar o razão, usar EARNED menos REVERSAL, sem descartar o original REVERSED e subtrair a reversão novamente.

## Venda e pagamentos

Venda avulsa aceita cliente não identificado. Cliente identificado referencia o vínculo tenant, nunca CustomerAccount diretamente. Status: DRAFT, PENDING, PAID e CANCELED. Origem AGENDA está reservada e bloqueada por CHECK até a migration específica da Fase 3; não há Appointment nem um identificador de agenda sem FK.

PIX, crédito e débito são registros confirmados manualmente pelo operador; RECORDED não significa confirmação por adquirente. Dinheiro guarda valor entregue, aplicado e troco. Apenas CASH admite troco e valor recebido em espécie. Não existem campos de PAN, CVV, token ou dados sensíveis de cartão.

Pagamento misto usa várias linhas. PAID só deve ser persistido quando a soma aplicada cobrir exatamente o total, sem confundir dinheiro entregue com valor aplicado. O troco é a diferença entre entregue e aplicado; não integra receita nem entrada líquida no caixa. Venda de total zero não exige linha de pagamento de valor zero.

O enum preserva PARTIALLY_REFUNDED como extensão futura, mas o CHECK atual permite somente RECORDED sem estorno ou REFUNDED integral. O cancelamento da venda é sempre integral; todos os pagamentos devem ser devolvidos na mesma operação. Alterar apenas parte dos pagamentos não constitui um cancelamento válido e será impedido pela futura transação de negócio.

Venda paga exige data de finalização e caixa. Um trigger trava e verifica a sessão OPEN na finalização. Itens, componentes, gorjetas e dados financeiros ficam congelados após finalizar. Pagamentos só podem mudar para estorno integral após o cancelamento da venda. Vendas canceladas não podem ser reabertas nem editadas.

## Estoque e concorrência

O saldo é único por produto/tenant e possui CHECK `quantity >= 0`. Abertura e entrada têm delta positivo, venda tem delta negativo e exige item de produto correspondente. Ajuste pode ter qualquer sinal não nulo e exige justificativa. Uma única abertura é permitida por produto.

Movimentos são imutáveis: UPDATE e exclusão física são bloqueados. Reversão referencia o original no mesmo tenant e produto, preserva o item de venda e exige delta exatamente oposto; não pode reverter outra reversão nem se repetir. Cancelamento de venda cria reversão da baixa original exatamente uma vez.

A fundação não altera saldos automaticamente. A futura finalização deve, na mesma transação da venda, atualizar o saldo com condição `quantity >= quantidadeSolicitada`, incremento da versão e verificação de linhas afetadas, depois registrar o movimento. Qualquer falha reverte toda a transação. Não basta ler saldo e depois subtrair; o CHECK sozinho também não mantém o razão conciliado. Quantidade zero inicial pode ficar sem movimento, pois movimento de delta zero é inválido.

## Caixa

Somente uma CashSession OPEN por caixa físico/tenant, via índice único parcial SQL. Abertura registra operador, turno e saldo inicial. Fechamento exige operador, instante, saldo esperado, informado e diferença `informado − esperado`; a diferença pode ser negativa.

O caixa representa numerário físico. Saldo esperado = abertura + suprimentos + pagamentos CASH aplicados − sangrias − reversões CASH. PIX e cartões permanecem em Payment e não aumentam o dinheiro da gaveta. Não somar simultaneamente openingBalance e movimento OPENING: o movimento espelha a abertura, não é um segundo saldo inicial.

Movimentos de caixa são imutáveis e exigem sessão aberta. Uma abertura por sessão; uma entrada por pagamento CASH; uma reversão por entrada original. A reversão pode ocorrer em outra sessão aberta do mesmo tenant, preservando venda e pagamento originais, para permitir cancelamento após fechamento do caixa original. A política de disponibilidade de dinheiro para devolução deverá ser validada na operação futura.

O fechamento e as vendas devem usar uma ordem consistente de locks e revalidar a sessão. Esta fundação não implementa os serviços de abertura, sangria, suprimento ou fechamento.

## Cancelamento e receita líquida

Não se excluem registros financeiros. Cancelamento requer proprietário, confirmação, motivo, operador e instante. A futura transação deverá marcar a venda cancelada, devolver todo o estoque, estornar todos os pagamentos, lançar as reversões de comissão/caixa e gravar auditoria/idempotência. As constraints de unicidade impedem duplicar lançamentos de reversão, mas não substituem a transação completa e a autorização.

Definições para o futuro Dashboard:

- G = soma dos subtotais de vendas finalizadas, antes de descontos e sem gorjetas.
- D = descontos dessas vendas.
- C = valor de serviços/produtos cancelados **já descontado**, sem gorjetas.
- K = comissões apuradas menos suas reversões.
- Receita líquida inicial = G − D − C − K.

Usar cancelamento líquido evita descontar duas vezes o desconto da venda cancelada. Gorjetas e devoluções de gorjetas ficam fora da receita. Taxas de cartão não entram enquanto não existir configuração específica. O relatório por fluxo de eventos deverá usar finalizedAt para reconhecimento e canceledAt/instantes das reversões para cancelamento, respeitando o fuso da barbearia; uma visão por coorte de vendas deve ser identificada separadamente. O Dashboard atual não foi alterado.

## Auditoria e idempotência

Auditoria é append-only, com FK tenant para operador. `entityId` é referência de auditoria polimórfica, não uma FK nem autorização de acesso; deve conter somente entidade do tenant validada pelo serviço. Metadados JSON devem ser objeto e seguir uma whitelist de IDs, motivo/códigos e valores mínimos. Não incluir payload inteiro, senhas, cookies, cartão, telefone ou outros dados sensíveis. O banco não consegue inferir automaticamente se um JSON contém segredo.

Idempotência é única por `(barbershopId, operation, key)`. Guarda SHA-256 hexadecimal do conteúdo canônico, operador, status HTTP 2xx e resultado JSON mínimo. É imutável e deve ser inserida na mesma transação concluída que a operação. Não se armazenam resultados financeiros incompletos. Falha/rollback não consome a chave.

Uma disputa de chave provoca rollback da tentativa concorrente e leitura do resultado vencedor. Mesma chave e hash diferente deve retornar conflito; mesma chave nunca dispensa reautenticação e autorização de leitura. Repetição não produz nova venda, movimento ou comissão. Não há cache nem endpoint idempotente implementado nesta fase.

## Migration e validação

Arquivo: `prisma/migrations/20261022120000_checkout_pdv_foundation/migration.sql`.

A estrutura foi produzida por `prisma migrate diff` comparando **dois datamodels locais**, sem usar datasource, shadow database ou migrations como entrada. O SQL foi complementado manualmente com checks, índices parciais e triggers, em BEGIN/COMMIT. Não há DML de alteração de dados existentes, remoção de tabela/coluna ou cascade destrutivo. `BEFORE DELETE` aparece apenas como proteção que rejeita exclusões.

Format, validate e generate são operações locais permitidas. Os testes inspecionam o datamodel gerado e o SQL: tenant, FKs, centavos, snapshots, constraints, unicidade, reversões, caixa, idempotência e hashes das migrations anteriores. Eles não executam esta migration nem comprovam a execução PostgreSQL das funções/triggers. Nenhum banco, inclusive temporário, foi usado para aplicar o SQL, conforme o limite desta fase.

Antes de habilitar o módulo, será necessária autorização separada para testar a migration em PostgreSQL descartável, revisar seu plano de aplicação e provar concorrência, rollback, agregados e reversões com testes reais. Prisma não representa checks/triggers/índices parciais no schema: migrations futuras devem preservar explicitamente essas proteções. Não usar db push para tentar reconciliar a estrutura.

Validações locais finais desta entrega:

- `prisma format`, `prisma validate` e `prisma generate`: passaram, executados separadamente.
- Testes específicos após a revisão final: 121 passaram, incluindo a revisão cruzada de FKs, PKs, índices, enums e funções/triggers.
- Suíte completa após a revisão final: 490 testes passaram em 32 arquivos.
- `npx.cmd tsc --noEmit`: passou.
- `npm.cmd run build -- --webpack`: passou, sem alterações de interface ou rotas.
- `git diff --check`: passou; apenas aviso de normalização LF/CRLF do Git.
- `npm.cmd run lint`: 15 erros e 18 avisos preexistentes em arquivos fora do diff; nenhum apontamento no novo teste. O lint específico do teste também passou. Não foram alterados arquivos antigos com erros para corrigir lint fora do escopo.
- Avisos preexistentes: configuração Vite CommonJS/ESM, generator Prisma sem output explícito, convenção middleware e base Browserslist antiga. Nenhuma dependência foi atualizada.

O worktree final contém apenas schema, migration nova, teste e esta ADR. Sem aplicação de SQL, commit ou push. O rollback de código pode desabilitar a fundação antes de uso; não se propõe apagar histórico financeiro para reverter uma implantação após haver dados.

## Fases futuras

1. Testes de integração autorizados da migration e serviço de cálculo/validação inteiro.
2. Produtos/estoque, catálogo de PDV e comanda; definir política de desconto especial.
3. Finalização transacional, confirmação manual, caixa aberto e idempotência reais.
4. Agenda persistida em migration separada, com vínculo único tenant-safe da venda.
5. Cancelamento integral, caixa, histórico e agregações do Dashboard.
6. Cupons com validade/limites; recibos, impressão, WhatsApp manual e atalhos seguros.

Nenhum desses comportamentos deve ser anunciado como funcional apenas por existir a modelagem.

## Revisão final dos artefatos antes do commit

Os rascunhos `.tmp-checkout-constraints.sql` e `.tmp-checkout.cjs` foram removidos na execução anterior e sua ausência foi reconfirmada. Não foram adicionados ao `.gitignore`. A migration contém tanto o DDL estrutural quanto as funções, checks, índices parciais e triggers necessários; não importa nem executa arquivos externos. Schema, SQL, teste e ADR são os quatro únicos arquivos da entrega.

A revisão cruzada está coberta por testes adicionais que conferem os 16 modelos, os 13 enums e seus valores, colunas/tipos/nulabilidade, PKs, cada FK e suas ações, índices e uniques declarados no schema. Também verificam ausência de nomes repetidos ou maiores que 63 bytes, colisões com objetos anteriores, ordem das dependências e referências a campos reais nas funções/triggers. O SQL possui proteções extras não expressáveis no Prisma; equivalência estrutural não significa que o datamodel represente esses checks/triggers.

Inventário desta migration: 16 tabelas, 13 enums, 16 PKs, 54 FKs (16 simples para Barbershop e 38 compostas), 57 índices explícitos (41 únicos e 16 não únicos; três dos únicos são parciais), 25 checks, 11 funções e 31 triggers. As 16 PKs ainda criam seus próprios índices implícitos, não incluídos nos 57 CREATE INDEX.

### Ordem transacional compatível com as proteções imediatas

Não há FK deferrable ou constraint trigger adiado. A futura implementação deve respeitar esta sequência, dentro de uma única transação, com locks em ordem consistente e retry de conflitos/deadlocks:

1. Ter o operador histórico, caixa/sessão OPEN e referências de catálogo/cliente do tenant válidas.
2. Criar a venda DRAFT/PENDING; criar itens, componentes, gorjetas e pagamentos antes de marcar PAID. Triggers dos snapshots travam a venda e rejeitam alterações após finalizar/cancelar.
3. Validar agregados, permissões e saldo, persistir os lançamentos e finalizar. A mudança para PAID trava e confere a sessão aberta. A aplicação deve conciliar tudo antes do commit; os triggers não calculam os agregados automaticamente.
4. Para cancelar, travar a venda e a sessão aberta usada para devolver dinheiro, marcar a venda CANCELED com metadados completos e estornar seus pagamentos. O trigger de Payment exige que o cancelamento já esteja visível na transação.
5. Inserir reversões de estoque, comissão e caixa. Elas são INSERTs novos; imutabilidade dos lançamentos originais não as bloqueia. Para comissão, inserir a reversão **antes** de atualizar o EARNED para REVERSED. O pagamento pode ser estornado antes ou depois da reversão de caixa porque o trigger confere método/valor aplicado, não exige RECORDED.
6. A reversão de caixa pode usar outra sessão aberta do mesmo tenant; não depende de reabrir a sessão original fechada. Se a sessão usada na devolução for fechada nesta mesma transação, inserir a reversão antes do fechamento.
7. Registrar auditoria e idempotência e concluir a transação. Falha em qualquer etapa deve provocar rollback; não usar upsert com UPDATE sobre os razões imutáveis para tratar repetição.

A análise é estática. Ela confirma que as condições das funções permitem essa ordem, mas não substitui executar transações concorrentes em PostgreSQL, proibido nesta revisão. Não houve correção necessária no DDL estrutural ou nas triggers nesta revisão; foram ampliados os testes e explicitadas as condições de uso.

### Banco vazio e repetição da migration

Esta migration é incremental: depende das tabelas e enums das migrations anteriores. Internamente, cria enums antes das tabelas, todas as tabelas e índices únicos antes das FKs, e funções antes dos triggers. Não se pode executar apenas este arquivo sobre um banco sem a estrutura base.

Há uma limitação **preexistente** na cadeia histórica: `20260806222509_mobile_customer_catalog_foundation` exige exatamente uma barbearia e realiza backfill específico de slug/timezone. Portanto, não é correto prometer que a cadeia inteira roda em um banco totalmente vazio sem uma estratégia de bootstrap aprovada. A migration antiga não foi modificada. Essa condição deve ser resolvida separadamente antes de um futuro ensaio integral em banco descartável.

O SQL não é reexecutável manualmente: CREATE TYPE/TABLE/FUNCTION e os demais objetos conflitam se executados novamente. Isso é intencional; não foram usados IF NOT EXISTS para esconder drift. O mecanismo do Prisma deve registrar a conclusão em `_prisma_migrations` e pular migrations concluídas nas execuções posteriores. Tentativas com falha exigem diagnóstico e tratamento do estado de migration, não reexecução cega. Como este arquivo ainda não foi aplicado, sua revisão antes do commit não altera checksum de uma migration já aplicada.

Outras condições para a próxima fase: regras de autorização e totais entre tabelas continuam a cargo do serviço transacional; justificativas devem ser validadas como texto não vazio; itens de rascunho não têm exclusão física, portanto a edição/remoção de itens deve definir inativação lógica antes de implementar a comanda persistida. Essas funcionalidades não foram acrescentadas nesta revisão de artefatos.

Na repetição final do generate houve EPERM ao substituir a DLL do engine no Windows. Com autorização explícita do usuário, o servidor Next.js local foi parado temporariamente para liberar a DLL; o generate então passou. Após testes, TypeScript e build bem-sucedidos, o servidor foi reiniciado em `http://localhost:3000` e informou Ready. O lint específico do artefato de testes passou novamente. Nenhum comando de migration foi usado para resolver esse bloqueio local.
