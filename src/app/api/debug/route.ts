import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const users = await prisma.user.count()
    const media = await prisma.tvMedia.count()

    return NextResponse.json({
      ok: true,
      users,
      media,
    })
  } catch (error) {
    console.error("DEBUG DB:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    )
  }
}