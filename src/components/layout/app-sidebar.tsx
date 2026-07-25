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

type UserType = "USER" | "PROFESSIONAL"
type UserRole = "SUPER_ADMIN" | "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT"

type StoredUser = {
  type: UserType
  role: UserRole
}

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

const menuPermissions: Record<UserRole, readonly ViewKey[]> = {
  SUPER_ADMIN: [],
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

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "BARBERSHOP_OWNER" ||
    value === "BARBER" ||
    value === "ASSISTANT"
  )
}

function isStoredUser(value: unknown): value is StoredUser {
  if (!isRecord(value)) {
    return false
  }

  if (value.type === "USER") {
    return isUserRole(value.role)
  }

  if (value.type === "PROFESSIONAL") {
    return value.role === "BARBER" || value.role === "ASSISTANT"
  }

  return false
}

function canViewMenuItem(user: StoredUser | null, view: ViewKey) {
  if (!user) return false

  if (
    (user.role === "SUPER_ADMIN" ||
      user.role === "BARBERSHOP_OWNER") &&
    user.type !== "USER"
  ) {
    return false
  }

  return menuPermissions[user.role].includes(view)
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
    const serializedUser = localStorage.getItem("user")

    if (!serializedUser) return

    try {
      const parsedUser: unknown = JSON.parse(serializedUser)

      if (isStoredUser(parsedUser)) {
        setStoredUser({
          type: parsedUser.type,
          role: parsedUser.role,
        })
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
