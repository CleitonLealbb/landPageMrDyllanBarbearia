"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AgendaRightPanel() {
  return (
    <div className="flex h-full flex-col gap-4">
     <h2 className="font-semibold">Resumo</h2>

      {/* RESUMO */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Resumo do dia
          </CardTitle>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground">
          Total reservas, cancelamentos, etc.
        </CardContent>
      </Card>

      {/* FILA */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Fila de espera
          </CardTitle>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground">
          Lista de pessoas aguardando.
        </CardContent>
      </Card>

    </div>
  )
}