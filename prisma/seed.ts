import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {

  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@email.com",
      password: "123456",
      role: "ADMIN"
    }
  })

}

main()