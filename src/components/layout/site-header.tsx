"use client"

import { usePathname } from "next/navigation"

import { headerConfig } from "@/components/site-header-config"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  const pathname = usePathname() ?? "/Agenda"

  // tenta achar config exata, senão usa um fallback
  const config =
    headerConfig[pathname] ??
    (pathname.startsWith("/dashboard/agenda")
      ? { title: "Agenda", subtitle: "Gerencie horários e atendimento" }
      : { title: "Agenda" })

  return (
    <header className="flex min-h-14 shrink-0 items-center sm:h-14 sm:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarInset>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2 sm:flex-nowrap sm:px-4 sm:py-0 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />

            <div className="flex min-w-0 flex-col">
              <h1 className="text-base font-semibold leading-tight">
                {config.title}
              </h1>
              {config.subtitle ? (
                <p className="text-xs leading-tight text-muted-foreground">
                  {config.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {/* AÇÕES DO HEADER (botões / filtros / busca) */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {config.right ?? null}
          </div>
        </div>
      </SidebarInset>
    </header>
  )
}
