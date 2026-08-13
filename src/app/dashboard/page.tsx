"use client"

import { useSearchParams } from "next/navigation"
import { AgendaView } from "@/components/views/agenda-views"
import { CheckoutView } from "@/components/views/checkout-views"
import { CustomerView } from "@/features/customers/components/customer-view"
import { EstoqueView } from "@/components/views/estoque-views"
import { MarketingView } from "@/components/views/marketing-views"
import { CartoesView } from "@/components/views/cartoes-views"
import { DashboardView } from "@/components/views/dashboard-views"
import { ProfissionaisView } from "@/features/professionals/components/professionals-view"
import { PerfilEmpresaView } from "@/components/views/perfil-empresa-views"
import type { ViewKey } from "@/types/view"


const dashboardViews: readonly ViewKey[] = [
  "agenda", "checkout", "clientes", "estoque", "marketing", "cartoes",
  "dashboard", "profissionais", "perfil",
]

export default function DashboardPage() {
  const requestedView = useSearchParams().get("view")
  const view: ViewKey = requestedView && dashboardViews.includes(requestedView as ViewKey) ? requestedView as ViewKey : "agenda"

  return (
    <>
            {view === "agenda" && <div><AgendaView/></div>}
            {view === "checkout" && <div><CheckoutView/></div>}
            {view === "clientes" && <div><CustomerView/></div>}
            {view === "estoque" && <div><EstoqueView/></div>}
            {view === "marketing" && <div><MarketingView/></div>}
            {view === "cartoes" && <div><CartoesView/></div>}
            {view === "dashboard" && <div><DashboardView/></div>}
            {view === "profissionais" && <div><ProfissionaisView/></div>}
            {view === "perfil" && <div><PerfilEmpresaView/></div>}
            
    </>
  )
}
