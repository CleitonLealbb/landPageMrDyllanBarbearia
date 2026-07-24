import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

async function main() {
  const name = process.env.CREATE_USER_NAME?.trim()
  const email = process.env.CREATE_USER_EMAIL?.trim()
  const password = process.env.CREATE_USER_PASSWORD

  if (!name || !email || !password) {
    throw new Error(
      "Defina CREATE_USER_NAME, CREATE_USER_EMAIL e CREATE_USER_PASSWORD antes de executar o script."
    )
  }

  const prisma = new PrismaClient()
  const hash = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data:{
      name,
      email,
      password:hash,
      role:"SUPER_ADMIN"
    }
  })

}

main()
