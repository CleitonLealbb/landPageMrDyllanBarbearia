"use client"

import * as React from "react"
import type { ElementType } from "react"
import { SettingsIcon } from "lucide-react"
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

type ViewKey =
  | "agenda"
  | "checkout"
  | "clientes"
  | "estoque"
  | "marketing"
  | "cartoes"
  | "dashboard"
  | "profissionais"
  | "perfil"
  | "config"

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
  user: {
    name: "shadcn",
    email: "m@example.com",
    photoUrl: "/android-chrome-512x512.png",
  },
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
    { title: "Settings", view: "config", icon: SettingsIcon },
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

function canViewMenuItem(user: StoredUser | null, view: ViewKey) {
  if (!user || user.tenantRole === null) return false

  return menuPermissions[user.tenantRole].includes(view)
}

export function AppSidebar({
  activeView,
  onViewChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView: ViewKey
  onViewChange: (view: ViewKey) => void
}) {
  const [storedUser, setStoredUser] = React.useState<StoredUser | null>(null)

  React.useEffect(() => {
    try {
      const serializedUser = localStorage.getItem("user")

      if (!serializedUser) {
        setStoredUser(null)
        return
      }

      const parsedUser: unknown = JSON.parse(serializedUser)

      if (isStoredUser(parsedUser)) {
        setStoredUser(parsedUser)
      } else {
        setStoredUser(null)
      }
    } catch {
      setStoredUser(null)
    }
  }, [])

  const navMain = data.navMain.filter((item) =>
    canViewMenuItem(storedUser, item.view)
  )

  const navSecondary = data.navSecondary.filter((item) =>
    canViewMenuItem(storedUser, item.view)
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onViewChange("agenda")}
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
          onViewChange={onViewChange}
        />

        <NavSecondary
          items={navSecondary}
          activeView={activeView}
          onViewChange={onViewChange}
          className="mt-auto"
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
