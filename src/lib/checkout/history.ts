import type { Prisma, SaleStatus, CashSessionStatus } from "@prisma/client"
import type { CheckoutClient, CheckoutDatabase } from "./client"
import { identity, ownOperation, type Context, type Identity } from "./authorization"
import { canAccess } from "@/lib/permissions"
import { check } from "./errors"
import { cashBalance } from "./calculations"
import { json, presentSale, saleClosureKind, saleSelect } from "./presentation"
import { historyPeriod, historyQuery, pageResult, pageScope } from "./history-query"
import { cashHistoryTotals, historyPaymentMethods } from "./history-totals"

// Read snapshots consistently; no locks, financial writes, audit inserts or idempotency consumption.
function read<T>(client: CheckoutClient, work: (tx: CheckoutDatabase) => Promise<T>) {
  return client.$transaction ? client.$transaction(tx => work(tx), { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 20000 }) : work(client)
}
async function context(tx: CheckoutDatabase, ctx: Context, cash = false) {
  check(canAccess(ctx.session.tenantRole, cash ? "checkout:cash" : "checkout:sales"), 403, "Acesso negado.")
  const who = await identity(tx, ctx)
  const shop = await tx.barbershop.findFirst({ where: { id: ctx.barbershopId, status: "ACTIVE" }, select: { timezone: true } })
  check(shop, 403, "Acesso negado.")
  return { who, timezone: shop.timezone }
}
function owned(ctx: Context, who: Identity): Prisma.SaleWhereInput {
  if (ctx.session.tenantRole !== "BARBER") return {}
  const professionalId = who.ownProfessionalId!
  return {
    saleItem_sale: { some: { barbershopId: ctx.barbershopId, removedAt: null, saleServiceComponent_saleItem: { some: { barbershopId: ctx.barbershopId, professionalId } } },
      every: { OR: [{ removedAt: { not: null } }, { barbershopId: ctx.barbershopId, saleServiceComponent_saleItem: { every: { barbershopId: ctx.barbershopId, professionalId } } }] } },
    saleTip_sale: { every: { OR: [{ removedAt: { not: null } }, { barbershopId: ctx.barbershopId, professionalId }] } },
  }
}
function revisionSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("before" in metadata) || !("after" in metadata)) return null
  const summarize = (value: unknown) => {
    if (!value || typeof value !== "object" || !("version" in value) || !("totalCents" in value) || !("items" in value)) return null
    if (typeof value.version !== "number" || !Number.isInteger(value.version) || typeof value.totalCents !== "number" || !Number.isInteger(value.totalCents) || !Array.isArray(value.items)) return null
    return { version: value.version, totalCents: value.totalCents, itemCount: value.items.length }
  }
  const before = summarize(metadata.before), after = summarize(metadata.after)
  return before && after ? { before, after } : null
}
function saleFilters(barbershopId: string, query: ReturnType<typeof historyQuery>): Prisma.SaleWhereInput {
  return { barbershopId, ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.customerQuery ? { customer: { barbershopId, customerAccount: { name: { contains: query.customerQuery, mode: "insensitive" } } } } : {}),
    ...(query.professionalId || query.professionalQuery ? { saleItem_sale: { some: { barbershopId, removedAt: null, saleServiceComponent_saleItem: { some: { barbershopId,
      ...(query.professionalId ? { professionalId: query.professionalId } : {}), ...(query.professionalQuery ? { professionalNameSnapshot: { contains: query.professionalQuery, mode: "insensitive" } } : {}),
    } } } } } : {}) }
}
function saleStateFilter(query: ReturnType<typeof historyQuery>): Prisma.SaleWhereInput {
  const { status, view, includeVoided } = query
  if (view === "open") return { status: "PENDING" }
  // Legacy unpaid cancellations remain unchanged in storage and idempotency responses.
  if (status === "VOIDED") return { OR: [{ status: "VOIDED" }, { status: "CANCELED", finalizedAt: null }] }
  if (status === "CANCELED") return { status: "CANCELED", finalizedAt: { not: null } }
  if (status) return { status: status as SaleStatus }
  return { OR: [{ status: "PAID", finalizedAt: { not: null } }, { status: "CANCELED", finalizedAt: { not: null } },
    ...(includeVoided ? [{ status: "VOIDED" as const }, { status: "CANCELED" as const, finalizedAt: null }] : [])] }
}
function salePeriodFilter(dateField: string, range: { gte: Date; lt: Date }): Prisma.SaleWhereInput {
  // A legacy discard kept its original canceledAt. Never pretend that field was migrated.
  if (dateField === "voidedAt") return { OR: [{ status: "VOIDED", voidedAt: range }, { status: "CANCELED", finalizedAt: null, canceledAt: range }] }
  return { [dateField]: range }
}
function boundary(cursor: ReturnType<typeof historyQuery>["cursor"], field: "createdAt" | "openedAt") {
  return cursor ? { OR: [{ [field]: { lt: new Date(cursor.at) } }, { [field]: new Date(cursor.at), id: { lt: cursor.id } }] } : {}
}
const customerSelect = { id: true, customerAccount: { select: { name: true } } } satisfies Prisma.BarbershopCustomerSelect
const actorSelect = { nameSnapshot: true } satisfies Prisma.CheckoutActorSelect
const sessionSelect = {
  id: true, status: true, shift: true, openedAt: true, closedAt: true, openingBalanceCents: true,
  expectedBalanceCents: true, countedBalanceCents: true, differenceCents: true,
  cashRegister: { select: { name: true } }, openedBy: { select: actorSelect }, closedBy: { select: actorSelect },
} satisfies Prisma.CashSessionSelect
function sessionDto(row: Prisma.CashSessionGetPayload<{ select: typeof sessionSelect }>) {
  return { id: row.id, status: row.status, shift: row.shift, openedAt: row.openedAt, closedAt: row.closedAt,
    openingBalanceCents: row.openingBalanceCents, expectedBalanceCents: row.expectedBalanceCents, countedBalanceCents: row.countedBalanceCents,
    differenceCents: row.differenceCents, cashRegisterName: row.cashRegister.name, openedBy: row.openedBy.nameSnapshot, closedBy: row.closedBy?.nameSnapshot ?? null }
}
const movementSelect = {
  id: true, kind: true, amountCents: true, reason: true, createdAt: true, saleId: true, reversalOfId: true, actor: { select: actorSelect },
  cashSession: { select: { id: true, status: true, cashRegister: { select: { name: true } } } },
} satisfies Prisma.CashMovementSelect
function movementDto(row: Prisma.CashMovementGetPayload<{ select: typeof movementSelect }>) {
  return { id: row.id, kind: row.kind, amountCents: row.amountCents, reason: row.reason, createdAt: row.createdAt, saleId: row.saleId, reversalOfId: row.reversalOfId, actor: row.actor.nameSnapshot,
    cashSession: { id: row.cashSession.id, name: row.cashSession.cashRegister.name, status: row.cashSession.status } }
}

