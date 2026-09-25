import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client"
import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"

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

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN

  if (!blobToken) {
    console.error(
      "BLOB_READ_WRITE_TOKEN não está disponível no servidor."
    )

    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN não está configurado no ambiente local.",
      },
      { status: 500 }
    )
  }

  try {
    const body =
      (await request.json()) as HandleUploadBody

    const response = await handleUpload({
      body,
      request,

      // Forçamos o token explicitamente
      token: blobToken,

      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/webm",
            "image/png",
            "image/jpeg",
            "image/webp",
          ],

          maximumSizeInBytes:
            500 * 1024 * 1024,

          addRandomSuffix: true,

          tokenPayload: JSON.stringify({
            barbershopId:
              session.barbershopId,
          }),
        }
      },

      onUploadCompleted: async ({
        blob,
        tokenPayload,
      }) => {
        console.log(
          "Upload Blob concluído:",
          blob.url
        )

        console.log(
          "Token payload:",
          tokenPayload
        )
      },
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error(
      "Erro no upload da TV:",
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao realizar upload",
      },
      { status: 400 }
    )
  }
}