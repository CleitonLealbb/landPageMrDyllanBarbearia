export type Barbershop = {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  status: string
  members?: {
    user: {
      id: string
      name: string
      email: string
    }
  }[]
}
