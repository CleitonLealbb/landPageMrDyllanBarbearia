"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { headerConfig } from "@/components/site-header-config"

export function SiteHeader() {
  const pathname = usePathname() ?? "/Agenda"

  // tenta achar config exata, senão usa um fallback
  const config =
    headerConfig[pathname] ??
    (pathname.startsWith("/dashboard/agenda")
      ? { title: "Agenda", subtitle: "Gerencie horários e atendimento" }
      : { title: "Agenda" })

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 shrink-0 items-center ">
      <SidebarInset>
        <div className="flex w-full items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

            <div className="flex flex-col">
              <h1 className="text-base font-semibold leading-tight">{config.title}</h1>
              {config.subtitle ? (
                <p className="text-xs text-muted-foreground leading-tight">
                  {config.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {/* AÇÕES DO HEADER (botões / filtros / busca) */}
          <div className="flex items-center gap-2">
            {config.right ?? null}
          </div>
        </div>
      </SidebarInset>
    </header>
  )
}
