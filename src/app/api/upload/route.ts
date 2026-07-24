import { NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
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
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json(
      { message: "Nenhuma imagem enviada." },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "mr-dyllan/profissionais",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      .end(buffer)
  })

  return NextResponse.json({
    url: result.secure_url,
  })
}
