import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
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
    const body = await request.json()

    const name =
      typeof body.name === "string"
        ? body.name
        : ""

    const type =
      typeof body.type === "string"
        ? body.type
        : ""

    const size =
      typeof body.size === "number"
        ? body.size
        : 0

    if (!name || !type) {
      return NextResponse.json(
        { error: "Arquivo inválido." },
        { status: 400 }
      )
    }

    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        {
          error:
            "Tipo de arquivo não permitido.",
        },
        { status: 400 }
      )
    }

    if (
      size <= 0 ||
      size > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "Arquivo inválido ou maior que 500 MB.",
        },
        { status: 400 }
      )
    }

    const safeName =
      sanitizeFileName(name)

    const key =
      `tv/${session.barbershopId}/${Date.now()}-${safeName}`

    const command =
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: type,
      })

    const uploadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 900,
        }
      )

    const publicUrl =
      `${R2_PUBLIC_URL}/${key}`

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key,
    })
  } catch (error) {
    console.error(
      "Erro ao gerar URL R2:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Não foi possível preparar o upload.",
      },
      { status: 500 }
    )
  }
}