export function listSales(client: CheckoutClient, ctx: Context, params: URLSearchParams) {
  const query = historyQuery(params, "sales"), scope = pageScope(ctx, "sales", params)
  check(!query.cursor || query.cursor.scope === scope, 400, "Cursor incompatível com os filtros.")
  return read(client, async tx => {
    const { who, timezone } = await context(tx, ctx)
    if (ctx.session.tenantRole === "BARBER" && query.professionalId) check(query.professionalId === who.ownProfessionalId, 403, "Acesso negado.")
    const period = historyPeriod(params, timezone), barbershopId = ctx.barbershopId
    const rows = await tx.sale.findMany({
      where: { barbershopId, AND: [owned(ctx, who), saleFilters(barbershopId, query), boundary(query.cursor, "createdAt"), saleStateFilter(query), salePeriodFilter(query.dateField, period.current)],
        ...(query.cashSessionId ? { cashSessionId: query.cashSessionId } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.pageSize + 1,
      select: { id: true, status: true, createdAt: true, finalizedAt: true, canceledAt: true, voidedAt: true, totalCents: true,
        payment_sale: { where: { barbershopId }, select: { method: true } },
        customer: { select: customerSelect }, cashSession: { select: { cashRegister: { select: { name: true } } } },
        saleItem_sale: { where: { barbershopId, removedAt: null }, select: { quantity: true, saleServiceComponent_saleItem: { where: { barbershopId }, select: { professionalId: true, professionalNameSnapshot: true } } } } },
    })
    const page = pageResult(rows, query.pageSize, scope, row => row.createdAt)
    const items = page.items.map(row => ({ id: row.id, status: row.status, closureKind: saleClosureKind(row), createdAt: row.createdAt, finalizedAt: row.finalizedAt, canceledAt: row.canceledAt, voidedAt: row.voidedAt, totalCents: row.totalCents,
      customer: row.customer ? { id: row.customer.id, name: row.customer.customerAccount.name } : null,
      paymentMethods: historyPaymentMethods.filter(method => row.payment_sale.some(payment => payment.method === method)),
      cashRegisterName: row.cashSession?.cashRegister.name ?? null, itemCount: row.saleItem_sale.reduce((sum, item) => sum + item.quantity, 0),
      professionals: [...new Map(row.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem).map(c => [c.professionalId, { id: c.professionalId, name: c.professionalNameSnapshot }])).values()] }))
    return { status: 200, body: json({ ...page, items, period: { start: period.start, end: period.end, timezone, dateField: query.dateField } }) }
  })
}

export function saleHistory(client: CheckoutClient, ctx: Context, id: string) {
  return read(client, async tx => {
    const { who, timezone } = await context(tx, ctx), barbershopId = ctx.barbershopId, owner = ctx.session.tenantRole === "BARBERSHOP_OWNER"
    const row = await tx.sale.findFirst({ where: { barbershopId, id }, select: { ...saleSelect,
      customer: { select: customerSelect }, operator: { select: actorSelect }, canceledBy: { select: actorSelect },
      cashSession: { select: { id: true, status: true, cashRegister: { select: { name: true } } } },
    } })
    check(row, 404, "Venda não encontrada.")
    ownOperation(ctx, who, row.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem), row.saleTip_sale)
    const { customer, operator, cashSession, ...base } = row
    const itemIds = base.saleItem_sale.map(item => item.id), componentIds = base.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem.map(c => c.id))
    const [stock, cash, commissions, audit] = await Promise.all([
      tx.inventoryMovement.findMany({ where: { barbershopId, saleItemId: { in: itemIds } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, saleItemId: true, kind: true, quantityDelta: true, reason: true, createdAt: true, reversalOfId: true, actor: { select: actorSelect } } }),
      ctx.session.tenantRole !== "BARBER" ? tx.cashMovement.findMany({ where: { barbershopId, saleId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: movementSelect }) : Promise.resolve([]),
      owner ? tx.commissionEntry.findMany({ where: { barbershopId, componentId: { in: componentIds } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, kind: true, status: true, amountCents: true, createdAt: true, reversalOfId: true, component: { select: { professionalNameSnapshot: true } } } }) : Promise.resolve(null),
      owner ? tx.checkoutAuditEvent.findMany({ where: { barbershopId, entity: "Sale", entityId: id }, take: 51, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { action: true, createdAt: true, metadata: true, actor: { select: actorSelect } } }) : Promise.resolve([]),
    ])
    const sale = presentSale(base)
    const items = sale.items.map(item => ({ ...item, components: item.components.map(component => owner ? component : {
      id: component.id, serviceId: component.serviceId, professionalId: component.professionalId, serviceNameSnapshot: component.serviceNameSnapshot,
      professionalNameSnapshot: component.professionalNameSnapshot, durationMinutesSnapshot: component.durationMinutesSnapshot, unitOrdinal: component.unitOrdinal, componentOrdinal: component.componentOrdinal,
    }) }))
    return { status: 200, body: json({ ...sale, items, history: {
      customerName: customer?.customerAccount.name ?? null, operatorName: operator.nameSnapshot, canceledByName: base.canceledBy?.nameSnapshot ?? null,
      cashSession: cashSession ? { id: cashSession.id, name: cashSession.cashRegister.name, status: cashSession.status } : null,
      stock: stock.map(m => ({ id: m.id, itemId: m.saleItemId, kind: m.kind, quantityDelta: m.quantityDelta, reason: m.reason, createdAt: m.createdAt, reversalOfId: m.reversalOfId, actor: m.actor.nameSnapshot })),
      cash: ctx.session.tenantRole === "BARBER" ? [] : cash.map(movementDto),
      commissions: commissions?.map(c => ({ id: c.id, kind: c.kind, status: c.status, amountCents: c.amountCents, createdAt: c.createdAt, reversalOfId: c.reversalOfId, professionalName: c.component.professionalNameSnapshot })) ?? null,
      audit: audit.slice(0, 50).map(a => ({ action: a.action, createdAt: a.createdAt, actor: a.actor.nameSnapshot, ...(a.action === "sale.edit" ? { revision: revisionSummary(a.metadata) } : {}) })), auditHasMore: audit.length > 50, timezone,
    } }) }
  })
}

