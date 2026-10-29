# Ensaio PostgreSQL descartável — Checkout 2B

## Validação real concluída

O operador informou a conclusão da validação PostgreSQL real da Fase 2B em ambiente descartável: **51 PASS / 0 FAIL**. Foram confirmados os rollbacks integrais da criação, finalização e cancelamento, a restauração de estoque exatamente uma vez, o uso das transações pelos serviços e a resposta HTTP 409 para a violação de integridade SQLSTATE 23514 apresentada pelo Prisma como UnknownRequestError.

O ensaio foi executado pelo operador no PowerShell autorizado. O agente não acessou banco nem executou migrations na preparação final. Não são registrados aqui endereço de conexão, host, credenciais, identificadores ou dados das fixtures. O script temporário foi removido após a validação; os detalhes de bootstrap abaixo permanecem como registro técnico do ensaio, não como instrução de execução de um arquivo entregue.

Na preparação final, após remover o temporário, passaram separadamente Prisma format, validate e generate; 262 testes específicos de Checkout; 631 testes da suíte completa em 38 arquivos; TypeScript; build webpack; lint somente dos arquivos alterados/novos; e git diff --check. A busca por temporários nos arquivos do projeto não encontrou remanescentes. Nenhuma migration foi aplicada e não houve conexão com banco nessa preparação. Não foram feitos commit ou push.

## Separação e injeção

`createCheckoutServices(client)` em `src/lib/checkout/factory.ts` não importa a fachada, a sessão HTTP nem `src/lib/prisma.ts`, direta ou indiretamente. A autorização de sessão foi separada em `checkout/session.ts`; o domínio recebe o contexto do ator e revalida sua identidade no cliente injetado. `checkout/production.ts` é a única fachada que importa o singleton e instancia a fábrica. Os oito handlers preservam seus contratos HTTP e usam essa fachada.

`CheckoutDatabase` contém somente os delegates/SQL necessários, comuns a PrismaClient e TransactionClient. `CheckoutClient` acrescenta `$transaction` opcional. Com cliente raiz, mutações usam Serializable/maxWait 5 s/timeout 20 s e a leitura de vencedor usa timeout 5 s. Com TransactionClient, as operações participam da transação existente, sem aninhar transação ou escapar dela; o chamador define isolamento, timeout e rollback. Conflito em transação ambiente é propagado, pois uma transação PostgreSQL abortada não pode consultar um vencedor.

Os testes de injeção fazem a importação do singleton lançar erro, distinguem o cliente raiz do tx e bloqueiam acesso a delegates do raiz dentro do callback. Os 577 testes anteriores permanecem na suíte.

## Evidência do Prisma instalado: 6.6.0

Inspeção estática, sem importar/executar o cliente ou abrir conexão:

- `node_modules/.prisma/client/index.js` contém `relativeEnvPaths.schemaEnvPath = "../../../.env"` e chama `warnEnvConflicts(...)` antes de exportar a classe gerada.
- No `node_modules/@prisma/client/runtime/library.js` instalado, `warnEnvConflicts` é exportado como `yu`; `yu(e)` chama `it(e, {conflictCheck:"warn"})`. A função `it` chama `_s`; `_s` verifica existência e chama `Fi.default.config({path:e,...})`. Portanto, **não é apenas aviso de caminho: o runtime pode ler e carregar conteúdo do arquivo existente**. A leitura interna foi expressamente autorizada pelo usuário; não é usada pelo script como fonte de conexão.
- No mesmo runtime, o resolvedor `jr` lê `a = overrideDatasources[nome]?.url` e escolhe `a` antes do valor inline e de `env[DATABASE_URL]`: trecho `a?i=a:s?.value?i=s.value:s?.fromEnvVar...`. O construtor guarda os overrides em `_engineConfig.overrideDatasources`.
- O script captura/valida `process.env.DATABASE_URL` antes dos imports dinâmicos, passa esse valor explicitamente em `datasources.db.url` e confere o override efetivo antes da primeira consulta. Ausência, versão/configuração incompatível ou host diferente abortam sem fallback. Nenhuma URL/senha é impressa.

O teste temporário foi executado apenas manualmente com a variável de ambiente do PowerShell autorizado. Ele não importava dotenv, não lia .env diretamente, não aplicava migrations, não fazia DDL nem seed geral. Setup DML criava apenas fixtures com prefixo exclusivo, em tenants exclusivos, e o relatório inventariava os registros persistidos. Cenários reversíveis usavam transação com rollback; históricos imutáveis permaneciam para descarte da branch inteira. Os testes reais não foram executados pelo agente.

O bootstrap validava exclusivamente o host descartável autorizado, bloqueava parâmetros que pudessem redirecionar o host e acrescentava limites locais de conexão/pool/socket à cópia validada da URL, sem alterar a variável de ambiente. Ele verificava a mesma URL no construtor e em `_engineConfig.overrideDatasources` antes da primeira consulta. Um preflight de imports TypeScript percorria o grafo da fábrica para ESM; uma proteção do loader CommonJS impedia avaliar o singleton e a cache era conferida antes da conexão. Não se substituíam serviços nem o Prisma por mocks no ensaio.

Os checks anteriores do catálogo já impedem persistir duração zero/negativa em Service/ServicePackage. Para exercitar também a defesa do domínio contra uma leitura inválida sem desabilitar constraints, três cenários identificam explicitamente uma injeção de falha no resultado de uma consulta real, via middleware Prisma. Os demais cenários de duração escrevem/consultam dados PostgreSQL reais e validam os checks e triggers. As falhas intermediárias de escrita também usam middleware, mas provocam violações SQL reais dentro das transações dos serviços.

Comando histórico usado no PowerShell autorizado, na raiz do projeto (o arquivo temporário já foi removido):

```powershell
.\node_modules\.bin\tsx.cmd .\.tmp-checkout-2b-runtime-test.ts
```

O script não obtém nem configura a credencial. DATABASE_URL precisa existir previamente no processo. Qualquer FAIL resulta em exit code diferente de zero; inventário e desconexão de todos os clientes ficam no finally. Não executar em paralelo com outra cópia do script no mesmo processo.

Validação local da adaptação inicial: 588 testes passaram (577 anteriores + 11 de injeção), TypeScript do projeto e build webpack passaram, lint dos arquivos alterados e script passou. O padrão glob do tsconfig não inclui o arquivo iniciado por ponto; por isso o script também foi incluído explicitamente como rootName em um Program da API do TypeScript, com as opções do projeto, noEmit e sem incremental. Essa checagem passou e não executou o script. Nenhum teste PostgreSQL real foi executado pelo agente. Schema, migrations, dependências e .env foram preservados nessa adaptação.
