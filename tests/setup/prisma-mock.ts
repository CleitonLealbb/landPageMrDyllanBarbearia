import { vi } from "vitest"

function forbiddenPrismaCall(model: string, method: string) {
  return vi.fn((..._args: unknown[]): unknown => {
    throw new Error(`Unexpected Prisma call: ${model}.${method}`)
  })
}

export const prismaMock = {
  user: {
    findUnique: forbiddenPrismaCall("user", "findUnique"),
  },
  professional: {
    findUnique: forbiddenPrismaCall("professional", "findUnique"),
  },
  barbershopUser: {
    findMany: forbiddenPrismaCall("barbershopUser", "findMany"),
  },
  barbershop: {
    findUnique: forbiddenPrismaCall("barbershop", "findUnique"),
    findFirst: forbiddenPrismaCall("barbershop", "findFirst"),
  },
}

export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    for (const mockedMethod of Object.values(model)) {
      mockedMethod.mockReset()
      mockedMethod.mockImplementation(() => {
        throw new Error("Unexpected Prisma call")
      })
    }
  }
}
