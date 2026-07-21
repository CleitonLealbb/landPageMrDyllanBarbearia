import { Search } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"


export const ProfissionaisTop = () => (

  <div>
    <SidebarTrigger className="mt-5 ml-5" />
    <div className="relative flex items-center h-16 px-4">

      <InputGroup className="max-w-xs absolute left-1/2 -translate-x-1/2 w-full max-w-md bg-[var(--bg-soft)] border-border">
        <InputGroupInput placeholder="Buscar profissional..." />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>

    </div>
  </div>




)
