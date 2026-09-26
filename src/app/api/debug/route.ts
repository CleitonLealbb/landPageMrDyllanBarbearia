import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function getDatabaseHost() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) return null

  try {
    return new URL(databaseUrl).hostname
  } catch {
    return "URL_INVALIDA"
  }
}

export async function GET() {
  const databaseHost = getDatabaseHost()

  try {
    const users = await prisma.user.count()
    const media = await prisma.tvMedia.count()

    return NextResponse.json({
      ok: true,
      users,
      media,

      environment: {
        vercelEnv: process.env.VERCEL_ENV ?? null,
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        databaseHost,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasDatabaseUrlUnpooled: Boolean(
          process.env.DATABASE_URL_UNPOOLED
        ),
        hasJwtSecret: Boolean(process.env.JWT_SECRET),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        environment: {
          vercelEnv: process.env.VERCEL_ENV ?? null,
          gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
          databaseHost,
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          hasDatabaseUrlUnpooled: Boolean(
            process.env.DATABASE_URL_UNPOOLED
          ),
          hasJwtSecret: Boolean(process.env.JWT_SECRET),
        },

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    )
  }
}