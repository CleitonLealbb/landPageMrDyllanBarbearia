"use client"
import { useState, useSyncExternalStore } from "react"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Receipt } from "./receipt"
import { CheckoutFeedback } from "./checkout-feedback"
import styles from "./checkout.module.css"
import type { CheckoutController, CheckoutState } from "../controller"

const mobileQuery = "(max-width: 767px)"
function subscribeViewport(listener: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

export function ReceiptPanel({ state, controller, itemCount, total }: {
  state: CheckoutState; controller: CheckoutController; itemCount: number; total: string
}) {
  const mobile = useSyncExternalStore(subscribeViewport, () => window.matchMedia(mobileQuery).matches, () => false)
  const [open, setOpen] = useState(false)
  return <>
    <div className="hidden min-w-0 md:block lg:sticky lg:top-0">
      {!mobile && <Receipt state={state} controller={controller} />}
    </div>
    <Sheet open={mobile && open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button aria-label={`Ver comanda: ${itemCount} itens, ${state.sale && !state.editing ? "total confirmado" : "total estimado"} ${total}`} className="fixed inset-x-4 bottom-4 z-30 h-auto min-h-12 justify-between gap-2 whitespace-normal rounded-xl border border-primary/40 bg-primary px-4 py-3 text-primary-foreground shadow-xl md:hidden">
          <span className="flex items-center gap-2 text-xs font-semibold"><ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />Ver comanda — {itemCount} itens</span><span className="shrink-0 font-bold">{total}</span>
        </Button>
      </SheetTrigger>
      {mobile && <SheetContent side="bottom" className={`${styles.workspace} flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none p-0 motion-reduce:animate-none motion-reduce:transition-none sm:p-0 [&>button]:hidden`}>
        <SheetTitle className="sr-only">Comanda de caixa</SheetTitle>
        <SheetDescription className="sr-only">Revise os itens e os valores, informe os pagamentos e finalize sua venda.</SheetDescription>
        <MobileReceiptContent state={state} controller={controller} onEdit={() => setOpen(false)} />
      </SheetContent>}
    </Sheet>
  </>
}

export function MobileReceiptContent({ state, controller, onEdit }: { state: CheckoutState; controller: CheckoutController; onEdit?: () => void }) {
  return <>
    <div className="shrink-0 space-y-2 border-b border-border p-3">
      <SheetClose asChild><Button size="sm" variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Voltar ao catálogo</Button></SheetClose>
      <div className="max-h-[25dvh] overflow-y-auto"><CheckoutFeedback state={state} controller={controller} /></div>
    </div>
    <div className="min-h-0 flex-1"><Receipt mobile state={state} controller={controller} onEdit={onEdit} /></div>
  </>
}
