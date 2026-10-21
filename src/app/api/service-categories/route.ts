import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { internalErrorResponse, isPrismaUniqueError, requireCatalogOwner } from "@/lib/services/catalog"
import { adminCategorySelect, validateCategoryBody } from "@/lib/services/categories"
const bad = (message: string) => NextResponse.json({ message }, { status: 400 })
export async function GET() { try { const auth = await requireCatalogOwner(); if (auth.response) return auth.response; return NextResponse.json(await prisma.serviceCategory.findMany({ where: { barbershopId: auth.owner.barbershopId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: adminCategorySelect })) } catch { return internalErrorResponse() } }
export async function POST(request: Request) { try { const auth = await requireCatalogOwner(); if (auth.response) return auth.response; const validation = validateCategoryBody(await request.json(), false); if (validation.error) return bad(validation.error); const category = await prisma.serviceCategory.create({ data: { ...validation.value!, name: validation.value!.name!, barbershopId: auth.owner.barbershopId }, select: adminCategorySelect }); return NextResponse.json(category, { status: 201 }) } catch (error) { if (isPrismaUniqueError(error)) return NextResponse.json({ message: "Ja existe uma categoria com este nome." }, { status: 409 }); return internalErrorResponse() } }
