import { NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import type { UploadApiResponse } from "cloudinary"
import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "Não autenticado." },
      { status: 401 }
    )
  }

  if (
    session.type !== "USER" ||
    session.role !== "BARBERSHOP_OWNER"
  ) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const barbershop = await getCurrentBarbershop()

  if (!barbershop) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const formData = await req.formData()
  const uploadedFile = formData.get("file")

  if (!(uploadedFile instanceof File)) {
    return NextResponse.json(
      { message: "Nenhuma imagem enviada." },
      { status: 400 }
    )
  }

  const file = uploadedFile

  if (file.size === 0) {
    return NextResponse.json(
      { message: "Arquivo inválido." },
      { status: 400 }
    )
  }

  const MAX_FILE_SIZE = 2 * 1024 * 1024

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "Arquivo acima do limite permitido." },
      { status: 413 }
    )
  }

  const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ])

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { message: "Tipo de arquivo não permitido." },
      { status: 415 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const hasValidSignature =
    (file.type === "image/jpeg" &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (file.type === "image/png" &&
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a) ||
    (file.type === "image/webp" &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP")

  if (!hasValidSignature) {
    return NextResponse.json(
      { message: "Tipo de arquivo não permitido." },
      { status: 415 }
    )
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      { message: "Erro interno do servidor." },
      { status: 500 }
    )
  }

  let result: UploadApiResponse

  try {
    result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "mr-dyllan/profissionais",
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
          },
          (error, uploadResult) => {
            if (error) {
              reject(error)
              return
            }

            if (!uploadResult) {
              reject(new Error())
              return
            }

            resolve(uploadResult)
          }
        )
        .end(buffer)
    })
  } catch {
    return NextResponse.json(
      { message: "Não foi possível enviar a imagem." },
      { status: 502 }
    )
  }

  if (
    typeof result.secure_url !== "string" ||
    result.secure_url.length === 0 ||
    !result.secure_url.startsWith("https://")
  ) {
    return NextResponse.json(
      { message: "Não foi possível enviar a imagem." },
      { status: 502 }
    )
  }

  return NextResponse.json({
    url: result.secure_url,
  })
}
