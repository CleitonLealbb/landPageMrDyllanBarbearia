import type { Prisma, PrismaClient } from "@prisma/client"

// Shared delegates of a root client and an interactive transaction client.
export type CheckoutDatabase = Pick<Prisma.TransactionClient,
  "$queryRaw" | "barbershop" | "barbershopUser" | "professional" | "barbershopCustomer" |
  "service" | "product" | "servicePackage" | "sale" | "saleItem" |
  "saleServiceComponent" | "saleTip" | "payment" | "inventoryBalance" |
  "inventoryMovement" | "commissionEntry" | "cashRegister" | "cashSession" |
  "cashMovement" | "checkoutActor" | "checkoutAuditEvent" | "checkoutIdempotency">

export type CheckoutClient = CheckoutDatabase & Partial<Pick<PrismaClient, "$transaction">>

export function inTransaction<T>(client: CheckoutClient, work: (tx: CheckoutDatabase) => Promise<T>, timeout = 20000): Promise<T> {
  if (client.$transaction) return client.$transaction(tx => work(tx), { isolationLevel: "Serializable", maxWait: 5000, timeout })
  // An injected TransactionClient already belongs to its caller's transaction.
  // The caller owns isolation, timeout, commit and rollback; never nest or escape it.
  return work(client)
}
