export type SettingsCard = { id: string; title: string; description: string; keywords: readonly string[]; href: string | null; available: boolean }

export const settingsCards: readonly SettingsCard[] = [
  { id: "empresa", title: "Detalhes da Empresa", description: "Dados, identidade e informações da empresa.", keywords: ["empresa", "perfil", "dados"], href: null, available: false },
  { id: "servicos", title: "Configurações de Serviços", description: "Gerencie o catálogo, preços, durações e profissionais.", keywords: ["serviços", "catálogo", "preços"], href: "/dashboard/configuracoes/servicos", available: true },
  { id: "agendamentos", title: "Agendamentos Online", description: "Defina regras e preferências para reservas online.", keywords: ["agenda", "reservas", "horários"], href: null, available: false },
  { id: "pagamentos", title: "Pagamentos e Checkout", description: "Configure meios de pagamento e opções de checkout.", keywords: ["pagamentos", "checkout", "vendas"], href: null, available: false },
  { id: "estoque", title: "Estoque e Produtos", description: "Organize produtos, movimentações e controles de estoque.", keywords: ["estoque", "produtos", "inventário"], href: null, available: false },
  { id: "equipe", title: "Equipe e Permissões", description: "Gerencie membros da equipe, papéis e acessos.", keywords: ["equipe", "profissionais", "permissões"], href: null, available: false },
  { id: "notificacoes", title: "Notificações e Preferências", description: "Escolha como e quando a empresa recebe avisos.", keywords: ["notificações", "avisos", "preferências"], href: null, available: false },
  { id: "assinatura", title: "Assinatura e Cobranças", description: "Consulte opções de assinatura e cobrança.", keywords: ["assinatura", "cobrança", "fatura"], href: null, available: false },
  { id: "avancado", title: "Opções Avançadas", description: "Acesse configurações técnicas e controles avançados.", keywords: ["avançado", "técnico", "integrações"], href: null, available: false },
]

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim()
export function filterSettingsCards(cards: readonly SettingsCard[], query: string) {
  const term = normalize(query)
  return term ? cards.filter((card) => normalize([card.title, card.description, ...card.keywords].join(" ")).includes(term)) : [...cards]
}
