import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function main() {

  const hash = await bcrypt.hash("Admin@2434",10)

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
