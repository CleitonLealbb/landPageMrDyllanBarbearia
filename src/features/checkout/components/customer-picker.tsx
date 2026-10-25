"use client";
import { displayName } from "../display"
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./fields";
import { UserRound } from "lucide-react";
import type { CheckoutController, CheckoutState } from "../controller";

export function CustomerPicker({
  state,
  controller,
}: {
  state: CheckoutState;
  controller: CheckoutController;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      void controller.searchCustomers(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, controller]);
  if (state.sale && !state.editing)
    return (
      <div className="rounded-xl border border-border/40 bg-background/25 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Cliente da venda</p>
        <p>
          {state.sale.customerId
            ? (state.customer ? displayName(state.customer.name, "Cliente") : "Cliente vinculado à venda")
            : "Cliente não identificado · venda anônima"}
        </p>
      </div>
    );
  if (state.customer)
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Cliente selecionado</p>
          <p className="break-words text-sm font-medium">
            {displayName(state.customer.name, "Cliente")}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!controller.editable()}
          onClick={() => {
            controller.set({ customer: null });
            setQuery("");
          }}
        >
          Remover
        </Button>
      </div>
    );
  return (
    <div className="space-y-2 rounded-xl border border-border/40 bg-background/25 p-3">
      <Field
        label="Cliente (opcional)"
        placeholder="Nome do cliente · mínimo 2 caracteres"
        value={query}
        disabled={!controller.editable()}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={80}
        type="search"
      />
      <p className="text-[10px] text-muted-foreground">
        Cliente não identificado · venda anônima.
      </p>
      {state.customerSearching && (
        <p role="status" className="text-xs">
          Buscando clientes…
        </p>
      )}
      {!state.customerSearching &&
        query.trim().length >= 2 &&
        !state.customers.length && (
          <p role="status" className="text-xs text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        )}
      {!!state.customers.length && (
        <ul
          aria-label="Clientes encontrados"
          className="max-h-48 overflow-y-auto rounded-lg border"
        >
          {state.customers.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                disabled={!controller.editable()}
                className="w-full p-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => controller.set({ customer })}
              >
                {displayName(customer.name, "Cliente")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
