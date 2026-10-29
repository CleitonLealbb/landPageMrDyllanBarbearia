"use client";
import { useState } from "react";
import { Banknote, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Choice, Field } from "./fields";
import { displayName } from "../display";
import { money } from "../helpers";
import type { CheckoutController, CheckoutState } from "../controller";
import { RegisterManager } from "./register-manager";

type Action = "open" | "close" | "SUPPLY" | "WITHDRAWAL";
const titles: Record<Action, string> = {
  open: "Abrir caixa",
  close: "Fechar caixa",
  SUPPLY: "Suprimento",
  WITHDRAWAL: "Sangria",
};
export function CashPanel({
  state,
  controller,
}: {
  state: CheckoutState;
  controller: CheckoutController;
}) {
  const [action, setAction] = useState<Action | null>(null),
    [value, setValue] = useState(""),
    [reason, setReason] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const data = state.data!,
    session = data.openSessions.find(
      (s) => s.cashRegisterId === state.registerId,
    ),
    locked = state.busy || state.retry;
  const start = (next: Action) => {
    controller.clearFeedback();
    if (next !== "open") setValue("");
    setReason("");
    setAction(next);
  };
  return (
    <section aria-label="Controle do caixa" className="min-w-0 space-y-2">
      <div className="grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
      <Choice
        label="Caixa da operação"
        disabled={locked}
        value={state.registerId}
        onChange={(e) => controller.set({ registerId: e.target.value })}
      >
        <option value="" disabled>
          Selecione um caixa
        </option>
        {data.cashRegisters.map((r, index) => (
          <option key={r.id} value={r.id}>
            {displayName(r.name === r.id ? "" : r.name, `Caixa ${index + 1}`)}
          </option>
        ))}
      </Choice>
      </div>
      <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-background/30 px-2.5 py-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${session ? "bg-primary" : "bg-muted-foreground"}`} />
          {session ? "Caixa aberto" : "Caixa fechado"}
        </div>
        {session?.openingBalanceCents !== undefined && <div className="min-w-0 border-l border-border/60 pl-3"><p className="text-[9px] text-muted-foreground">Saldo inicial</p><p className="text-xs font-semibold tabular-nums">{money(session.openingBalanceCents)}</p></div>}
      </div>
      </div>
      {!data.cashRegisters.length && (
        <p role="status" className="text-sm text-primary">
          Nenhum caixa ativo. Solicite a configuração de um caixa para finalizar
          vendas.
        </p>
      )}
      {!data.cashRegisters.length && data.operator.role === "BARBERSHOP_OWNER" && <Button variant="outline" disabled={locked} onClick={() => setConfiguring(true)}>Configurar caixas</Button>}
      <Dialog open={configuring} onOpenChange={setConfiguring}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Caixa e PDV</DialogTitle><DialogDescription>Configuração dos caixas físicos da barbearia.</DialogDescription></DialogHeader>
          {configuring && data.operator.role === "BARBERSHOP_OWNER" && <RegisterManager onSaved={async id => { await controller.registerUpdated(id); setConfiguring(false); }} />}
        </DialogContent>
      </Dialog>
      {session && (session.operatorName || session.openedAt) && (
        <p className="text-[10px] text-muted-foreground">
          {session.operatorName ? `Aberto por ${displayName(session.operatorName, "Operador")}` : "Caixa aberto"}
          {session.openedAt
            ? ` • Abertura: ${new Date(session.openedAt).toLocaleString("pt-BR")}`
            : ""}
        </p>
      )}
      {data.operator.permissions.cash ? (
        <div className="flex flex-wrap gap-2 [&_button]:h-8 [&_button]:text-[11px]">
          {session ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={locked}
                onClick={() => start("SUPPLY")}
              >
                <Banknote className="mr-1 h-3 w-3" aria-hidden="true" />
                Suprimento
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={locked}
                onClick={() => start("WITHDRAWAL")}
              >
                Sangria
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                disabled={locked}
                onClick={() => start("close")}
              >
                <LockKeyhole className="mr-1 h-3 w-3" aria-hidden="true" />
                Fechar caixa
              </Button>
            </>
          ) : (
            <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="min-w-0 max-w-40"><Field label="Saldo inicial (R$)" inputMode="decimal" placeholder="0,00" value={value} disabled={locked || !state.registerId} onChange={event => setValue(event.target.value)} /></div>
            <Button
              size="sm"
              disabled={locked || !state.registerId}
              onClick={() => start("open")}
            >
              Abrir caixa
            </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Caixa disponível para finalizar seus próprios atendimentos. Movimentações restritas aos responsáveis autorizados.
        </p>
      )}
      {state.cashResult?.status === "CLOSED" && (
        <div role="status" className="rounded-lg border p-3 text-xs">
          <p>Fechamento confirmado</p>
          <p>Esperado: {money(state.cashResult.expectedBalanceCents ?? 0)}</p>
          <p>Contado: {money(state.cashResult.countedBalanceCents ?? 0)}</p>
          <p>Diferença: {money(state.cashResult.differenceCents ?? 0)}</p>
        </div>
      )}
      <Dialog
        open={!!action && !state.notice}
        onOpenChange={(open) => {
          if (!open && !locked) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action ? titles[action] : "Operação de caixa"}
            </DialogTitle>
            <DialogDescription>
              {action === "close"
                ? "Confirme o valor físico contado. O servidor calculará o saldo esperado e a diferença. O fechamento encerra esta sessão."
                : "Confira o caixa selecionado antes de confirmar esta movimentação."}
            </DialogDescription>
          </DialogHeader>
          {state.retry && (
            <Button
              variant="outline"
              disabled={state.busy}
              onClick={() => {
                void controller.retry();
              }}
            >
              Repetir operação com segurança
            </Button>
          )}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (action)
                void controller.cash(action, value, reason).then(() => {
                  if (!controller.getSnapshot().error) { setAction(null); setValue(""); setReason(""); }
                });
            }}
          >
            <Field
              label={
                action === "open"
                  ? "Saldo inicial (R$)"
                  : action === "close"
                    ? "Dinheiro contado (R$)"
                    : "Valor (R$)"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              required
              disabled={locked}
            />
            <Field
              label={
                action === "open"
                  ? "Turno"
                  : action === "close"
                    ? "Observação (opcional)"
                    : "Motivo"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={action !== "close"}
              maxLength={action === "open" ? 80 : 500}
              disabled={locked}
            />
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={locked}
                onClick={() => setAction(null)}
              >
                Voltar
              </Button>
              <Button disabled={locked} type="submit">
                {state.busy ? "Processando…" : "Confirmar operação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