export function listCashSessions(client: CheckoutClient, ctx: Context, params: URLSearchParams) {
  const query = historyQuery(params, "cash-sessions"), scope = pageScope(ctx, "cash-sessions", params)
  check(!query.cursor || query.cursor.scope === scope, 400, "Cursor incompatível com os filtros.")
  return read(client, async tx => {
    const { timezone } = await context(tx, ctx, true), barbershopId = ctx.barbershopId, period = historyPeriod(params, timezone)
    const filters = saleFilters(barbershopId, query)
    const rows = await tx.cashSession.findMany({ where: { barbershopId, [query.dateField]: period.current, AND: [boundary(query.cursor, "openedAt")],
      ...(query.status ? { status: query.status as CashSessionStatus } : {}), ...(query.cashRegisterId ? { cashRegisterId: query.cashRegisterId } : {}),
      ...(query.customerId || query.professionalId || query.customerQuery || query.professionalQuery ? { OR: [{ sale_cashSession: { some: filters } }, { cashMovement_cashSession: { some: { barbershopId, sale: filters } } }] } : {}),
    }, orderBy: [{ openedAt: "desc" }, { id: "desc" }], take: query.pageSize + 1, select: sessionSelect })
    const page = pageResult(rows, query.pageSize, scope, row => row.openedAt)
    return { status: 200, body: json({ ...page, items: page.items.map(sessionDto), period: { start: period.start, end: period.end, timezone, dateField: query.dateField } }) }
  })
}

