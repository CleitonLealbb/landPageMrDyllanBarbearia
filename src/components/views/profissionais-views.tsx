"use client"
import { ProfissionaisTop } from "../profissionais/profissionais-top"

export function ProfissionaisView() {
  

  return (
   <div className="flex h-screen w-full overflow-hidden">
         {/* ESQUERDA */}
         <div className="flex min-w-0 flex-1 flex-col">
           {/* Topo fixo */}
           <div className="shrink-0 justify-center">
             <ProfissionaisTop/>
           </div>
   
         
         </div>
   
       
       </div>
  )
}
