"use client"

import type { ComponentPropsWithoutRef, ComponentType } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { ViewKey } from "@/types/view"

type NavIcon = ComponentType<{ className?: string }>

type NavSecondaryItem = {
  title: string
  view: ViewKey
  icon?: NavIcon
}

export function NavSecondary({
  items,
  activeView,
  onViewChange,
  ...props
}: {
  items: NavSecondaryItem[]
  activeView: ViewKey
  onViewChange: (view: ViewKey) => void
} & ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
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
                  {Icon ? <Icon className="h-6 w-6 shrink-0" /> : null}
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
