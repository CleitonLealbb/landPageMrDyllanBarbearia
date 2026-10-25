# Dashboard Executivo

Dashboard integrado ao Checkout na branch `feat/checkout-pdv`, sem mudança de schema, migrations ou escrita no banco.

## Arquitetura e acesso

`/dashboard` abre a visão executiva para proprietários; demais perfis mantêm a Agenda. As outras views por query string continuam disponíveis. O shell fornece o perfil validado no servidor para a navegação. A API verifica novamente a sessão: a proteção não depende da interface.

`/api/dashboard/summary?executive=true` estende a rota existente; o contrato legado e o resumo global do superadmin permanecem preservados. O resumo executivo é exclusivo do proprietário, seguindo as permissões existentes do menu. Superadmin sem tenant não recebe dados executivos.

Tenant vem exclusivamente da sessão revalidada. Parâmetros desconhecidos, inclusive `barbershopId`, duplicados, datas inválidas, intervalos invertidos ou maiores que 366 dias e profissionais fora do tenant são rejeitados. Respostas executivas não são armazenadas em cache. A consulta de profissionais projeta apenas id, nome e comissão; contagens de clientes usam transação e filtros tenant. Não há consultas por linha.

Filtros são globais. Datas locais são convertidas em limites UTC semiabertos no fuso IANA persistido da barbearia, inclusive horário de verão. Períodos correntes terminam no dia local atual. Comparação usa os dias imediatamente anteriores, com a mesma quantidade de dias de calendário. Campos retornados com `null` significam indisponibilidade, nunca zero calculado.

## Dados reais disponíveis

- Novos clientes: quantidade de vínculos `BarbershopCustomer` criados no período.
- Comparação de novos clientes com período anterior.
- Cadastros atualmente ativos criados até o fim do período. Não representa histórico de status: não há histórico de bloqueio/ativação.
- Profissionais cadastrados e percentual de comissão configurado. Esse cadastro não tem histórico; o percentual não representa comissão apurada no período.

Clientes não possuem associação com profissional. Ao filtrar um profissional, as contagens de clientes ficam indisponíveis em vez de atribuir totais gerais a ele. Lista de profissionais é uma dimensão cadastral, não uma métrica filtrada por data.

## Financeiro real do Checkout

O resumo executivo inclui `finance: { source: "CHECKOUT", scope, current, previous }`. `previous` é null sem comparação. As consultas financeiras dos dois períodos usam uma transação de leitura RepeatableRead, sempre com tenant da sessão e projeção explícita. O contrato legado sem `executive=true` permanece intacto.

`Sale` é a única fonte financeira oficial. Só entram vendas atualmente PAID com `finalizedAt` no intervalo local convertido para UTC (`gte` inclusivo, `lt` exclusivo). DRAFT, PENDING e CANCELED nunca compõem receita, itens vendidos ou comissões ativas. Isso também vale retrospectivamente: um cancelamento posterior retira a venda do faturamento ativo do período original, sem debitar seu valor uma segunda vez no período do cancelamento.

Campos de cada período: `paidTotalCents`, `paidSales`, `averageTicketCents`, `servicesRevenueCents`, `productsRevenueCents`, `discountsCents`, `tipsCents`, `postedCommissionsCents`, `commissionReversalsCents`, `canceledSales`, `canceledAmountCents`, `refundedPaymentCents`, `productsQuantity`, `servicesQuantity`, `payments`, `daily`, `ranking` e `professionals`. Sem movimento, valores e contagens são zero. `metrics.grossCents` e `metrics.averageTicketCents` também refletem o total pago e o ticket do Checkout, identificados na interface.

O total pago soma `Sale.totalCents` uma vez por venda e inclui gorjetas. Receita de serviços/combos e produtos soma `SaleItem.totalCents`, já após desconto; gorjeta fica separada. Descontos são informativos, não deduzidos novamente. Ticket divide total pago por quantidade de vendas, arredondando para centavos. Quantidade de serviços conta os componentes históricos, inclusive os de combos; o ranking de combos conta unidades do item. Não se usam preços atuais do catálogo, custo ou percentuais atuais de comissão para calcular receita ou comissão.

