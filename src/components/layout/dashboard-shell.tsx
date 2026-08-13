"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function DashboardShell({ children, tenantRole }: { children: React.ReactNode; tenantRole: "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT" }) {
  return <SidebarProvider><div className="flex min-h-screen w-full"><AppSidebar tenantRole={tenantRole} /><SidebarInset><main>{children}</main></SidebarInset></div></SidebarProvider>
}
