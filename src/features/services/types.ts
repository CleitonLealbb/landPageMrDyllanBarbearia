export type ServiceStatus = "ACTIVE" | "INACTIVE"

export type ServiceProfessional = {
  id: string
  name: string
  role: string
  photoUrl: string | null
}

export type CatalogService = {
  id: string
  name: string
  description: string | null
  priceCents: number
  durationMinutes: number
  displayOrder: number
  status: ServiceStatus
  category: { id: string; name: string; status: ServiceStatus; displayOrder: number } | null
  professionals: Array<{ professional: ServiceProfessional }>
}

export type ProfessionalOption = ServiceProfessional & { status: string }
export type ServiceCategory = { id: string; name: string; description: string | null; displayOrder: number; status: ServiceStatus; _count: { services: number } }

export type ServiceFormValues = {
  name: string
  description: string
  priceReais: string
  durationMinutes: string
  displayOrder: string
  status: ServiceStatus
  categoryId: string
}

export type ServicePayload = {
  name: string
  description: string | null
  priceCents: number
  durationMinutes: number
  displayOrder: number
  status: ServiceStatus
  categoryId: string | null
}
