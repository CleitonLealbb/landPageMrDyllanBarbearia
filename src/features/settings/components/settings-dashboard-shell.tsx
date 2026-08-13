"use client"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SettingsView } from "./settings-view"
export function SettingsDashboardShell() { return <SidebarProvider><div className="flex min-h-screen w-full"><AppSidebar activeView="config" onViewChange={() => undefined} /><SidebarInset><main><SettingsView /></main></SidebarInset></div></SidebarProvider> }
