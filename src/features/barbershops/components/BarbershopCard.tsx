"use client"

import { Button } from "@/components/ui/button"
import { DeleteBarbershopDialog } from "./DeleteBarbershopDialog"
import type { Barbershop } from "./types"

type BarbershopCardProps = {
  shop: Barbershop
  onEdit: (shop: Barbershop) => void
  onOpenOwner: (shop: Barbershop) => void
  onDelete: (id: string) => void
}

export function BarbershopCard({
  shop,
  onEdit,
  onOpenOwner,
  onDelete,
}: BarbershopCardProps) {
  const owner = shop.members?.[0]?.user

  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-[#171717] p-5">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">
            {shop.name}
          </h3>

          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            {shop.status === "ACTIVE" ? "Ativa" : "Inativa"}
          </span>
        </div>

        <div className="mt-2 space-y-1 text-sm text-zinc-400">
          <p>{shop.email || "Sem e-mail"}</p>
          <p>{shop.phone || "Sem telefone"}</p>
          <p>{shop.address || "Sem endereÃ§o"}</p>

          <div className="pt-2">
            <p>
              Dono:{" "}
              <span className="text-white">
                {owner ? owner.name : "NÃ£o vinculado"}
              </span>
            </p>

            {owner && (
              <p className="text-xs text-zinc-500">
                {owner.email}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => onEdit(shop)}
          variant="outline"
          className="border-white/10"
        >
          Editar
        </Button>

        <Button
          onClick={() => onOpenOwner(shop)}
          variant="outline"
          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
        >
          Dono
        </Button>

        <DeleteBarbershopDialog
          barbershopName={shop.name}
          onDelete={() => onDelete(shop.id)}
        />
      </div>
    </div>
  )
}
