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
  professionals: Array<{ professional: ServiceProfessional }>
}

export type ProfessionalOption = ServiceProfessional & { status: string }

export type ServiceFormValues = {
  name: string
  description: string
  priceReais: string
  durationMinutes: string
  displayOrder: string
  status: ServiceStatus
}

export type ServicePayload = {
  name: string
  description: string | null
  priceCents: number
  durationMinutes: number
  displayOrder: number
  status: ServiceStatus
}
