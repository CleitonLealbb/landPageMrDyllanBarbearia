"use client";

import { useEffect, useRef, useState } from "react";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  GripVertical,
  Images,
  ListVideo,
  Loader2,
  Minus,
  MonitorPlay,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Tv,
  Upload,
} from "lucide-react";

type TvMedia = {
  id: string;
  name: string;
  url: string;
  type: "VIDEO" | "IMAGE";
  order: number;
  active: boolean;
  duration: number | null;
};

type UploadResponse = {
  success: boolean;
  uploadUrl?: string;
  publicUrl?: string;
  key?: string;
  error?: string;
};

type SortableMediaCardProps = {
  item: TvMedia;
  deletingId: string | null;
  updatingId: string | null;
  durationId: string | null;

  onToggleActive: (
    item: TvMedia
  ) => Promise<void>;

  onDelete: (
    item: TvMedia
  ) => Promise<void>;

  onDurationChange: (
    item: TvMedia,
    amount: number
  ) => Promise<void>;
};

function getVideoDuration(
  file: File
): Promise<number> {
  return new Promise(
    (resolve, reject) => {
      const video =
        document.createElement("video");

      const objectUrl =
        URL.createObjectURL(file);

      video.preload = "metadata";

      video.onloadedmetadata = () => {
        const duration =
          Math.ceil(video.duration);

        URL.revokeObjectURL(
          objectUrl
        );

        if (
          !Number.isFinite(duration) ||
          duration <= 0
        ) {
          reject(
            new Error(
              "Não foi possível identificar a duração do vídeo."
            )
          );

          return;
        }

        resolve(duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(
          objectUrl
        );

        reject(
          new Error(
            "Não foi possível ler a duração do vídeo."
          )
        );
      };

      video.src = objectUrl;
    }
  );
}

function formatDuration(
  duration: number | null
) {
  if (!duration) return null;

  const minutes =
    Math.floor(duration / 60);

  const seconds =
    duration % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function SortableMediaCard({
  item,
  deletingId,
  updatingId,
  durationId,
  onToggleActive,
  onDelete,
  onDurationChange,
}: SortableMediaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform:
      CSS.Transform.toString(
        transform
      ),
    transition,
    opacity: isDragging
      ? 0.6
      : 1,
    zIndex: isDragging
      ? 50
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-xl border bg-card ${
        isDragging
          ? "shadow-xl"
          : ""
      }`}
    >
      <div className="relative">
        <div className="aspect-video bg-muted">
          {item.type ===
          "VIDEO" ? (
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

        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute right-3 top-3 inline-flex cursor-grab items-center gap-2 rounded-md border bg-background/90 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur hover:bg-background active:cursor-grabbing"
          title="Clique, segure e arraste"
        >
          <GripVertical className="h-4 w-4" />
          Arrastar
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {item.name}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {item.type ===
              "VIDEO"
                ? "Vídeo"
                : "Imagem"}
            </p>

            {item.duration && (
              <p className="mt-1 text-xs text-muted-foreground">
                Duração:{" "}
                {formatDuration(
                  item.duration
                )}
              </p>
            )}
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              item.active
                ? "bg-green-500/10 text-green-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {item.active
              ? "Ativo"
              : "Inativo"}
          </span>
        </div>

        {item.type === "IMAGE" && (
          <div className="mt-4 rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Tempo na tela
            </p>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={
                  durationId ===
                    item.id ||
                  (item.duration ??
                    10) <= 1
                }
                onClick={() =>
                  onDurationChange(
                    item,
                    -1
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="min-w-20 text-center">
                {durationId ===
                item.id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  <span className="font-semibold">
                    {item.duration ??
                      10}
                    s
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={
                  durationId ===
                    item.id ||
                  (item.duration ??
                    10) >= 300
                }
                onClick={() =>
                  onDurationChange(
                    item,
                    1
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-dashed p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GripVertical className="h-4 w-4" />

            <span>
              Use o botão
              “Arrastar” para
              mudar a posição na
              programação.
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={
              updatingId ===
              item.id
            }
            onClick={() =>
              onToggleActive(item)
            }
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {updatingId ===
            item.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : item.active ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}

            {item.active
              ? "Inativar"
              : "Ativar"}
          </button>

          <button
            type="button"
            disabled={
              deletingId ===
              item.id
            }
            onClick={() =>
              onDelete(item)
            }
            className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {deletingId ===
            item.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

export function MarketingView() {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [media, setMedia] =
    useState<TvMedia[]>([]);

  const [uploading, setUploading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  const [
    updatingId,
    setUpdatingId,
  ] = useState<string | null>(
    null
  );

  const [
    durationId,
    setDurationId,
  ] = useState<string | null>(
    null
  );

  const [
    reordering,
    setReordering,
  ] = useState(false);

  const sensors = useSensors(
    useSensor(
      PointerSensor,
      {
        activationConstraint: {
          distance: 8,
        },
      }
    )
  );

  async function loadMedia() {
    try {
      setLoading(true);

      const response =
        await fetch(
          "/api/tv/media"
        );

      if (!response.ok) {
        throw new Error(
          "Erro ao buscar mídias"
        );
      }

      const data: TvMedia[] =
        await response.json();

      setMedia(data);
    } catch (error) {
      console.error(
        "Erro ao carregar mídias:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMedia();
  }, []);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);

      const mediaType:
        | "VIDEO"
        | "IMAGE" =
        file.type.startsWith(
          "image/"
        )
          ? "IMAGE"
          : "VIDEO";

      let duration:
        | number
        | null = null;

      if (
        mediaType ===
        "VIDEO"
      ) {
        duration =
          await getVideoDuration(
            file
          );

        console.log(
          "Duração detectada:",
          duration,
          "segundos"
        );
      } else {
        duration = 10;

        console.log(
          "Duração da imagem:",
          duration,
          "segundos"
        );
      }

      const prepareResponse =
        await fetch(
          "/api/tv/upload",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              {
                name: file.name,
                type: file.type,
                size: file.size,
              }
            ),
          }
        );

      const prepareData: UploadResponse =
        await prepareResponse.json();

      if (
        !prepareResponse.ok
      ) {
        throw new Error(
          prepareData.error ??
            "Não foi possível preparar o upload."
        );
      }

      if (
        !prepareData.uploadUrl ||
        !prepareData.publicUrl
      ) {
        throw new Error(
          "A API não retornou as URLs necessárias para o upload."
        );
      }

      const r2Response =
        await fetch(
          prepareData.uploadUrl,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                file.type,
            },

            body: file,
          }
        );

      if (!r2Response.ok) {
        const responseText =
          await r2Response.text();

        console.error(
          "Erro R2:",
          r2Response.status,
          responseText
        );

        throw new Error(
          "Não foi possível enviar o arquivo para o R2."
        );
      }

      const mediaResponse =
        await fetch(
          "/api/tv/media",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              {
                name: file.name,
                url: prepareData.publicUrl,
                type: mediaType,
                duration,
              }
            ),
          }
        );

      const mediaData =
        await mediaResponse.json();

      if (
        !mediaResponse.ok
      ) {
        throw new Error(
          mediaData.error ??
            "Erro ao salvar mídia"
        );
      }

      await loadMedia();
    } catch (error) {
      console.error(
        "Erro no upload:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a mídia."
      );
    } finally {
      setUploading(false);

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    }
  }

  const videos =
    media.filter(
      (item) =>
        item.type === "VIDEO"
    );

  const images =
    media.filter(
      (item) =>
        item.type === "IMAGE"
    );

  async function handleToggleActive(
    item: TvMedia
  ) {
    try {
      setUpdatingId(
        item.id
      );

      const response =
        await fetch(
          `/api/tv/media/${item.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              {
                active:
                  !item.active,
              }
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Erro ao atualizar mídia"
        );
      }

      await loadMedia();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a mídia."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDurationChange(
    item: TvMedia,
    amount: number
  ) {
    if (
      item.type !== "IMAGE"
    ) {
      return;
    }

    const currentDuration =
      item.duration ?? 10;

    const newDuration =
      currentDuration +
      amount;

    if (
      newDuration < 1 ||
      newDuration > 300
    ) {
      return;
    }

    try {
      setDurationId(
        item.id
      );

      const response =
        await fetch(
          `/api/tv/media/${item.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              {
                duration:
                  newDuration,
              }
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível alterar a duração."
        );
      }

      setMedia(
        (current) =>
          current.map(
            (mediaItem) =>
              mediaItem.id ===
              item.id
                ? {
                    ...mediaItem,
                    duration:
                      newDuration,
                  }
                : mediaItem
          )
      );
    } catch (error) {
      console.error(
        "Erro ao alterar duração:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a duração."
      );

      await loadMedia();
    } finally {
      setDurationId(null);
    }
  }

  async function handleDelete(
    item: TvMedia
  ) {
    const confirmed =
      window.confirm(
        `Excluir "${item.name}" da programação?`
      );

    if (!confirmed)
      return;

    try {
      setDeletingId(
        item.id
      );

      const response =
        await fetch(
          `/api/tv/media/${item.id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Erro ao excluir mídia"
        );
      }

      await loadMedia();
    } catch (error) {
      console.error(
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a mídia."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const {
      active,
      over,
    } = event;

    if (!over) return;

    if (
      active.id === over.id
    ) {
      return;
    }

    const oldIndex =
      media.findIndex(
        (item) =>
          item.id ===
          active.id
      );

    const newIndex =
      media.findIndex(
        (item) =>
          item.id ===
          over.id
      );

    if (
      oldIndex === -1 ||
      newIndex === -1
    ) {
      return;
    }

    const previousMedia =
      [...media];

    const reordered =
      arrayMove(
        media,
        oldIndex,
        newIndex
      ).map(
        (item, index) => ({
          ...item,
          order: index,
        })
      );

    setMedia(
      reordered
    );

    try {
      setReordering(true);

      const response =
        await fetch(
          "/api/tv/media/reorder",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              {
                ids: reordered.map(
                  (item) =>
                    item.id
                ),
              }
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Não foi possível salvar a nova ordem."
        );
      }
    } catch (error) {
      console.error(
        "Erro ao reordenar:",
        error
      );

      setMedia(
        previousMedia
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a nova ordem."
      );
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Marketing
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie campanhas,
          promoções e
          conteúdos exibidos
          nas TVs da
          barbearia.
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
                TV da
                Barbearia
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Arraste as
              mídias para
              alterar a
              ordem exibida
              nas TVs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {reordering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
                ordem...
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={
                handleFileChange
              }
            />

            <button
              type="button"
              disabled={
                uploading
              }
              onClick={() =>
                inputRef.current?.click()
              }
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
                  Adicionar
                  mídia
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : media.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-10 text-center">
            <div className="rounded-full border p-4">
              <MonitorPlay className="h-8 w-8 text-muted-foreground" />
            </div>

            <h4 className="mt-4 font-medium">
              Nenhuma mídia
              adicionada
            </h4>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Adicione
              vídeos ou
              imagens para
              começar a
              montar a
              programação
              das TVs.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={
              sensors
            }
            collisionDetection={
              closestCenter
            }
            onDragEnd={
              handleDragEnd
            }
          >
            <SortableContext
              items={media.map(
                (item) =>
                  item.id
              )}
              strategy={
                rectSortingStrategy
              }
            >
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {media.map(
                  (item) => (
                    <SortableMediaCard
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                      deletingId={
                        deletingId
                      }
                      updatingId={
                        updatingId
                      }
                      durationId={
                        durationId
                      }
                      onToggleActive={
                        handleToggleActive
                      }
                      onDelete={
                        handleDelete
                      }
                      onDurationChange={
                        handleDurationChange
                      }
                    />
                  )
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}