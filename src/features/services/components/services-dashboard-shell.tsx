"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ServicesView } from "./services-view"

export function ServicesDashboardShell() {
  return <SidebarProvider><div className="flex min-h-screen w-full"><AppSidebar activeView="config" onViewChange={() => undefined} /><SidebarInset><main><ServicesView /></main></SidebarInset></div></SidebarProvider>
}
