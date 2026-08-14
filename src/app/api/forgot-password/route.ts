import { NextResponse } from "next/server"
import crypto from "crypto"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"


const RESET_TOKEN_TTL_MS = 1000 * 60 * 60

export async function POST(req: Request) {
  const body = await req.json()
  const email = body.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json(
      { message: "Informe o e-mail." },
      { status: 400 }
    )
  }

  const token = crypto.randomBytes(32).toString("hex")
  const resetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS)

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  })

  if (user) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetToken: token,
        resetExpires,
      },
    })
  } else {
    const professional = await prisma.professional.findUnique({
      where: {
        email,
        userId: null,
      },
    })

    if (professional) {
      await prisma.professional.update({
        where: {
          id: professional.id,
        },
        data: {
          resetToken: token,
          resetExpires,
        },
      })
    }
  }

  if ((user || email) && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    if (user || await prisma.professional.findUnique({ where: { email, userId: null } })) {
      await resend.emails.send({
        from: process.env.MAIL_FROM!,
        to: email,
        subject: "Recuperação de senha",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Recuperação de senha</h2>
        
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
        
            <p>
              <a
                href="${resetLink}"
                style="
                  background:#facc15;
                  color:#000;
                  padding:12px 20px;
                  text-decoration:none;
                  border-radius:8px;
                  display:inline-block;
                  font-weight:bold;
                "
              >
                Criar nova senha
              </a>
            </p>
        
            <p>Este link expira em 1 hora.</p>
        
            <p>Se você não solicitou esta alteração, ignore este e-mail.</p>
        
            <hr />
        
            <small>
              Mr Dyllan Barbearia
            </small>
          </div>
        `
      })
    }
  }

  return NextResponse.json({
    message:
      "Se o e-mail estiver cadastrado, enviaremos instrucoes para redefinir a senha.",
  })
}
