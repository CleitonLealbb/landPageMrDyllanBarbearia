import {prisma} from "@/lib/prisma";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { name, email, password, role} = await request.json();

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data:{
      name,
      email,
      password: hashedPassword,
      role,
    }
  })
  return NextResponse.json(user);
}