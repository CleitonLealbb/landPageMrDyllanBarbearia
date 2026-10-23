import { vi } from "vitest"

function forbiddenPrismaCall(model: string, method: string) {
  return vi.fn((..._args: unknown[]): unknown => {
    void _args
    throw new Error(`Unexpected Prisma call: ${model}.${method}`)
  })
}

function checkoutDelegate(model: string) {
  return { findFirst: forbiddenPrismaCall(model, "findFirst"), findFirstOrThrow: forbiddenPrismaCall(model, "findFirstOrThrow"), findUnique: forbiddenPrismaCall(model, "findUnique"), findMany: forbiddenPrismaCall(model, "findMany"), create: forbiddenPrismaCall(model, "create"), createMany: forbiddenPrismaCall(model, "createMany"), update: forbiddenPrismaCall(model, "update"), updateMany: forbiddenPrismaCall(model, "updateMany"), groupBy: forbiddenPrismaCall(model, "groupBy") }
}

export const prismaMock = {
  barbershopCustomer: {
    count: forbiddenPrismaCall("barbershopCustomer", "count"),
    findFirst: forbiddenPrismaCall("barbershopCustomer", "findFirst"),
  },
  $queryRaw: forbiddenPrismaCall("prisma", "$queryRaw"),
  product: checkoutDelegate("product"),
  inventoryBalance: checkoutDelegate("inventoryBalance"),
  inventoryMovement: checkoutDelegate("inventoryMovement"),
  sale: checkoutDelegate("sale"),
  saleItem: checkoutDelegate("saleItem"),
  saleServiceComponent: checkoutDelegate("saleServiceComponent"),
  saleTip: checkoutDelegate("saleTip"),
  payment: checkoutDelegate("payment"),
  commissionEntry: checkoutDelegate("commissionEntry"),
  cashRegister: checkoutDelegate("cashRegister"),
  cashSession: checkoutDelegate("cashSession"),
  cashMovement: checkoutDelegate("cashMovement"),
  checkoutActor: checkoutDelegate("checkoutActor"),
  checkoutAuditEvent: checkoutDelegate("checkoutAuditEvent"),
  checkoutIdempotency: checkoutDelegate("checkoutIdempotency"),
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
  servicePackage: {
    findFirst: forbiddenPrismaCall("servicePackage", "findFirst"),
    findMany: forbiddenPrismaCall("servicePackage", "findMany"),
    create: forbiddenPrismaCall("servicePackage", "create"),
    update: forbiddenPrismaCall("servicePackage", "update"),
  },
  servicePackageItem: {
    deleteMany: forbiddenPrismaCall("servicePackageItem", "deleteMany"),
    createMany: forbiddenPrismaCall("servicePackageItem", "createMany"),
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
