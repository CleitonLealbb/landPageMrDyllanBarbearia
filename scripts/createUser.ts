import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function main() {

  const hash = await bcrypt.hash("Le@l9955",10)

  const user = await prisma.user.create({
    data:{
      name:"Cleiton Leal",
      email:"cleiton_nx@hotmail.com",
      password:hash,
      role:"OWNER"
    }
  })

  console.log(user)

}

main()
