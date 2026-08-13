import type { CatalogService, ProfessionalOption, ServiceFormValues, ServicePayload } from "./types"

export const serviceTabs = [
  { value: "individual", label: "Serviços Individuais", available: true },
  { value: "combos", label: "Combos / Pacotes", available: false },
  { value: "categories", label: "Categorias", available: true },
] as const

export function groupServicesByProfessional(services: CatalogService[], professionals: ProfessionalOption[]) {
  return professionals.map((professional) => ({
    professional,
    services: services.filter((service) => service.professionals.some(({ professional: assigned }) => assigned.id === professional.id)),
  }))
}

export function sortServicesForDisplay(services: readonly CatalogService[]) {
  return [...services].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "pt-BR"))
}

export function getAssignedServicesSummary(services: readonly CatalogService[], limit = 3) {
  const ordered = sortServicesForDisplay(services)
  return { visible: ordered.slice(0, limit), remaining: Math.max(0, ordered.length - limit), empty: ordered.length === 0 }
}

export function filterAssignedServices(services: readonly CatalogService[], query: string) {
  const term = query.trim().toLocaleLowerCase("pt-BR")
  const ordered = sortServicesForDisplay(services)
  return term ? ordered.filter((service) => service.name.toLocaleLowerCase("pt-BR").includes(term)) : ordered
}

export function reaisToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

export function formatBRL(priceCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceCents / 100)
}

export function centsToReais(priceCents: number) {
  return (priceCents / 100).toFixed(2).replace(".", ",")
}

export function normalizeServicePayload(values: ServiceFormValues):
  | { payload: ServicePayload; error?: never }
  | { payload?: never; error: string } {
  const name = values.name.trim()
  if (!name) return { error: "Informe o nome do serviço." }

  const priceCents = reaisToCents(values.priceReais)
  if (priceCents === null) return { error: "Informe um preço válido com até duas casas decimais." }

  const durationMinutes = Number(values.durationMinutes)
  if (!/^\d+$/.test(values.durationMinutes) || !Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) {
    return { error: "A duração deve ser um número inteiro maior que zero." }
  }

  const displayOrder = Number(values.displayOrder)
  if (!/^\d+$/.test(values.displayOrder) || !Number.isSafeInteger(displayOrder) || displayOrder < 0) {
    return { error: "A ordem deve ser um número inteiro maior ou igual a zero." }
  }

  return {
    payload: {
      name,
      description: values.description.trim() || null,
      priceCents,
      durationMinutes,
      displayOrder,
      status: values.status,
      categoryId: values.categoryId || null,
    },
  }
}

export function calculateServiceSummary(services: CatalogService[]) {
  const total = services.length
  const active = services.filter((service) => service.status === "ACTIVE").length
  const averageDuration = total === 0
    ? 0
    : Math.round(services.reduce((sum, service) => sum + service.durationMinutes, 0) / total)
  return { total, active, inactive: total - active, averageDuration }
}

export function safeApiMessage(status: number) {
  if (status === 400) return "Confira os dados informados e tente novamente."
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar."
  if (status === 403) return "Você não tem permissão para realizar esta ação."
  if (status === 404) return "O serviço solicitado não foi encontrado."
  if (status === 409) return "Já existe um serviço com este nome."
  return "Não foi possível concluir a operação. Tente novamente."
}
