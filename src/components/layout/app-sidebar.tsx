"use client"

import * as React from "react"
import type { ElementType } from "react"
import { SettingsIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ViewKey } from "@/types/view"
import {
  MdAdsClick,
  MdCalendarToday,
  MdCreditCard,
  MdDashboard,
  MdDiversity2,
  MdGroups,
  MdInventory2,
  MdPointOfSale,
  MdStore,
} from "react-icons/md"

import { NavMain } from "@/components/layout/nav-main"
import { NavSecondary } from "@/components/layout/nav-secondary"
import { NavUser } from "@/components/layout/nav-user"
import { Skeleton } from "@/components/ui/skeleton"
import { LogoMr } from "@/components/ui/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavigationItem = {
  title: string
  view: ViewKey
  icon?: ElementType
}

type TenantRole = "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT"

type StoredUser = {
  id: string
  name: string
  email: string
  photoUrl: string
} & (
  | {
      type: "USER"
      globalRole: "SUPER_ADMIN"
      tenantRole: null
    }
  | {
      type: "USER"
      globalRole: null
      tenantRole: TenantRole
    }
  | {
      type: "PROFESSIONAL"
      globalRole: null
      tenantRole: "BARBER" | "ASSISTANT"
    }
)

const data = {
  navMain: [
    { title: "Agenda", view: "agenda", icon: MdCalendarToday },
    { title: "Checkout", view: "checkout", icon: MdPointOfSale },
    { title: "Clients", view: "clientes", icon: MdGroups },
    { title: "Estoque", view: "estoque", icon: MdInventory2 },
    { title: "Marketing", view: "marketing", icon: MdAdsClick },
    { title: "Cartões", view: "cartoes", icon: MdCreditCard },
    { title: "Dashboard", view: "dashboard", icon: MdDashboard },
    { title: "Profissionais", view: "profissionais", icon: MdDiversity2 },
    { title: "Perfil da Empresa", view: "perfil", icon: MdStore },
  ] satisfies NavigationItem[],
  navSecondary: [
    { title: "Configurações", view: "config", icon: SettingsIcon },
  ] satisfies NavigationItem[],
}

const menuPermissions: Record<TenantRole, readonly ViewKey[]> = {
  BARBERSHOP_OWNER: [
    "dashboard",
    "agenda",
    "checkout",
    "clientes",
    "estoque",
    "marketing",
    "cartoes",
    "profissionais",
    "perfil",
    "config",
  ],
  BARBER: ["agenda", "clientes", "perfil"],
  ASSISTANT: ["agenda", "checkout", "clientes", "perfil"],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTenantRole(value: unknown): value is TenantRole {
  return (
    value === "BARBERSHOP_OWNER" ||
    value === "BARBER" ||
    value === "ASSISTANT"
  )
}

function isStoredUser(value: unknown): value is StoredUser {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.email !== "string" ||
    typeof value.photoUrl !== "string" ||
    "role" in value ||
    "sessionVersion" in value ||
    "barbershopId" in value
  ) {
    return false
  }

  if (value.type === "USER") {
    return (
      (value.globalRole === "SUPER_ADMIN" &&
        value.tenantRole === null) ||
      (value.globalRole === null &&
        isTenantRole(value.tenantRole))
    )
  }

  if (value.type === "PROFESSIONAL") {
    return (
      value.globalRole === null &&
      (value.tenantRole === "BARBER" ||
        value.tenantRole === "ASSISTANT")
    )
  }

  return false
}

function canViewMenuItem(role: TenantRole, view: ViewKey) {
  return menuPermissions[role].includes(view)
}

let cachedStoredUser: StoredUser | null | undefined

