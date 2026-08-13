"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Bell, Boxes, Building2, CalendarDays, ChevronRight, CreditCard, Search, Settings2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { filterSettingsCards, settingsCards, type SettingsCard } from "../settings-cards"

const icons: Record<string, LucideIcon> = { empresa: Building2, servicos: Sparkles, agendamentos: CalendarDays, pagamentos: CreditCard, estoque: Boxes, equipe: ShieldCheck, notificacoes: Bell, assinatura: CreditCard, avancado: Settings2 }
function CardBody({ card }: { card: SettingsCard }) {
  const Icon = icons[card.id]
  return <CardContent className="flex min-h-52 h-full flex-col p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon aria-hidden="true" className="size-5" /></span>{!card.available && <Badge variant="secondary">Em breve</Badge>}</div><h2 className="mt-6 text-lg font-semibold">{card.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{card.description}</p>{card.available ? <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">Acessar <ChevronRight aria-hidden="true" className="size-4" /></span> : <span className="mt-5 text-sm text-muted-foreground">Indisponível nesta fase</span>}</CardContent>
}
export function SettingsView() {
  const [query, setQuery] = useState("")
  const cards = useMemo(() => filterSettingsCards(settingsCards, query), [query])
  return <div className="min-h-screen p-4 sm:p-6 lg:p-8"><header className="mx-auto max-w-6xl"><div className="flex items-start gap-3"><SidebarTrigger className="mt-1 shrink-0" /><div><h1 className="text-2xl font-bold sm:text-3xl">Configurações da Empresa</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Centralize os ajustes e preferências da sua operação.</p></div></div><div className="relative mt-7 max-w-xl"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar configurações..." aria-label="Buscar configurações" className="h-11 pl-10" /></div></header><section aria-label="Áreas de configuração" className="mx-auto mt-8 max-w-6xl">{cards.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => card.available && card.href ? <Link key={card.id} href={card.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"><Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/70"><CardBody card={card} /></Card></Link> : <Card key={card.id} aria-disabled="true" className="h-full opacity-80"><CardBody card={card} /></Card>)}</div> : <div role="status" className="rounded-xl border border-dashed p-10 text-center"><Search aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">Nenhuma configuração encontrada</h2><p className="mt-1 text-sm text-muted-foreground">Tente buscar por outro termo.</p></div>}</section></div>
}
