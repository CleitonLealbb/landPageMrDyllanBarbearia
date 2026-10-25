"use client";
import { useId, useState } from "react";
import {
  Clock3,
  Package,
  Plus,
  Search,
  Scissors,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName } from "../display";
import { money } from "../helpers";
import type { CheckoutController, CheckoutState } from "../controller";
import type { Kind } from "../types";

const labels: Record<Kind, string> = {
  SERVICE: "Serviços",
  PACKAGE: "Combos",
  PRODUCT: "Produtos",
};
const headings: Record<Kind, string> = { SERVICE: "Serviços de barbearia", PACKAGE: "Combos e pacotes", PRODUCT: "Produtos" };
export function Catalog({
  state,
  controller,
}: {
  state: CheckoutState;
  controller: CheckoutController;
}) {
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState<Kind | "ALL">("ALL");
  const data = state.data!;
  const searchId = useId();
  const groups = [
    { kind: "SERVICE" as const, icon: Scissors, items: data.services },
    { kind: "PACKAGE" as const, icon: Package, items: data.packages },
    { kind: "PRODUCT" as const, icon: ShoppingBag, items: data.products },
  ].filter((group) => tab === "ALL" || group.kind === tab);
  const search = query.normalize("NFKC").toLocaleLowerCase("pt-BR").trim();
  const count = groups.reduce(
    (n, group) =>
      n +
      group.items.filter((i) =>
        i.name.toLocaleLowerCase("pt-BR").includes(search),
      ).length,
    0,
  );
  return (
    <section aria-label="Catálogo do Checkout" className="min-w-0 space-y-5">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 focus-within:border-primary/60">
        <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <label htmlFor={searchId} className="sr-only">Buscar serviços, combos ou produtos</label>
        <Input
          id={searchId}
          className="h-9 min-w-0 border-0 bg-transparent px-1 text-xs shadow-none placeholder:text-muted-foreground focus-visible:ring-2"
          placeholder="Buscar serviços, combos ou produtos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          maxLength={100}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
        role="group"
        aria-label="Categorias do catálogo"
      >
        {(["ALL", "SERVICE", "PACKAGE", "PRODUCT"] as const).map((kind) => (
          <Button
            key={kind}
            size="sm"
            className={`h-7 rounded-md px-2.5 text-[11px] ${tab === kind ? "bg-muted font-semibold text-primary" : "text-muted-foreground"}`}
            variant="ghost"
            aria-pressed={tab === kind}
            onClick={() => setTab(kind)}
          >
            {kind === "ALL" ? "Todos" : labels[kind]}
          </Button>
        ))}
      </div>
      <span role="status" aria-live="polite" className="text-[10px] tabular-nums text-muted-foreground">{count} resultados</span>
      </div>
      {!count && (
        <p
          role="status"
          className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"
        >
          {search ? "Nenhum resultado para esta busca. Tente outro nome." : "Catálogo vazio: nenhum item ativo disponível nesta categoria. Atualize o catálogo ou solicite a configuração ao responsável."}
        </p>
      )}
      {groups.map((group) => {
        const items = group.items.filter((i) =>
          i.name.toLocaleLowerCase("pt-BR").includes(search),
        );
        if (!items.length) return null;
        return (
          <section
            key={group.kind}
            className="space-y-3"
            aria-label={headings[group.kind]}
          >
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <group.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {headings[group.kind]}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {items.length} opções
              </span>
            </h2>
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${group.kind === "PACKAGE" ? "xl:grid-cols-2" : "xl:grid-cols-3"}`}>
              {items.map((item, index) => {
                const stock =
                  "availableQuantity" in item ? item.availableQuantity : null;
                const services = "services" in item ? item.services : null;
                const unavailable =
                  stock === 0 ||
                  (group.kind !== "PRODUCT" &&
                    (services ?? [item]).some(
                      (service) =>
                        !data.professionals.some((p) =>
                          p.serviceIds.includes(service.id),
                        ),
                    ));
                return (
                  <article
                    key={item.id}
                    data-availability={unavailable ? "unavailable" : stock !== null && stock < 5 ? "low-stock" : "available"}
                    className={`flex min-h-[160px] min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 transition-colors ${unavailable ? "border-dashed border-border bg-background" : group.kind === "PACKAGE" ? "border-primary/35 hover:border-primary/70" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider">
                      <span className={`max-w-full break-words rounded px-1.5 py-1 text-[9px] font-medium normal-case tracking-normal ${group.kind === "PACKAGE" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {group.kind === "SERVICE" && "category" in item
                          ? displayName(item.category?.name ?? "Serviço", "Serviço")
                          : labels[group.kind]}
                      </span>
                      {"durationMinutes" in item && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {item.durationMinutes} min
                        </span>
                      )}
                    </div>
                    <h3 title={displayName(item.name, labels[group.kind])} className="line-clamp-2 break-words text-[13px] font-semibold leading-snug">
                      {displayName(item.name, labels[group.kind])}
                    </h3>
                    {services && (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {services.map((s) => displayName(s.name, "Serviço")).join(" + ")}
                      </p>
                    )}
                    {stock !== null && (
                      <p
                        className={`w-fit rounded px-2 py-1 text-[10px] font-medium ${stock === 0 ? "bg-muted text-muted-foreground" : stock < 5 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {stock ? `${stock} un. disponíveis${stock < 5 ? " · Estoque baixo" : ""}` : "Sem estoque"}
                      </p>
                    )}
                    {unavailable && stock === null && (
                      <p id={`${searchId}-${group.kind}-${index}-unavailable`} className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs leading-relaxed text-foreground">
                        Indisponível: nenhum profissional habilitado para {services ? "todos os serviços deste combo" : "este serviço"}. Solicite a configuração ao responsável.
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                      <strong className={`text-base tabular-nums ${unavailable ? "text-muted-foreground" : "text-primary"}`}>
                        {money(item.priceCents)}
                      </strong>
                      <Button
                        size="sm"
                        variant={group.kind === "PACKAGE" ? "default" : "secondary"}
                        className="h-7 border border-border/60 px-2 text-[10px] hover:border-primary/50"
                        disabled={!controller.editable() || unavailable}
                        aria-label={`Adicionar ${displayName(item.name, labels[group.kind])}`}
                        aria-describedby={unavailable && stock === null ? `${searchId}-${group.kind}-${index}-unavailable` : undefined}
                        onClick={() => controller.add(group.kind, item.id)}
                      >
                        <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                        {unavailable ? "Indisponível" : "Adicionar"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Estoque informativo. A disponibilidade e os valores serão conferidos
        pelo servidor na criação e na finalização.
      </p>
    </section>
  );
}
