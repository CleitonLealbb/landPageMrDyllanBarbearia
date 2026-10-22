"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { createContext, useContext } from "react"

const TenantRoleContext = createContext<"BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT">("BARBER")
export function useDashboardRole() { return useContext(TenantRoleContext) }

export function DashboardShell({ children, tenantRole }: { children: React.ReactNode; tenantRole: "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT" }) {
  return <TenantRoleContext.Provider value={tenantRole}><SidebarProvider><div className="flex min-h-screen w-full"><AppSidebar tenantRole={tenantRole} /><SidebarInset><main>{children}</main></SidebarInset></div></SidebarProvider></TenantRoleContext.Provider>
}
