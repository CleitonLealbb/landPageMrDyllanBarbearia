"use client";
import { displayName } from "../display"
import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CheckoutController } from "../controller";
import { Catalog } from "./catalog";
import { CashPanel } from "./cash-panel";
import { ReceiptPanel } from "./receipt-panel";
import { CheckoutFeedback } from "./checkout-feedback";
import { CheckoutHistoryPanel } from "./history-panel";
import styles from "./checkout.module.css";
import { estimate, money } from "../helpers";
import { draftTipValue } from "../pending-draft";

export function CheckoutScreen({
  controller: provided,
}: {
  controller?: CheckoutController;
}) {
  const [controller] = useState(() => provided ?? new CheckoutController());
  const [view, setView] = useState<"sale" | "sales" | "cash-sessions">("sale");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    if (!provided) void controller.load();
  }, [controller, provided]);
  useEffect(() => {
    if (!state.retry && state.sale?.status !== "PENDING") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.retry, state.sale?.status]);
  const itemCount = state.sale && !state.editing
    ? state.sale.items.reduce((sum, item) => sum + item.quantity, 0)
    : state.lines.reduce((sum, line) => sum + line.quantity, 0);
  let mobileTotal: string = "—";
  try {
    mobileTotal = money(!state.editing && state.sale ? state.sale.totalCents : estimate(state.lines, state.discountKind, state.discount, draftTipValue(state)).totalCents);
  } catch { /* Incomplete draft input must not display a false total. */ }
  return (
    <div
      className={`${styles.workspace} mx-auto grid w-full max-w-[1920px] items-start pb-24 md:pb-0 ${view === "sale" ? "lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)] xl:grid-cols-[minmax(0,1.85fr)_minmax(350px,1fr)]" : ""}`}
      aria-busy={state.loading || state.busy}
    >
      <section aria-label="Catálogo e caixa" className="min-w-0">
      <header
        className="grid gap-3 border-b border-border bg-card/40 p-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <SidebarTrigger className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">
              PDV &amp; Checkout
            </h1>
            <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {state.data
              ? `Operador: ${displayName(state.data.operator.name, "Operador")}`
              : "Carregando operador…"}
            </p>
            {state.data && <p className="mt-1 w-fit rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary">{({ BARBERSHOP_OWNER: "Proprietário", ASSISTANT: "Assistente", BARBER: "Barbeiro · atendimentos próprios" })[state.data.operator.role]}</p>}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-auto min-h-8 max-w-full whitespace-normal border-border/60 py-2 text-left text-[11px]"
            disabled={state.loading || state.busy || state.retry}
            onClick={() => {
              void controller.load();
            }}
          >
            <RefreshCw className="mr-2 h-3 w-3" aria-hidden="true" />
            Atualizar catálogo e caixa
          </Button>
          </div>
        </div>
        {state.data && view === "sale" && <CashPanel state={state} controller={controller} />}
        {state.data && <div role="group" aria-label="Áreas do Checkout" className="flex flex-wrap gap-2 xl:col-span-2">
          <Button size="sm" variant={view === "sale" ? "secondary" : "ghost"} aria-pressed={view === "sale"} onClick={() => setView("sale")}>Nova venda</Button>
          <Button size="sm" variant={view === "sales" ? "secondary" : "ghost"} aria-pressed={view === "sales"} onClick={() => setView("sales")}>Histórico de vendas</Button>
          {state.data.operator.permissions.cash && <Button size="sm" variant={view === "cash-sessions" ? "secondary" : "ghost"} aria-pressed={view === "cash-sessions"} onClick={() => setView("cash-sessions")}>Histórico de caixas</Button>}
        </div>}
      </header>
      <div className="space-y-2 px-4 pt-3"><CheckoutFeedback state={state} controller={controller} /></div>
      {state.loading && !state.data && (
        <div role="status" className="grid animate-pulse gap-4 lg:grid-cols-3">
          <span className="sr-only">Carregando Checkout…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-muted" />
          ))}
        </div>
      )}
      {state.data && view === "sale" && <div className="p-4"><Catalog state={state} controller={controller} /></div>}
      </section>
      {state.data && view === "sale" && <ReceiptPanel state={state} controller={controller} itemCount={itemCount} total={mobileTotal} />}
      {state.data && view !== "sale" && <CheckoutHistoryPanel key={view} kind={view} data={state.data}
        blockedSaleId={state.busy || state.retry || state.editing ? state.sale?.id : undefined}
        onOperate={async (id, edit) => { const opened = await controller.openFromHistory(id, edit); if (opened) setView("sale"); return opened }}
        onMutation={id => { if (state.sale?.id === id && !state.editing) void controller.readSale() }} />}
    </div>
  );
}
