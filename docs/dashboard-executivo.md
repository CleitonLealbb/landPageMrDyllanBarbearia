# Dashboard Executivo

Implementação local na branch `feat/dashboard-executivo`, sem migration ou alteração do banco.

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

## Dependências que faltam

O schema não contém agendamentos, vendas, pagamentos, itens vendidos, estoque ou jornadas persistidas. Por isso os seguintes indicadores e gráficos mostram **Dados insuficientes**, com motivo na própria seção:

| Relatório | Campos/módulos necessários |
| --- | --- |
| Faturamento e ticket médio | Venda/atendimento, tenant, profissional, cliente, data de competência, status, total e descontos em centavos |
| Receita líquida e comissões | Base de comissão por venda, percentual histórico, comissão apurada, taxas, estornos e regra de competência |
| Formas de pagamento e recebíveis | Método, vencimento, recebido em centavos, saldo e estornos vinculados à venda |
| Conclusões, cancelamentos e no-show | Agendamento com status, início/fim e data de cancelamento |
| Ocupação e mapa de calor | Agenda por profissional, jornadas, pausas, bloqueios e minutos efetivamente ocupados |
| Retenção, retorno e clientes atendidos | Histórico de atendimentos concluídos por cliente |
| Ranking de serviços, combos e produtos | Itens vendidos com quantidade, preço praticado e custo histórico |

Não foram criadas fórmulas financeiras ou status artificiais. Antes de implementá-los, é necessário aprovar um modelo transacional e definir explicitamente quais status contam para faturamento, conclusão, cancelamento e no-show. Todos os valores monetários deverão ser inteiros em centavos, formatados com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; não derivar receita do preço do catálogo ou comissão de cadastro. Não é possível testar cálculos de faturamento, ticket ou ocupação sem esse modelo; os testes atuais verificam que permanecem indisponíveis.

Recharts já está instalado. Não há série real para desenhar gráficos ou tooltips; nenhuma série fictícia foi criada. PDF, Excel e impressão estão explicitamente desabilitados. Próxima etapa: definir exportação consistente com filtros, autorização e conteúdo imprimível, então habilitar ações reais. Nenhuma dependência adicionada.

## Validação

Testes específicos cobrem permissões, isolamento das consultas, recusa de tenant externo, profissional externo, intervalos e fuso, comparação, ausência de dados e renderização de loading/erro/dados insuficientes. Testes de renderização são feitos no servidor; não substituem verificação visual em navegador autenticado.

Resultados locais em 21/10/2026:

- Testes do Dashboard: 30 passaram (3 arquivos).
- Suíte completa: 369 passaram (31 arquivos).
- `npx.cmd tsc --noEmit`: passou.
- `npm.cmd run build -- --webpack`: passou, incluindo geração das páginas e traces.
- `git diff --check`: passou; Git apenas informou normalização LF/CRLF.
- `npm.cmd run lint`: 15 erros e 18 avisos preexistentes, nenhum introduzido pelo diff. A checagem específica de arquivos alterados encontrou apenas o efeito preexistente da sidebar (`react-hooks/set-state-in-effect`) e o parâmetro `_args` preexistente no mock de Prisma. Ambos foram conferidos no HEAD. Os demais apontamentos estão fora dos arquivos alterados.
- Sem validação visual em sessão autenticada. Build apresentou avisos existentes de convenção middleware, Browserslist e generator Prisma sem output explícito; não foram atualizadas dependências.

O worktree estava limpo inicialmente, já na branch `feat/dashboard-executivo`, idêntica à `main` no commit `859665b`; a branch existente foi reutilizada. Referências remotas atualizadas via fetch. Nenhum commit, push, migration, seed ou alteração direta de banco.
