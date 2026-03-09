import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  
  const { email, password, remember } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json({ error: "E-mail ou senha incorretos!" }, { status: 401 });
  }
  

  const ok = await bcrypt.compare(password, user.password);

  if (!ok) {
    return NextResponse.json({ error: "Senha inválida!" }, { status: 401 });
  }

  const token = jwt.sign(
    { 
      userId: user.id, 
      role: user.role 
    },
    process.env.JWT_SECRET!,
    { expiresIn: remember ? "7d" : "1d" }
  );

  // ✅ melhor prática: guardar em cookie httpOnly
  const res = NextResponse.json({
    user: { 
      id: user.id, 
      name: user.name, 
      role: user.role 
    },
  });

  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: remember 
    ? 60 * 60 * 24 * 30 // 30 dias
    : 60 * 60 * 24, // 1 dia
  });

  return res;
}

