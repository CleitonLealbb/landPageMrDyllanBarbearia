import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Params = Promise<{
  id: string
}>

export async function PUT(
  req: Request,
  context: { params: Params }
) {
  const { id } = await context.params
  const body = await req.json()

  const barbershop = await prisma.barbershop.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      phone: body.phone,
      email: body.email,
      address: body.address,
      status: body.status,
    },
  })

  return NextResponse.json(barbershop)
}

export async function DELETE(
  req: Request,
  context: { params: Params }
) {
  const { id } = await context.params

  const [linkedUsers, linkedProfessionals] = await Promise.all([
    prisma.barbershopUser.count({
      where: {
        barbershopId: id,
      },
    }),
    prisma.professional.count({
      where: {
        barbershopId: id,
      },
    }),
  ])

  if (linkedUsers > 0 || linkedProfessionals > 0) {
    return NextResponse.json(
      {
        message:
          "Esta barbearia possui usuÃ¡rios ou profissionais vinculados e nÃ£o pode ser excluÃ­da.",
      },
      { status: 409 }
    )
  }

  await prisma.barbershop.delete({
    where: { id },
  })

  return NextResponse.json({
    message: "Barbearia excluída com sucesso.",
  })
}