Pagamentos somam `appliedCents - refundedCents`, excluindo REFUNDED e valores sem saldo ativo. Não se consultam `cashReceivedCents` ou `changeCents`. Uma venda mista conta uma vez no total geral; em cada método, conta no máximo uma vez, e as contagens por método não são somáveis. Comissões geradas usam somente lançamentos EARNED/POSTED das vendas PAID. Reversões POSTED e pagamentos estornados de vendas CANCELED são exibidos separadamente, pela competência de `canceledAt`. O valor das comandas canceladas pode incluir pendentes sem pagamentos; não é tratado como receita estornada.

O filtro profissional seleciona comandas com componentes de serviço daquele profissional, mantendo as relações filtradas pelo tenant. `scope: "SALES_WITH_PROFESSIONAL"` significa que receita, produtos e pagamentos continuam sendo da comanda inteira; não há rateio financeiro inventado por profissional. Produção individual usa o rateio histórico `allocatedGrossCents - allocatedDiscountCents`; comissões e reversões individuais pertencem apenas ao selecionado. Sem filtro, `scope` é TENANT.

Não há soma com receita de agenda. Indicadores de agenda/atendimento continuam operacionais e indisponíveis quando não existem registros. Receita líquida não é estimada sem custos e taxas. Cadastro de comissão continua identificado como configuração, separado de comissão efetivamente gerada. Cancelamentos do Checkout têm indicador próprio e não substituem cancelamentos da agenda.

Ao retornar da view Checkout, o Dashboard monta novamente e consulta o resumo sem cache. O botão **Atualizar relatório** permite atualização explícita após movimentos em outras abas. Loading, erro seguro e estados vazios são mantidos. Erros de consulta não viram zeros artificiais.

## Dependências que ainda faltam

Ainda faltam agenda, jornadas, custos e taxas suficientes para estes indicadores, que permanecem como **Dados insuficientes**:

| Relatório | Campos/módulos necessários |
| --- | --- |
| Receita líquida | Custos e taxas históricos; comissões reais já são exibidas separadamente |
| Conclusões, cancelamentos e no-show | Agendamento com status, início/fim e data de cancelamento |
| Ocupação e mapa de calor | Agenda por profissional, jornadas, pausas, bloqueios e minutos efetivamente ocupados |
| Retenção, retorno e clientes atendidos | Histórico de atendimentos concluídos por cliente |

Valores monetários permanecem em centavos inteiros e são formatados em reais. Testes cobrem snapshots, pagamentos, cancelamentos, comparação, isolamento, fuso e renderização, sem acessar banco externo. Agregados além do limite de inteiros seguros falham explicitamente em vez de perder precisão.

A evolução diária usa dados reais do Checkout em barras simples e acessíveis; dias sem movimento representam receita zero. PDF, Excel e impressão continuam explicitamente desabilitados. Nenhuma dependência adicionada.

## Validação

Testes específicos cobrem permissões, isolamento das consultas, recusa de tenant externo, profissional externo, intervalos e fuso, comparação, ausência de dados e renderização de loading/erro/dados insuficientes. Testes de renderização são feitos no servidor; não substituem verificação visual em navegador autenticado.

Histórico da implementação inicial em 21/10/2026 (anterior à integração Checkout):

- Testes do Dashboard: 30 passaram (3 arquivos).
- Suíte completa: 369 passaram (31 arquivos).
- `npx.cmd tsc --noEmit`: passou.
- `npm.cmd run build -- --webpack`: passou, incluindo geração das páginas e traces.
- `git diff --check`: passou; Git apenas informou normalização LF/CRLF.
- `npm.cmd run lint`: 15 erros e 18 avisos preexistentes, nenhum introduzido pelo diff. A checagem específica de arquivos alterados encontrou apenas o efeito preexistente da sidebar (`react-hooks/set-state-in-effect`) e o parâmetro `_args` preexistente no mock de Prisma. Ambos foram conferidos no HEAD. Os demais apontamentos estão fora dos arquivos alterados.
- Sem validação visual em sessão autenticada. Build apresentou avisos existentes de convenção middleware, Browserslist e generator Prisma sem output explícito; não foram atualizadas dependências.

O worktree estava limpo inicialmente, já na branch `feat/dashboard-executivo`, idêntica à `main` no commit `859665b`; a branch existente foi reutilizada. Referências remotas atualizadas via fetch. Nenhum commit, push, migration, seed ou alteração direta de banco.
