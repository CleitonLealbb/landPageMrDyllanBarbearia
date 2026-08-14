import { vi } from "vitest"

function forbiddenPrismaCall(model: string, method: string) {
  return vi.fn((..._args: unknown[]): unknown => {
    throw new Error(`Unexpected Prisma call: ${model}.${method}`)
  })
}

export const prismaMock = {
  $transaction: forbiddenPrismaCall("prisma", "$transaction"),
  user: {
    findUnique: forbiddenPrismaCall("user", "findUnique"),
    count: forbiddenPrismaCall("user", "count"),
    create: forbiddenPrismaCall("user", "create"),
    update: forbiddenPrismaCall("user", "update"),
  },
  professional: {
    findUnique: forbiddenPrismaCall("professional", "findUnique"),
    findFirst: forbiddenPrismaCall("professional", "findFirst"),
    findMany: forbiddenPrismaCall("professional", "findMany"),
    count: forbiddenPrismaCall("professional", "count"),
    create: forbiddenPrismaCall("professional", "create"),
    update: forbiddenPrismaCall("professional", "update"),
    delete: forbiddenPrismaCall("professional", "delete"),
  },
  barbershopUser: {
    findMany: forbiddenPrismaCall("barbershopUser", "findMany"),
    findFirst: forbiddenPrismaCall("barbershopUser", "findFirst"),
    count: forbiddenPrismaCall("barbershopUser", "count"),
  },
  barbershop: {
    findUnique: forbiddenPrismaCall("barbershop", "findUnique"),
    findFirst: forbiddenPrismaCall("barbershop", "findFirst"),
    findMany: forbiddenPrismaCall("barbershop", "findMany"),
    count: forbiddenPrismaCall("barbershop", "count"),
    create: forbiddenPrismaCall("barbershop", "create"),
    update: forbiddenPrismaCall("barbershop", "update"),
    delete: forbiddenPrismaCall("barbershop", "delete"),
  },
  service: {
    findFirst: forbiddenPrismaCall("service", "findFirst"),
    findMany: forbiddenPrismaCall("service", "findMany"),
    create: forbiddenPrismaCall("service", "create"),
    update: forbiddenPrismaCall("service", "update"),
  },
  serviceCategory: {
    findFirst: forbiddenPrismaCall("serviceCategory", "findFirst"),
    findMany: forbiddenPrismaCall("serviceCategory", "findMany"),
    create: forbiddenPrismaCall("serviceCategory", "create"),
    update: forbiddenPrismaCall("serviceCategory", "update"),
  },
  professionalService: {
    deleteMany: forbiddenPrismaCall("professionalService", "deleteMany"),
    createMany: forbiddenPrismaCall("professionalService", "createMany"),
  },
}

export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === "function") {
      model.mockReset()
      model.mockImplementation(() => { throw new Error("Unexpected Prisma call") })
      continue
    }
    for (const mockedMethod of Object.values(model)) {
      mockedMethod.mockReset()
      mockedMethod.mockImplementation(() => {
        throw new Error("Unexpected Prisma call")
      })
    }
  }
}
