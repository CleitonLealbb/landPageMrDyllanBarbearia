import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash("123456", 10)

  await prisma.user.upsert({
    where: { email: "admin@admin.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@admin.com",
      password: hash,
      role: "ADMIN",
    },
  })

  console.log("Usuário admin criado!")
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())