import { beforeEach, describe, expect, it, vi } from "vitest"
import { expectJson, jsonRequest } from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }))
import { GET, POST } from "@/app/api/service-categories/route"
import { DELETE, PUT } from "@/app/api/service-categories/[id]/route"
const context = (id="category-one") => ({ params: Promise.resolve({ id }) })
const category = { id:"category-one",name:"Cabelo",description:null,displayOrder:0,status:"ACTIVE",_count:{services:2} }
function allow(){getSessionMock.mockResolvedValue(ownerSession);prismaMock.barbershopUser.findFirst.mockResolvedValue({id:"membership"})}
describe("service categories",()=>{
  beforeEach(allow)
  it.each([[null,401],[superAdminSession,403],[professionalBarberSession,403]])("bloqueia antes de consultar",async(session,status)=>{getSessionMock.mockResolvedValue(session);await expectJson(await GET(),status);expect(prismaMock.serviceCategory.findMany).not.toHaveBeenCalled()})
  it("bloqueia owner sem membership",async()=>{prismaMock.barbershopUser.findFirst.mockResolvedValue(null);await expectJson(await GET(),403);expect(prismaMock.serviceCategory.findMany).not.toHaveBeenCalled()})
  it("lista isolando tenant e ordenando",async()=>{prismaMock.serviceCategory.findMany.mockResolvedValue([category]);await expectJson(await GET(),200);expect(prismaMock.serviceCategory.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{barbershopId:ownerSession.barbershopId},orderBy:[{displayOrder:"asc"},{name:"asc"}]}))})
  it("valida e cria sem aceitar tenant",async()=>{await expectJson(await POST(jsonRequest("http://x","POST",{name:"X",barbershopId:"other"})),400);expect(prismaMock.serviceCategory.create).not.toHaveBeenCalled();prismaMock.serviceCategory.create.mockResolvedValue(category);await expectJson(await POST(jsonRequest("http://x","POST",{name:" Cabelo ",displayOrder:0})),201);expect(prismaMock.serviceCategory.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({name:"Cabelo",barbershopId:ownerSession.barbershopId})}))})
  it("retorna 409 sanitizado",async()=>{prismaMock.serviceCategory.create.mockRejectedValue({code:"P2002",message:"secret"});expect(await expectJson(await POST(jsonRequest("http://x","POST",{name:"Cabelo"})),409)).toEqual({message:"Ja existe uma categoria com este nome."})})
  it("recusa outro tenant na edicao",async()=>{prismaMock.serviceCategory.findFirst.mockResolvedValue(null);await expectJson(await PUT(jsonRequest("http://x","PUT",{name:"Novo"}),context("other")),404);expect(prismaMock.serviceCategory.update).not.toHaveBeenCalled()})
  it("edita e inativa de modo idempotente",async()=>{prismaMock.serviceCategory.findFirst.mockResolvedValue({id:"category-one"});prismaMock.serviceCategory.update.mockResolvedValue({...category,name:"Novo"});await expectJson(await PUT(jsonRequest("http://x","PUT",{name:" Novo "}),context()),200);prismaMock.serviceCategory.findFirst.mockResolvedValue(category);prismaMock.serviceCategory.update.mockResolvedValue({...category,status:"INACTIVE"});await expectJson(await DELETE(jsonRequest("http://x","DELETE",{}),context()),200);prismaMock.serviceCategory.findFirst.mockResolvedValue({...category,status:"INACTIVE"});prismaMock.serviceCategory.update.mockClear();await expectJson(await DELETE(jsonRequest("http://x","DELETE",{}),context()),200);expect(prismaMock.serviceCategory.update).not.toHaveBeenCalled()})
  it("sanitiza erro interno",async()=>{prismaMock.serviceCategory.findMany.mockRejectedValue(new Error("database secret"));expect(await expectJson(await GET(),500)).toEqual({message:"Erro interno do servidor."})})
})
