import { CheckoutHttp, CheckoutRequestError } from "./http";
import { amount, CheckoutInputError, estimate, paymentInput } from "./helpers";
import { formatPaymentCents, paymentError, paymentRemaining, syncPaymentRemainder } from "./payment-draft";
import { draftTipValue, financialSnapshot, pendingDraft } from "./pending-draft";
import type {
  Bootstrap,
  CartLine,
  CashResult,
  Customer,
  Kind,
  Method,
  PaymentDraft,
  Sale,
} from "./types";
import {
  cancelSchema,
  closeSchema,
  createSaleSchema,
  editSaleSchema,
  finalizeSchema,
  movementSchema,
  openSchema,
  voidSchema,
} from "@/lib/checkout/validation";

export type CheckoutState = {
  editing?: boolean;
  extraTips?: { professionalId: string; amountCents: number }[];
  data: Bootstrap | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  status: number | null;
  notice: string | null;
  retry: boolean;
  lines: CartLine[];
  customer: Customer | null;
  customers: Customer[];
  customerSearching: boolean;
  registerId: string;
  discountKind: "FIXED" | "PERCENT";
  discount: string;
  tip: string;
  tipProfessionalId: string;
  payments: PaymentDraft[];
  sale: Sale | null;
  cashResult: CashResult | null;
};
export class CheckoutController {
  private state: CheckoutState;
  private listeners = new Set<() => void>();
  private retryWork: (() => Promise<void>) | null = null;
  private searchVersion = 0;
  constructor(
    private http = new CheckoutHttp(),
    data: Bootstrap | null = null,
  ) {
    this.state = {
      data,
      loading: !data,
      busy: false,
      error: null,
      status: null,
      notice: null,
      retry: false,
      lines: [],
      customer: null,
      customers: [],
      customerSearching: false,
      registerId: data?.cashRegisters[0]?.id ?? "",
      discountKind: "FIXED",
      discount: "",
      tip: "",
      tipProfessionalId: data?.operator.professionalId ?? "",
      payments: [],
      sale: null,
      cashResult: null,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(change: Partial<CheckoutState>) {
    this.state = { ...this.state, ...change };
    if (("sale" in change || "payments" in change) && this.state.sale?.status === "PENDING")
      this.state = { ...this.state, payments: syncPaymentRemainder(this.state.payments, this.state.sale.totalCents) };
    this.listeners.forEach((listener) => listener());
  }
  editable() {
    return !this.state.busy && !this.state.retry && (!this.state.sale || (this.state.editing === true && this.state.sale.status === "PENDING"));
  }
  beginEdit() {
    if (this.state.busy || this.state.retry || this.state.sale?.status !== "PENDING" || !this.state.data?.operator.permissions.sell) return;
    try { this.patch({ ...pendingDraft(this.state.sale), editing: true, error: null, notice: "Alterações ainda não salvas. O servidor recalculará preços e totais ao salvar." }); }
    catch (error) { this.fail(error); }
  }
  cancelEdit() {
    if (!this.state.editing || this.state.busy || this.state.retry || !this.state.sale) return;
    this.patch({ ...pendingDraft(this.state.sale), editing: false, error: null, notice: "Alterações não salvas canceladas." });
  }
  removeExtraTip(professionalId: string) {
    if (this.editable()) this.patch({ extraTips: this.state.extraTips?.filter(tip => tip.professionalId !== professionalId) });
  }
  clearFeedback() {
    if (!this.state.busy && !this.state.retry)
      this.patch({ notice: null, error: null, status: null });
  }
  set(
    change: Partial<
      Pick<
        CheckoutState,
        | "registerId"
        | "discountKind"
        | "discount"
        | "tip"
        | "tipProfessionalId"
        | "customer"
      >
    >,
  ) {
    if (this.state.busy || this.state.retry) return;
    if (
      this.state.sale && !this.state.editing &&
      Object.keys(change).some((key) => key !== "registerId")
    )
      return;
    if (
      ("discount" in change || "discountKind" in change) &&
      !this.state.data?.operator.permissions.discount
    )
      return;
    this.patch(change);
  }
  private fail(error: unknown) {
    this.patch({
      error:
        error instanceof CheckoutRequestError ||
        error instanceof CheckoutInputError
          ? error.message
          : "Não foi possível confirmar a operação. Tente novamente com segurança.",
      status: error instanceof CheckoutRequestError ? error.status : null,
    });
  }
  async load() {
    this.patch({ loading: true, error: null });
    try {
      await this.refresh();
    } catch (error) {
      this.fail(error);
    } finally {
      this.patch({ loading: false });
    }
  }
  private async refresh() {
    const data = await this.http.get<Bootstrap>("bootstrap");
    this.patch({
      data,
      registerId: data.cashRegisters.some((r) => r.id === this.state.registerId)
        ? this.state.registerId
        : (data.cashRegisters[0]?.id ?? ""),
      tipProfessionalId:
        this.state.tipProfessionalId || data.operator.professionalId || "",
    });
  }
  async searchCustomers(query: string) {
    const version = ++this.searchVersion,
      normalized = query.normalize("NFKC").trim().replace(/\s+/g, " ");
    this.patch({ customers: [], customerSearching: normalized.length >= 2 });
    if (normalized.length < 2 || normalized.length > 80) {
      this.patch({ customerSearching: false });
      return;
    }
    try {
      const data = await this.http.get<Bootstrap>(
        `bootstrap?customerQuery=${encodeURIComponent(normalized)}`,
      );
      if (version === this.searchVersion)
        this.patch({ customers: data.customers });
    } catch (error) {
      if (version === this.searchVersion) this.fail(error);
    } finally {
      if (version === this.searchVersion)
        this.patch({ customerSearching: false });
    }
  }
  add(kind: Kind, id: string) {
    const { data, lines } = this.state;
    if (!data || !this.editable()) return;
    const item = (
      kind === "SERVICE"
        ? data.services
        : kind === "PACKAGE"
          ? data.packages
          : data.products
    ).find((i) => i.id === id);
    if (!item) return;
    if (kind === "PRODUCT") {
      const previous = lines.find(
        (line) => line.kind === kind && line.catalogId === id,
      );
      if (previous) {
        this.quantity(previous.key, previous.quantity + 1);
        return;
      }
      if (!data.products.find((p) => p.id === id)?.availableQuantity) {
        this.patch({ error: "Produto sem estoque disponível." });
        return;
      }
    }
    const services =
      kind === "SERVICE"
        ? data.services.filter((s) => s.id === id)
        : kind === "PACKAGE"
          ? data.packages.find((p) => p.id === id)!.services
          : [];
    const assignments = services.map((service) => ({
      serviceId: service.id,
      name: service.name,
      professionalId:
        data.professionals.find(
          (p) =>
            p.id === data.operator.professionalId &&
            p.serviceIds.includes(service.id),
        )?.id ??
        data.professionals.find((p) => p.serviceIds.includes(service.id))?.id ??
        "",
    }));
    this.patch({
      error: null,
      lines: [
        ...lines,
        {
          key: crypto.randomUUID(),
          kind,
          catalogId: id,
          name: item.name,
          priceCents: item.priceCents,
          durationMinutes:
            "durationMinutes" in item ? item.durationMinutes : null,
          quantity: 1,
          assignments,
        },
      ],
    });
  }
  quantity(key: string, quantity: number) {
    if (!this.editable()) return;
    const line = this.state.lines.find((l) => l.key === key);
    if (!line) return;
    const available =
      line.kind === "PRODUCT"
        ? (this.state.data?.products.find((p) => p.id === line.catalogId)
            ?.availableQuantity ?? 0)
        : 100;
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > Math.min(100, available)
    ) {
      this.patch({
        error:
          "Quantidade inválida ou superior ao estoque informado. Atualize o catálogo.",
      });
      return;
    }
    this.patch({
      error: null,
      lines: this.state.lines.map((l) =>
        l.key === key ? { ...l, quantity } : l,
      ),
    });
  }
  remove(key: string) {
    if (this.editable())
      this.patch({ lines: this.state.lines.filter((l) => l.key !== key) });
  }
  clearCart() {
    if (!this.editable() || this.state.sale) return;
    ++this.searchVersion;
    this.patch({
      lines: [],
      customer: null,
      customers: [],
      customerSearching: false,
      payments: [],
      discount: "",
      tip: "",
    });
  }
  assign(key: string, serviceId: string, professionalId: string) {
    if (
      !this.editable() ||
      !this.state.data?.professionals.some(
        (p) => p.id === professionalId && p.serviceIds.includes(serviceId),
      )
    )
      return;
    this.patch({
      lines: this.state.lines.map((l) =>
        l.key === key
          ? {
              ...l,
              assignments: l.assignments.map((a) =>
                a.serviceId === serviceId ? { ...a, professionalId } : a,
              ),
            }
          : l,
      ),
    });
  }
  payment(id: string, change: Partial<Pick<PaymentDraft, "method" | "amount" | "received" | "confirmed">>) {
    if (
      this.state.busy ||
      this.state.retry ||
      this.state.sale?.status !== "PENDING"
    )
      return;
    const current = this.state.payments.find(payment => payment.id === id);
    if (!current) return;
    if (current.confirmed) {
      if (change.confirmed === false && Object.keys(change).every(key => key === "confirmed"))
        this.patch({ payments: this.state.payments.map(payment => payment.id === id ? { ...payment, confirmed: false } : payment), error: null });
      else this.patch({ error: "Desconfirme o recebimento antes de editar ou remover este pagamento." });
      return;
    }
    const updated: PaymentDraft = { ...current, ...change, id, confirmed: false };
    if ("amount" in change) updated.amountMode = "MANUAL";
    if (change.method && change.method !== current.method) {
      updated.receivedMode = "AUTO";
      updated.received = change.method === "CASH" ? updated.amount : "";
    }
    if ("received" in change) { updated.received = change.received!; updated.receivedMode = "MANUAL"; }
    const payments = syncPaymentRemainder(this.state.payments.map(payment => payment.id === id ? updated : payment), this.state.sale.totalCents);
    const error = change.confirmed ? paymentError(payments, this.state.sale.totalCents, id) : null;
    this.patch({ payments: payments.map(payment => payment.id === id && change.confirmed && !error ? { ...payment, confirmed: true, reviewRequired: false } : payment), error });
  }
  addPayment(method: Method = "PIX") {
    if (
      !this.state.busy &&
      !this.state.retry &&
      this.state.sale?.status === "PENDING" &&
      this.state.payments.length < 20
    ) {
      const remaining = paymentRemaining(this.state.payments, this.state.sale.totalCents);
      if (remaining === null) { this.patch({ error: "Confira os valores informados antes de adicionar outro pagamento." }); return; }
      const value = formatPaymentCents(remaining);
      this.patch({
        error: null,
        payments: [
          ...this.state.payments,
          {
            id: crypto.randomUUID(),
            method,
            amount: value,
            received: method === "CASH" ? value : "",
            amountMode: "AUTO",
            receivedMode: "AUTO",
            confirmed: false,
          },
        ],
      });
    }
  }
  usePaymentRemaining(id: string) {
    if (this.state.busy || this.state.retry || this.state.sale?.status !== "PENDING") return;
    const current = this.state.payments.find(payment => payment.id === id);
    if (!current || current.confirmed) return;
    const remaining = paymentRemaining(this.state.payments, this.state.sale.totalCents, id);
    if (remaining === null) { this.patch({ error: "Confira os valores dos outros pagamentos antes de usar o restante." }); return; }
    this.patch({ error: null, payments: this.state.payments.map(payment => payment.id === id ? { ...payment, amount: formatPaymentCents(remaining), amountMode: "AUTO" } : payment) });
  }
  removePayment(id: string) {
    if (!this.state.busy && !this.state.retry && this.state.sale?.status === "PENDING") {
      if (this.state.payments.find(payment => payment.id === id)?.confirmed) { this.patch({ error: "Desconfirme o recebimento antes de editar ou remover este pagamento." }); return; }
      this.patch({ error: null, payments: this.state.payments.filter((p) => p.id !== id) });
    }
  }
  async create() {
    if (!this.editable() || this.state.sale && !this.state.editing) return;
    try {
      const s = this.state,
        data = s.data;
      if (!data?.operator.permissions.sell)
        throw new Error("Sem permissão para vender.");
      if (s.lines.some((l) => l.assignments.some((a) => !a.professionalId)))
        throw new Error(
          "Selecione um profissional habilitado para cada serviço.",
        );
      if (
        data.operator.role === "BARBER" &&
        !s.lines.some((l) => l.kind !== "PRODUCT")
      )
        throw new Error(
          "O barbeiro só pode vender com seus próprios atendimentos.",
        );
      estimate(s.lines, s.discountKind, s.discount, draftTipValue(s));
      const input = createSaleSchema.parse({
        ...(s.customer ? { customerId: s.customer.id } : {}),
        items: s.lines.map((l) => ({
          kind: l.kind,
          catalogId: l.catalogId,
          quantity: l.quantity,
          ...(l.kind === "SERVICE"
            ? { professionalId: l.assignments[0]?.professionalId }
            : l.kind === "PACKAGE"
              ? {
                  components: l.assignments.map((a) => ({
                    serviceId: a.serviceId,
                    professionalId: a.professionalId,
                  })),
                }
              : {}),
        })),
        ...(s.discount && data.operator.permissions.discount
          ? {
              discount:
                s.discountKind === "FIXED"
                  ? { kind: "FIXED", amountCents: amount(s.discount) }
                  : { kind: "PERCENT", basisPoints: amount(s.discount) },
            }
          : {}),
        tips: [...(amount(s.tip || "0")
          ? [
              {
                professionalId: s.tipProfessionalId,
                amountCents: amount(s.tip),
              },
            ]
          : []), ...(s.extraTips ?? [])],
      });
      const previous = s.sale;
      const editInput = previous ? editSaleSchema.parse({ ...input, expectedVersion: previous.version }) : null;
      await this.mutate(async () => {
        const sale = previous && editInput ? await this.http.patch<Sale>(`sales/${encodeURIComponent(previous.id)}`, editInput) : await this.http.post<Sale>("sales", input);
        const changed = previous !== null && financialSnapshot(previous) !== financialSnapshot(sale);
        this.patch({
          sale, editing: false,
          ...(changed ? { payments: this.state.payments.map(payment => ({ ...payment, reviewRequired: payment.confirmed || payment.reviewRequired, confirmed: false })) } : {}),
          notice: changed ? "A comanda foi alterada. Revise e confirme novamente os pagamentos." : previous ? "Alterações salvas. Confirme os pagamentos para finalizar." : "Comanda criada. Confirme os pagamentos para finalizar.",
        });
      });
    } catch {
      this.patch({
        error:
          "Confira os itens, profissionais, desconto e gorjeta antes de criar a comanda.",
      });
    }
  }
  async finalize() {
    const s = this.state,
      session = s.data?.openSessions.find(
        (c) => c.cashRegisterId === s.registerId,
      );
    if (s.busy || s.retry || s.editing || s.sale?.status !== "PENDING") return;
    try {
      if (!session)
        throw new CheckoutInputError(
          "Abra ou selecione um caixa aberto para finalizar.",
        );
      const input = finalizeSchema.parse({
        cashSessionId: session.id,
        expectedVersion: s.sale.version,
        payments: paymentInput(s.payments, s.sale.totalCents),
      });
      const saleId = s.sale.id;
      await this.mutate(async () => {
        const sale = await this.http.post<Sale>(
          `sales/${encodeURIComponent(saleId)}/finalize`,
          input,
        );
        this.patch({
          sale,
          notice: "Venda finalizada com sucesso.",
        });
        await this.refresh();
      });
    } catch (error) {
      this.fail(error);
    }
  }
  async cancel(reason: string) {
    const s = this.state;
    if (
      !s.data?.operator.permissions.cancel ||
      !s.sale ||
      s.sale.status !== "PAID" ||
      s.busy ||
      s.retry
    )
      return;
    try {
      const session = s.data.openSessions.find(
          (c) => c.cashRegisterId === s.registerId,
        ),
        saleId = s.sale.id;
      const input = cancelSchema.parse({
        reason,
        ...(session ? { cashSessionId: session.id } : {}),
      });
      await this.mutate(async () => {
        const sale = await this.http.post<Sale>(
          `sales/${encodeURIComponent(saleId)}/cancel`,
          input,
        );
        this.patch({
          sale,
          notice: "Venda cancelada. Os lançamentos aplicáveis foram revertidos.",
        });
        await this.refresh();
      });
    } catch {
      this.patch({ error: "Informe o motivo do cancelamento." });
    }
  }
  async discard(reason: string) {
    const s = this.state;
    if (
      !s.data?.operator.permissions.sell ||
      s.sale?.status !== "PENDING" ||
      s.busy ||
      s.retry
    )
      return;
    try {
      const input = voidSchema.parse({ reason, expectedVersion: s.sale.version });
      const saleId = s.sale.id;
      await this.mutate(async () => {
        const sale = await this.http.post<Sale>(
          `sales/${encodeURIComponent(saleId)}/void`,
          input,
        );
        this.patch({
          sale,
          payments: [],
          notice: "Comanda descartada. Nenhuma movimentação financeira foi realizada.",
        });
      });
    } catch {
      this.patch({ error: "Informe o motivo do descarte." });
    }
  }
  async cash(
    action: "open" | "SUPPLY" | "WITHDRAWAL" | "close",
    value: string,
    reason: string,
  ) {
    const s = this.state;
    if (!s.data?.operator.permissions.cash || s.busy || s.retry) return;
    try {
      const session = s.data.openSessions.find(
          (c) => c.cashRegisterId === s.registerId,
        ),
        cents = amount(value);
      let path: string, input: unknown;
      if (action === "open") {
        path = "cash-sessions/open";
        input = openSchema.parse({
          cashRegisterId: s.registerId,
          openingBalanceCents: cents,
          shift: reason,
        });
      } else {
        if (!session) throw new Error("Selecione um caixa aberto.");
        if (action === "close") {
          path = `cash-sessions/${encodeURIComponent(session.id)}/close`;
          input = closeSchema.parse({
            countedBalanceCents: cents,
            notes: reason,
          });
        } else {
          path = "cash-movements";
          input = movementSchema.parse({
            cashSessionId: session.id,
            kind: action,
            amountCents: cents,
            reason,
          });
        }
      }
      await this.mutate(async () => {
        const result = await this.http.post<CashResult>(path, input);
        this.patch({
          cashResult: action === "close" ? result : null,
          notice: "Operação de caixa concluída.",
        });
        await this.refresh();
        this.http.acknowledged(path, input);
      });
    } catch {
      this.patch({
        error: "Confira o caixa, o valor e o turno ou motivo informado.",
      });
    }
  }
  async readSale() {
    if (!this.state.sale || this.state.busy || this.state.retry) return;
    const id = this.state.sale.id;
    this.patch({ busy: true, error: null });
    try {
      this.patch({
        sale: await this.http.get<Sale>(`sales/${encodeURIComponent(id)}`),
      });
    } catch (error) {
      this.fail(error);
    } finally {
      this.patch({ busy: false });
    }
  }
  async reloadConflict() {
    if (this.state.status !== 409 || !this.state.sale || this.state.busy || this.state.retry) return;
    const id = this.state.sale.id;
    this.patch({ busy: true });
    try {
      const sale = await this.http.get<Sale>(`sales/${encodeURIComponent(id)}`);
      this.patch({ sale, editing: false, lines: [], customer: null, error: null, status: null,
        payments: this.state.payments.map(payment => ({ ...payment, confirmed: false, reviewRequired: true })),
        notice: "Versão atual carregada. As alterações locais foram abandonadas. Confira a comanda antes de continuar." });
    } catch (error) { this.fail(error); }
    finally { this.patch({ busy: false }); }
  }
  async resume(id: string) {
    if (
      !this.editable() ||
      this.state.lines.length ||
      !id.trim() ||
      id.length > 100
    )
      return;
    this.patch({ busy: true, error: null });
    try {
      this.patch({
        sale: await this.http.get<Sale>(
          `sales/${encodeURIComponent(id.trim())}`,
        ),
        customer: null,
        notice:
          "Venda recuperada. Os valores e o estado foram consultados no servidor.",
      });
    } catch (error) {
      this.fail(error);
    } finally {
      this.patch({ busy: false });
    }
  }
  private async mutate(work: () => Promise<void>) {
    if (this.state.busy || this.state.retry) return;
    this.patch({ busy: true, error: null, status: null, notice: null });
    try {
      await work();
      this.retryWork = null;
      this.patch({ retry: false });
    } catch (error) {
      const uncertain =
        !(error instanceof CheckoutRequestError) || error.status >= 500;
      if (uncertain) {
        this.retryWork = work;
        this.patch({ retry: true });
      }
      this.fail(error);
    } finally {
      this.patch({ busy: false });
    }
  }
  async retry() {
    const work = this.retryWork;
    if (work && !this.state.busy) {
      this.patch({ retry: false });
      await this.mutate(work);
    }
  }
  newSale() {
    if (
      this.state.busy ||
      this.state.retry ||
      !["PAID", "VOIDED", "CANCELED"].includes(this.state.sale?.status ?? "")
    )
      return;
    this.http.newIntent();
    this.patch({
      sale: null,
      editing: false,
      extraTips: [],
      lines: [],
      customer: null,
      customers: [],
      payments: [],
      discount: "",
      tip: "",
      error: null,
      notice: null,
    });
  }
}
