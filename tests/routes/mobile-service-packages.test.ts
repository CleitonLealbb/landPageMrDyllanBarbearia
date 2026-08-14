import { describe, expect, it } from "vitest"
import { expectJson } from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"
import { GET } from "@/app/api/mobile/v1/barbershops/[slug]/packages/route"
const context=(slug="shop")=>({params:Promise.resolve({slug})})
const request=new Request("http://x/api/mobile/v1/barbershops/shop/packages")
const service=(id:string,priceCents:number,durationMinutes:number,status="ACTIVE")=>({id,name:id,priceCents,durationMinutes,status,category:null})
describe("API pública de combos",()=>{
 it.each(["inexistente","inativa"])("retorna 404 para barbearia %s",async()=>{prismaMock.barbershop.findFirst.mockResolvedValue(null);await expectJson(await GET(request,context()),404);expect(prismaMock.barbershop.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{slug:"shop",status:"ACTIVE"}}));expect(prismaMock.servicePackage.findMany).not.toHaveBeenCalled()})
 it("consulta somente combos ativos e serviços ativos em ordem",async()=>{prismaMock.barbershop.findFirst.mockResolvedValue({id:"tenant"});prismaMock.servicePackage.findMany.mockResolvedValue([]);await expectJson(await GET(request,context()),200);expect(prismaMock.servicePackage.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{barbershopId:"tenant",status:"ACTIVE",items:{every:{service:{status:"ACTIVE"}}}},orderBy:[{displayOrder:"asc"},{name:"asc"}]}))})
 it("omite combo inválido e deriva preço e duração",async()=>{prismaMock.barbershop.findFirst.mockResolvedValue({id:"tenant"});prismaMock.servicePackage.findMany.mockResolvedValue([{id:"bad",name:"Um",description:null,priceCents:1000,displayOrder:0,items:[{service:service("s1",2000,20)}]},{id:"ok",name:"Dois",description:null,priceCents:3000,displayOrder:1,status:"ACTIVE",barbershopId:"tenant",items:[{service:service("s1",2000,20)},{service:service("s2",2500,30)}]}]);const body=await expectJson(await GET(request,context()),200) as unknown[];expect(body).toHaveLength(1);expect(body[0]).toMatchObject({id:"ok",originalPriceCents:4500,durationMinutes:50,displayOrder:1});expect(JSON.stringify(body)).not.toMatch(/barbershopId|status|internal|createdAt|updatedAt/)})
 it("sanitiza erro interno",async()=>{prismaMock.barbershop.findFirst.mockRejectedValue(new Error("secret"));const body=await expectJson(await GET(request,context()),500);expect(JSON.stringify(body)).not.toContain("secret")})
})
