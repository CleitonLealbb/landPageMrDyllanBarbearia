import { Plus, Scissors, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { calculateServiceSummary, serviceTabs } from "../helpers"
import type { CatalogService, ServiceCategory, ServicePackage } from "../types"
import { ServiceCard } from "./service-card"
import { CategoriesPanel } from "./categories-panel"
import { PackagesPanel } from "./packages-panel"

type Props = { services: CatalogService[]; categories: ServiceCategory[]; packages: ServicePackage[]; reload: () => Promise<void>; filtered: CatalogService[]; query: string; submitting: boolean; onQuery: (value: string) => void; onNew: () => void; onEdit: (service: CatalogService) => void; onProfessionals: (service: CatalogService) => void; onStatus: (service: CatalogService) => void }

export function ServiceCatalogPanel(props: Props) {
  const summary = calculateServiceSummary(props.services)
  return <section aria-labelledby="catalog-title" className="min-w-0 lg:pr-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="catalog-title" className="text-xl font-semibold">Catálogo de Serviços</h2><p className="mt-1 text-sm text-muted-foreground">Serviços exibidos aos clientes.</p></div><Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={props.onNew}><Plus aria-hidden="true" />Novo Serviço</Button></div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-y border-border/50 py-2.5">{[["Total", summary.total], ["Ativos", summary.active], ["Inativos", summary.inactive], ["Duração média", `${summary.averageDuration} min`]].map(([label, value]) => <div key={label} className="flex items-baseline gap-1.5"><span className="text-xs text-muted-foreground">{label}</span><strong className="text-sm">{value}</strong></div>)}</div>
    <Tabs defaultValue="individual" className="mt-5"><TabsList className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border/60 bg-transparent p-0">{serviceTabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">{tab.label}{!tab.available && <span className="text-[10px] text-muted-foreground">Em breve</span>}</TabsTrigger>)}</TabsList>
      <TabsContent value="individual" className="mt-5"><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar serviço" className="pl-9" placeholder="Buscar serviço..." value={props.query} onChange={(event) => props.onQuery(event.currentTarget.value)} /></div>{props.services.length === 0 ? <Card className="mt-4 border-border/60"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><Scissors aria-hidden="true" className="size-9 text-primary" /><h3 className="font-semibold">Seu catálogo está vazio</h3><p className="text-sm text-muted-foreground">Cadastre o primeiro serviço para começar.</p><Button onClick={props.onNew}><Plus aria-hidden="true" />Novo Serviço</Button></CardContent></Card> : props.filtered.length === 0 ? <div role="status" className="mt-4 rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Nenhum serviço corresponde à busca.</div> : <div className="mt-4 grid gap-3">{props.filtered.map((service) => <ServiceCard key={service.id} service={service} submitting={props.submitting} onEdit={() => props.onEdit(service)} onProfessionals={() => props.onProfessionals(service)} onStatus={() => props.onStatus(service)} />)}</div>}</TabsContent>
      <TabsContent value="combos" className="mt-5"><PackagesPanel packages={props.packages} services={props.services} reload={props.reload} /></TabsContent><TabsContent value="categories"><CategoriesPanel categories={props.categories} categorized={props.services.filter((service) => service.category).length} reload={props.reload} /></TabsContent>
    </Tabs>
  </section>
}