function SidebarLoading() {
  return <><SidebarHeader><div className="flex h-16 items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center"><Skeleton className="size-12 shrink-0 rounded-xl motion-reduce:animate-none" /><div className="flex-1 space-y-2 group-data-[collapsible=icon]:hidden"><Skeleton className="h-4 w-36 motion-reduce:animate-none" /><Skeleton className="h-3 w-20 motion-reduce:animate-none" /></div></div></SidebarHeader><SidebarContent className="overflow-hidden px-2 py-2"><div className="space-y-2">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="flex h-12 items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center"><Skeleton className="size-6 shrink-0 motion-reduce:animate-none" /><Skeleton className="h-4 flex-1 motion-reduce:animate-none group-data-[collapsible=icon]:hidden" /></div>)}</div><div className="mt-auto flex h-12 items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center"><Skeleton className="size-6 shrink-0 motion-reduce:animate-none" /><Skeleton className="h-4 flex-1 motion-reduce:animate-none group-data-[collapsible=icon]:hidden" /></div></SidebarContent><SidebarFooter><div className="flex h-14 items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center"><Skeleton className="size-10 shrink-0 rounded-lg motion-reduce:animate-none" /><div className="min-w-0 flex-1 space-y-2 group-data-[collapsible=icon]:hidden"><Skeleton className="h-3 w-24 motion-reduce:animate-none" /><Skeleton className="h-3 w-32 motion-reduce:animate-none" /></div></div></SidebarFooter></>
}

export function AppSidebar({ tenantRole, ...props }: React.ComponentProps<typeof Sidebar> & { tenantRole: TenantRole }) {
  const router = useRouter()
  const pathname = usePathname()
  const requestedView = useSearchParams().get("view")
  const activeView: ViewKey = pathname.startsWith("/dashboard/configuracoes") ? "config" : requestedView && data.navMain.some((item) => item.view === requestedView) ? requestedView as ViewKey : "agenda"
  const [storedUser, setStoredUser] = React.useState<StoredUser | null>(cachedStoredUser ?? null)
  const [sidebarReady, setSidebarReady] = React.useState(cachedStoredUser !== undefined)

  React.useEffect(() => {
    try {
      const serializedUser = localStorage.getItem("user")

      if (!serializedUser) {
        cachedStoredUser = null
        setStoredUser(null)
        return
      }

      const parsedUser: unknown = JSON.parse(serializedUser)

      if (isStoredUser(parsedUser)) {
        cachedStoredUser = parsedUser
        setStoredUser(parsedUser)
      } else {
        cachedStoredUser = null
        setStoredUser(null)
      }
    } catch {
      cachedStoredUser = null
      setStoredUser(null)
    } finally {
      setSidebarReady(true)
    }
  }, [])

  const navMain = data.navMain.filter((item) =>
    canViewMenuItem(tenantRole, item.view)
  )

  const navSecondary = data.navSecondary.filter((item) =>
    canViewMenuItem(tenantRole, item.view)
  )

  function handleViewChange(view: ViewKey) {
    router.push(view === "config" ? "/dashboard/configuracoes" : `/dashboard?view=${view}`)
  }

  if (!sidebarReady) return <Sidebar collapsible="icon" {...props}><SidebarLoading /></Sidebar>

  return (
    <Sidebar collapsible="icon" className="animate-in fade-in duration-200 motion-reduce:animate-none" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleViewChange("agenda")}
              className="h-16 data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div className="flex w-full items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                  <LogoMr />
                </div>

                <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="whitespace-nowrap text-base font-bold">
                    Mr Dyllan Barbearia
                  </span>
                  <span className="whitespace-nowrap font-light text-primary">
                    Painel Admin
                  </span>
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto scrollbar-hide">
        <NavMain
          items={navMain}
          activeView={activeView}
          onViewChange={handleViewChange}
        />

        <NavSecondary
          items={navSecondary}
          activeView={activeView}
          onViewChange={handleViewChange}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarFooter>
        {storedUser ? (
          <NavUser user={{ name: storedUser.name, email: storedUser.email, photoUrl: storedUser.photoUrl }} />
        ) : (
          <div aria-hidden="true" className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center">
            <Skeleton className="size-10 shrink-0 rounded-lg motion-reduce:animate-none" />
            <div className="min-w-0 flex-1 space-y-2 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-32 motion-reduce:animate-none" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
