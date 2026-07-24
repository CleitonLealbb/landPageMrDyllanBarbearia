import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {

  const hash = await bcrypt.hash("git checkout -b feature/barbershop-owner",10)

  const user = await prisma.user.create({
    data:{
      name:"Cleiton Leal",
      email:"admin.admin@gmail.com",
      password:hash,
      role:"SUPER_ADMIN"
    }
  })

  console.log(user)

}

main()
