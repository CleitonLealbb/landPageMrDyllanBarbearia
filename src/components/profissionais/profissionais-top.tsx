import { Search } from "lucide-react"

import { SidebarTrigger } from "../ui/sidebar"
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group"


export const ProfissionaisTop = () => {

  return (

    <div className="relative flex items-center h-16 px-4">
      <SidebarTrigger className="z-10" />

      <InputGroup className="max-w-xs absolute left-1/2 -translate-x-1/2 w-full max-w-md bg-[var(--bg-soft)] border-border">
        <InputGroupInput placeholder="Buscar profissional..." />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
     
  
    </div>




  )
}
