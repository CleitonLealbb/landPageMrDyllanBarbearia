import { describe, expect, it } from "vitest"
import { buildPackageCreateData, packageSavings, presentPackage, validatePackageBody } from "@/lib/services/packages"
import { calculatePackageSummary, filterPackages, normalizePackagePayload, reaisToCents, serviceTabs } from "@/features/services/helpers"
import type { ServicePackage } from "@/features/services/types"
describe("combos", () => {
  it("exige dois serviços distintos e ignora tenant do cliente", () => {
    expect(validatePackageBody({ name: "Combo", priceCents: 1000, durationMinutes: 60, serviceIds: ["a", "a"] }, false).error).toContain("dois")
    expect(validatePackageBody({ name: "Combo", priceCents: 1000, durationMinutes: 60, serviceIds: ["a", "b"], barbershopId: "externo" }, false).value).not.toHaveProperty("barbershopId")
  })
  it("deriva a economia", () => expect(packageSavings(5000, 4000)).toEqual({ cents: 1000, percent: 20 }))
  it("deduplica IDs válidos",()=>expect(validatePackageBody({name:" X ",priceCents:3000,durationMinutes:60,serviceIds:["a","b","a"]},false).value?.serviceIds).toEqual(["a","b"]))
  it("normaliza nome e descrição e exige valores inteiros",()=>{expect(validatePackageBody({name:" Combo ",description:"   ",priceCents:7000,durationMinutes:75,displayOrder:0,serviceIds:["a","b","a"]},false).value).toMatchObject({name:"Combo",description:null,priceCents:7000,durationMinutes:75,serviceIds:["a","b"]});expect(validatePackageBody({name:"Combo",priceCents:70.5,durationMinutes:60,serviceIds:["a","b"]},false).error).toBe("Preco invalido.");expect(validatePackageBody({name:"Combo",priceCents:7000,durationMinutes:1.5,serviceIds:["a","b"]},false).error).toBe("Duracao invalida.")})
  it("converte BRL para centavos",()=>{expect(reaisToCents("49,90")).toBe(4990);expect(reaisToCents("inválido")).toBeNull()})
  it("deriva preço original, economia real e percentual",()=>expect(calculatePackageSummary([{priceCents:3000},{priceCents:2000}],4000)).toEqual({originalPriceCents:5000,savingsCents:1000,savingsPercent:20}))
  it("usa a duração persistida mesmo quando difere da soma",()=>{const value:Parameters<typeof presentPackage>[0]={id:"p",name:"P",description:null,priceCents:4000,durationMinutes:75,displayOrder:1,status:"ACTIVE",items:[{displayOrder:0,service:{id:"a",name:"A",priceCents:3000,durationMinutes:30,status:"ACTIVE",category:null}},{displayOrder:1,service:{id:"b",name:"B",priceCents:2000,durationMinutes:20,status:"ACTIVE",category:null}}]};expect(presentPackage(value)).toMatchObject({originalPriceCents:5000,durationMinutes:75})})
  it("busca por nome, descrição ou serviço",()=>{const packages=[{id:"p",name:"Dia",description:"Completo",priceCents:4000,originalPriceCents:5000,durationMinutes:60,displayOrder:0,status:"ACTIVE",services:[{id:"s",name:"Barba",priceCents:3000,durationMinutes:30,status:"ACTIVE"}]}] satisfies ServicePackage[];expect(filterPackages(packages,"barba")).toHaveLength(1);expect(filterPackages(packages,"ausente")).toHaveLength(0)})
  it("normaliza payload com duração, status e serviços deduplicados",()=>expect(normalizePackagePayload({name:" Combo ",description:" ",priceReais:"40,00",durationMinutes:"75",displayOrder:"2",status:"INACTIVE",serviceIds:["a","b","a"]})).toEqual({payload:{name:"Combo",description:null,priceCents:4000,durationMinutes:75,displayOrder:2,status:"INACTIVE",serviceIds:["a","b"]}}))
  it("marca a aba de combos como disponível",()=>expect(serviceTabs.find(tab=>tab.value==="combos")).toMatchObject({label:"Combos / Pacotes",available:true}))
  it("não envia chaves preenchidas pela relação no nested create",()=>expect(buildPackageCreateData("tenant",{name:"Combo",description:null,priceCents:7000,durationMinutes:75,displayOrder:0,status:"ACTIVE",serviceIds:["s1","s2"]}).items.create).toEqual([{serviceId:"s1",displayOrder:0},{serviceId:"s2",displayOrder:1}]))
})
