"use client"

import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import {
  Images,
  ListVideo,
  Loader2,
  MonitorPlay,
  Power,
  PowerOff,
  Trash2,
  Tv,
  Upload,
} from "lucide-react"

type TvMedia = {
  id: string
  name: string
  url: string
  type: "VIDEO" | "IMAGE"
  order: number
  active: boolean
}

export function MarketingView() {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [media, setMedia] = useState<TvMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
 const [deletingId, setDeletingId] = useState<string | null>(null)
const [updatingId, setUpdatingId] = useState<string | null>(null)
  async function loadMedia() {
    try {
      setLoading(true)

      const response = await fetch("/api/tv/media")

      if (!response.ok) {
        throw new Error("Erro ao buscar mídias")
      }

      const data: TvMedia[] = await response.json()

      setMedia(data)
    } catch (error) {
      console.error("Erro ao carregar mídias:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMedia()
  }, [])

 async function handleFileChange(
  event: React.ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0]

  if (!file) return

  try {
    setUploading(true)

    const blob = await upload(
      `tv/${file.name}`,
      file,
      {
        access: "public",
        handleUploadUrl: "/api/tv/upload",
        multipart: true,
      }
    )

    const mediaType: "VIDEO" | "IMAGE" =
      file.type.startsWith("image/")
        ? "IMAGE"
        : "VIDEO"

    const mediaResponse = await fetch(
      "/api/tv/media",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          name: file.name,
          url: blob.url,
          type: mediaType,
        }),
      }
    )

    if (!mediaResponse.ok) {
      const data =
        await mediaResponse.json()

      throw new Error(
        data.error ??
          "Erro ao salvar mídia"
      )
    }

    await loadMedia()
  } catch (error) {
    console.error(
      "Erro no upload:",
      error
    )

    alert(
      error instanceof Error
        ? error.message
        : "Não foi possível enviar a mídia."
    )
  } finally {
    setUploading(false)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }
}

  const videos = media.filter(
    (item) => item.type === "VIDEO"
  )

  const images = media.filter(
    (item) => item.type === "IMAGE"
  )
 
  async function handleToggleActive(item: TvMedia) {
  try {
    setUpdatingId(item.id)

    const response = await fetch(
      `/api/tv/media/${item.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: !item.active,
        }),
      }
    )

    if (!response.ok) {
      const data = await response.json()

      throw new Error(
        data.error ?? "Erro ao atualizar mídia"
      )
    }

    await loadMedia()
  } catch (error) {
    console.error(error)

    alert(
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar a mídia."
    )
  } finally {
    setUpdatingId(null)
  }
}

async function handleDelete(item: TvMedia) {
  const confirmed = window.confirm(
    `Excluir "${item.name}" da programação?`
  )

  if (!confirmed) return

  try {
    setDeletingId(item.id)

    const response = await fetch(
      `/api/tv/media/${item.id}`,
      {
        method: "DELETE",
      }
    )

    if (!response.ok) {
      const data = await response.json()

      throw new Error(
        data.error ?? "Erro ao excluir mídia"
      )
    }

    await loadMedia()
  } catch (error) {
    console.error(error)

    alert(
      error instanceof Error
        ? error.message
        : "Não foi possível excluir a mídia."
    )
  } finally {
    setDeletingId(null)
  }
}
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Marketing
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie campanhas, promoções e conteúdos exibidos
          nas TVs da barbearia.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border p-2">
              <Images className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Mídias
              </p>

              <p className="text-2xl font-semibold">
                {media.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border p-2">
              <ListVideo className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Vídeos
              </p>

              <p className="text-2xl font-semibold">
                {videos.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border p-2">
              <Tv className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Imagens
              </p>

              <p className="text-2xl font-semibold">
                {images.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MonitorPlay className="h-5 w-5" />

              <h3 className="font-semibold">
                TV da Barbearia
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os vídeos e imagens exibidos nas
              televisões.
            </p>
          </div>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Adicionar mídia
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : media.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center">
            <div className="rounded-full border p-4">
              <MonitorPlay className="h-8 w-8 text-muted-foreground" />
            </div>

            <h4 className="mt-4 font-medium">
              Nenhuma mídia adicionada
            </h4>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Adicione vídeos ou imagens para começar a montar a
              programação das TVs.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {media.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border"
              >
                <div className="aspect-video bg-muted">
                  {item.type === "VIDEO" ? (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="p-4">
  <p className="truncate font-medium">
    {item.name}
  </p>

  <div className="mt-1 flex items-center justify-between gap-2">
    <p className="text-xs text-muted-foreground">
      {item.type === "VIDEO"
        ? "Vídeo"
        : "Imagem"}
    </p>

    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        item.active
          ? "bg-green-500/10 text-green-500"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {item.active ? "Ativo" : "Inativo"}
    </span>
  </div>

  <div className="mt-4 flex gap-2">
    <button
      type="button"
      disabled={updatingId === item.id}
      onClick={() => handleToggleActive(item)}
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
    >
      {updatingId === item.id ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : item.active ? (
        <PowerOff className="h-4 w-4" />
      ) : (
        <Power className="h-4 w-4" />
      )}

      {item.active ? "Inativar" : "Ativar"}
    </button>

    <button
      type="button"
      disabled={deletingId === item.id}
      onClick={() => handleDelete(item)}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {deletingId === item.id ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}

      Excluir
    </button>
  </div>
</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}