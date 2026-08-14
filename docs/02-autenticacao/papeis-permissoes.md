# Papéis e permissões

| Conceito | Valores | Uso |
|---|---|---|
| `globalRole` | `SUPER_ADMIN` ou nulo | Administração global |
| `tenantRole` | OWNER, BARBER, ASSISTANT | Membership na barbearia |
| `permissionLevel` | BARBER, ASSISTANT | Acesso do Professional independente |
| `Professional.role` | texto | Cargo exibido, sem autoridade |

`canAccess()` é fail-closed e controla visibilidade. As APIs revalidam tipo de sessão, papel, membership e tenant; a interface não é fonte de autorização.

Atualmente, owner possui permissões de profissionais, serviços e configurações; BARBER/ASSISTANT não recebem permissões na tabela da UI. Fonte: `src/lib/permissions.ts`.
