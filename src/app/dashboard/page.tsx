"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AgendaView } from "@/components/views/agenda-views"
import { CheckoutView } from "@/components/views/checkout-views"
import { CustomerView } from "@/features/customers/components/customer-view"
import { EstoqueView } from "@/components/views/estoque-views"
import { MarketingView } from "@/components/views/marketing-views"
import { CartoesView } from "@/components/views/cartoes-views"
import { DashboardView } from "@/components/views/dashboard-views"
import { ProfissionaisView } from "@/features/professionals/components/professionals-view"
import { PerfilEmpresaView } from "@/components/views/perfil-empresa-views"
import { ConfiguracoesView } from "@/components/views/configuracoes-views"
import type { ViewKey } from "@/types/view"


const dashboardViews: readonly ViewKey[] = [
  "agenda", "checkout", "clientes", "estoque", "marketing", "cartoes",
  "dashboard", "profissionais", "perfil", "config",
]

export default function DashboardPage() {
  const [view, setView] = useState<ViewKey>("agenda")

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view")
    if (requestedView && dashboardViews.includes(requestedView as ViewKey)) {
      setView(requestedView as ViewKey)
    }
  }, [])

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">

        <AppSidebar
          activeView={view}
          onViewChange={setView}
        />

        <SidebarInset>
          <main>
            {view === "agenda" && <div><AgendaView/></div>}
            {view === "checkout" && <div><CheckoutView/></div>}
            {view === "clientes" && <div><CustomerView/></div>}
            {view === "estoque" && <div><EstoqueView/></div>}
            {view === "marketing" && <div><MarketingView/></div>}
            {view === "cartoes" && <div><CartoesView/></div>}
            {view === "dashboard" && <div><DashboardView/></div>}
            {view === "profissionais" && <div><ProfissionaisView/></div>}
            {view === "perfil" && <div><PerfilEmpresaView/></div>}
            {view === "config" && <div><ConfiguracoesView/></div>}
            
          </main>
        </SidebarInset>

      </div>
    </SidebarProvider>
  )
}
