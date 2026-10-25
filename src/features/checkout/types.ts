export type Role = "BARBERSHOP_OWNER" | "ASSISTANT" | "BARBER";
export type Kind = "SERVICE" | "PACKAGE" | "PRODUCT";
export type Method = "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD";
export type Service = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  category: { id: string; name: string } | null;
};
export type Package = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  services: Service[];
};
export type Product = {
  id: string;
  name: string;
  priceCents: number;
  availableQuantity: number;
};
export type Professional = { id: string; name: string; serviceIds: string[] };
export type Customer = { id: string; name: string };
export type OpenSession = {
  id: string;
  cashRegisterId: string;
  status: "OPEN";
  openedAt?: string;
  operatorName?: string;
  openingBalanceCents?: number;
};
export type Bootstrap = {
  operator: {
    id: string;
    name: string;
    role: Role;
    professionalId: string | null;
    permissions: {
      sell: boolean;
      cash: boolean;
      discount: boolean;
      cancel: boolean;
    };
  };
  services: Service[];
  packages: Package[];
  professionals: Professional[];
  products: Product[];
  cashRegisters: { id: string; name: string }[];
  openSessions: OpenSession[];
  customers: Customer[];
};
export type CartLine = {
  persistedId?: string;
  key: string;
  kind: Kind;
  catalogId: string;
  name: string;
  priceCents: number;
  durationMinutes: number | null;
  quantity: number;
  assignments: { serviceId: string; name: string; professionalId: string }[];
};
export type PaymentDraft = {
  reviewRequired?: boolean;
  id: string;
  method: Method;
  amount: string;
  received: string;
  confirmed: boolean;
  amountMode?: "AUTO" | "MANUAL";
  receivedMode?: "AUTO" | "MANUAL";
};
export type Sale = {
  discountKind?: "NONE" | "MANUAL_FIXED" | "MANUAL_PERCENT" | "COUPON";
  discountBasisPoints?: number | null;
  id: string;
  status: "DRAFT" | "PENDING" | "PAID" | "VOIDED" | "CANCELED";
  closureKind?: "VOIDED" | "CANCELED" | "LEGACY_VOIDED" | null;
  version: number;
  customerId: string | null;
  servicesSubtotalCents: number;
  productsSubtotalCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  createdAt: string;
  finalizedAt: string | null;
  canceledAt: string | null;
  cancellationReason?: string | null;
  canceledByName?: string | null;
  voidedAt?: string | null;
  voidedByName?: string | null;
  voidReason?: string | null;
  items: {
    serviceId?: string | null;
    packageId?: string | null;
    productId?: string | null;
    unitPriceCents?: number;
    id: string;
    kind: Kind;
    nameSnapshot: string;
    quantity: number;
    totalCents: number;
    durationMinutesSnapshot: number | null;
    components: {
      allocatedGrossCents?: number;
      allocatedDiscountCents?: number;
      commissionBaseCents?: number;
      commissionBasisPoints?: number;
      commissionCents?: number;
      serviceId?: string | null;
      professionalId?: string;
      unitOrdinal?: number;
      professionalNameSnapshot: string;
      serviceNameSnapshot: string;
    }[];
  }[];
  tips: { professionalId?: string; professionalNameSnapshot: string; amountCents: number }[];
  payments: {
    id: string;
    method: Method;
    status: string;
    appliedCents: number;
    changeCents: number;
    refundedCents: number;
  }[];
};
export type CashResult = {
  id: string;
  status: string;
  expectedBalanceCents: number | null;
  countedBalanceCents: number | null;
  differenceCents: number | null;
};
