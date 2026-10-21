import { Search } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"


export const ProfissionaisTop = () => (
  <div className="relative flex h-16 items-center gap-3 px-3 sm:px-4">
    <SidebarTrigger className="z-10 shrink-0" />

    <InputGroup className="min-w-0 flex-1 border-border bg-[var(--bg-soft)] sm:absolute sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2">
      <InputGroupInput placeholder="Buscar profissional..." />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  </div>
)
