import type { Sale } from "./types"

export type HistoryKind = "sales" | "cash-sessions"
export type HistoryPage<T> = {
  items: T[]; pageSize: number; hasMore: boolean; nextCursor: string | null;
  period: { start: string; end: string; timezone: string; dateField: string }
}
export type SaleHistoryRow = {
  id: string; status: Sale["status"]; closureKind: "VOIDED" | "CANCELED" | "LEGACY_VOIDED" | null;
  createdAt: string; finalizedAt: string | null; canceledAt: string | null; voidedAt: string | null;
  totalCents: number; customer: { id: string; name: string } | null;
  professionals: { id: string; name: string }[]; itemCount: number; cashRegisterName: string | null
}
export type CashHistoryRow = {
  id: string; cashRegisterName: string; status: "OPEN" | "CLOSED"; shift: string;
  openedAt: string; closedAt: string | null; openedBy: string; closedBy: string | null;
  openingBalanceCents: number; expectedBalanceCents: number | null; countedBalanceCents: number | null; differenceCents: number | null
}
export type HistoryMovement = {
  id: string; kind: string; amountCents: number; reason: string; createdAt: string;
  actor: string; saleId: string | null; reversalOfId: string | null
  cashSession: { id: string; name: string; status: "OPEN" | "CLOSED" }
}
export type SaleHistoryDetail = Omit<Sale, "payments"> & {
  cancellationReason: string | null;
  payments: (Sale["payments"][number] & { cashReceivedCents: number | null; recordedAt: string; refundedAt: string | null })[];
  history: {
    customerName: string | null; operatorName: string; canceledByName: string | null;
    cashSession: { id: string; name: string; status: "OPEN" | "CLOSED" } | null;
    stock: { id: string; itemId: string | null; kind: string; quantityDelta: number; reason: string; createdAt: string; reversalOfId: string | null; actor: string }[];
    cash: HistoryMovement[];
    commissions: { id: string; professionalName: string; kind: string; status: string; amountCents: number; createdAt: string; reversalOfId: string | null }[] | null;
    audit: { action: string; createdAt: string; actor: string; revision?: { before: { version: number; totalCents: number; itemCount: number }; after: { version: number; totalCents: number; itemCount: number } } | null }[];
    auditHasMore: boolean; timezone: string
  }
}
export type CashHistoryDetail = {
  session: CashHistoryRow; notes: string | null; ledgerBalanceCents: number;
  totals: { kind: string; amountCents: number }[];
  movements: { items: HistoryMovement[]; pageSize: number; hasMore: boolean; nextCursor: string | null };
  timezone: string
}