export function cashHistory(client: CheckoutClient, ctx: Context, id: string, params: URLSearchParams) {
  const query = historyQuery(params, "movements"), scope = pageScope(ctx, `cash:${id}`, params)
  check(!query.cursor || query.cursor.scope === scope, 400, "Cursor incompatível com os filtros.")
  return read(client, async tx => {
    const { timezone } = await context(tx, ctx, true), barbershopId = ctx.barbershopId
    const row = await tx.cashSession.findFirst({ where: { barbershopId, id }, select: { ...sessionSelect, ...(ctx.session.tenantRole === "BARBERSHOP_OWNER" ? { notes: true } : {}) } })
    check(row, 404, "Sessão de caixa não encontrada.")
    const eligible = { barbershopId, cashSessionId: id, finalizedAt: { not: null }, status: { in: ["PAID", "CANCELED"] as SaleStatus[] } }
    const [movements, groups, payments, sales] = await Promise.all([
      tx.cashMovement.findMany({ where: { barbershopId, cashSessionId: id, AND: [boundary(query.cursor, "createdAt")] }, take: query.pageSize + 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: movementSelect }),
      tx.cashMovement.groupBy({ by: ["kind"], where: { barbershopId, cashSessionId: id }, _sum: { amountCents: true } }),
      tx.payment.groupBy({ by: ["method"], where: { barbershopId, sale: eligible }, _sum: { appliedCents: true, refundedCents: true, cashReceivedCents: true, changeCents: true } }),
      tx.sale.groupBy({ by: ["status"], where: eligible, _sum: { totalCents: true } }),
    ])
    const totals = groups.map(g => ({ kind: g.kind, amountCents: g._sum.amountCents ?? 0 })), page = pageResult(movements, query.pageSize, scope, m => m.createdAt)
    return { status: 200, body: json({ session: sessionDto(row), notes: ctx.session.tenantRole === "BARBERSHOP_OWNER" ? row.notes ?? null : null,
      ledgerBalanceCents: cashBalance(totals), totals, ...cashHistoryTotals(payments, sales), movements: { ...page, items: page.items.map(movementDto) }, timezone }) }
  })
}
