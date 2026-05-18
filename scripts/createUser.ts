import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function main() {

  const hash = await bcrypt.hash("123456",10)

  const user = await prisma.user.create({
    data:{
      name:"Admin",
      email:"admin@admin.com",
      password:hash,
      role:"OWNER"
    }
  })

  console.log(user)

}

main()
