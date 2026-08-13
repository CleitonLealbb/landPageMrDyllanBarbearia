import { Clock3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
export function ComingSoonPanel({ title, description }: { title: string; description: string }) { return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"><Clock3 aria-hidden="true" className="size-8 text-primary" /><div className="mt-4 flex items-center gap-2"><h3 className="font-semibold">{title}</h3><Badge variant="secondary">Em breve</Badge></div><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p></div> }
