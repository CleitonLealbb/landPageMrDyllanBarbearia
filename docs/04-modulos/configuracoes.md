# Configurações

**Estado: PARCIAL.** A central `/dashboard/configuracoes` e sua busca local estão implementadas. Somente “Configurações de Serviços” navega para funcionalidade real.

| Card | Estado |
|---|---|
| Configurações de Serviços | IMPLEMENTADO |
| Empresa, agendamentos, pagamentos, estoque, equipe, notificações, assinatura e avançado | PLANEJADO |

Cards planejados exibem “Em breve” e não abrem páginas vazias. A visibilidade usa `settings:view`; a API permanece a autoridade.

Fonte: `src/features/settings/settings-cards.ts` e `src/features/settings/components`.
