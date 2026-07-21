"use client"

import type { ElementType } from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { ViewKey } from "@/types/view"

type NavIcon = ElementType

type NavItem = {
  title: string
  view: ViewKey
  icon?: ElementType
}

type NavMainProps = {
  items: NavItem[]
  activeView: ViewKey
  onViewChange: (view: ViewKey) => void
}

export function NavMain({ items, activeView, onViewChange }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.view

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  onClick={() => onViewChange(item.view)}
                  className="h-12"
                >
                  {Icon ? <Icon className="h-6 w-6 shrink-0 text-muted-foreground" /> : null}
                  <span className="truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
