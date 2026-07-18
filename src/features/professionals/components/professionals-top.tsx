import {  Search } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"


export const ProfissionaisTop = () => (

  <div className="relative flex items-center h-16 px-4">
    <SidebarTrigger className="z-10" />

    <InputGroup className="max-w-xs bsolute left-1/2 -translate-x-1/2 w-full max-w-md bg-[var(--bg-soft)]  border-[var(--muted)]">
      <InputGroupInput placeholder="Buscar profissional..." />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
   
  </div>




)
