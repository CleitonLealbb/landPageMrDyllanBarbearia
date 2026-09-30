import { PutObjectCommand } from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"

import { getSession } from "@/lib/tv-session"
import {
  r2,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} from "@/lib/r2"

const allowedTypes = [
  "video/mp4",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/webp",
]

const MAX_FILE_SIZE =
  500 * 1024 * 1024

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
}

export async function POST(request: Request) {
  const session = await getSession()

  if (
    !session ||
    session.globalRole === "SUPER_ADMIN" ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    !session.barbershopId
  ) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    )
  }

  try {
    const formData =
      await request.formData()

    const file =
      formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Arquivo não informado.",
        },
        { status: 400 }
      )
    }

    if (
      !allowedTypes.includes(file.type)
    ) {
      return NextResponse.json(
        {
          error:
            "Tipo de arquivo não permitido.",
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "O arquivo excede o limite de 500 MB.",
        },
        { status: 400 }
      )
    }

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      )

    const safeName =
      sanitizeFileName(file.name)

    const key =
      `tv/${session.barbershopId}/${Date.now()}-${safeName}`

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const url =
      `${R2_PUBLIC_URL}/${key}`

    console.log(
      "Upload R2 concluído:",
      url
    )

    return NextResponse.json({
      success: true,
      url,
      key,
      name: file.name,
      contentType: file.type,
      size: file.size,
    })
  } catch (error) {
    console.error(
      "Erro no upload R2 da TV:",
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao realizar upload",
      },
      { status: 500 }
    )
  }
}