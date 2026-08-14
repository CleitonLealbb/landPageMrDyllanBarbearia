import { describe, expect, it } from "vitest"
import { buildPackageCreateData, packageSavings, presentPackage, validatePackageBody } from "@/lib/services/packages"
import { calculatePackageSummary, filterPackages, normalizePackagePayload, reaisToCents, serviceTabs } from "@/features/services/helpers"
describe("combos", () => {
  it("exige dois serviços distintos e ignora tenant do cliente", () => {
    expect(validatePackageBody({ name: "Combo", priceCents: 1000, serviceIds: ["a", "a"] }, false).error).toContain("dois")
    expect(validatePackageBody({ name: "Combo", priceCents: 1000, serviceIds: ["a", "b"], barbershopId: "externo" }, false).value).not.toHaveProperty("barbershopId")
  })
  it("deriva a economia", () => expect(packageSavings(5000, 4000)).toEqual({ cents: 1000, percent: 20 }))
  it("deduplica IDs válidos",()=>expect(validatePackageBody({name:" X ",priceCents:3000,serviceIds:["a","b","a"]},false).value?.serviceIds).toEqual(["a","b"]))
  it("normaliza nome e descrição e exige centavos inteiros",()=>{expect(validatePackageBody({name:" Combo ",description:"   ",priceCents:7000,displayOrder:0,serviceIds:["a","b","a"]},false).value).toMatchObject({name:"Combo",description:null,priceCents:7000,serviceIds:["a","b"]});expect(validatePackageBody({name:"Combo",priceCents:70.5,serviceIds:["a","b"]},false).error).toBe("Preco invalido.")})
  it("converte BRL para centavos",()=>{expect(reaisToCents("49,90")).toBe(4990);expect(reaisToCents("inválido")).toBeNull()})
  it("deriva preço original, economia real, percentual e duração",()=>expect(calculatePackageSummary([{priceCents:3000,durationMinutes:30},{priceCents:2000,durationMinutes:20}],4000)).toEqual({originalPriceCents:5000,durationMinutes:50,savingsCents:1000,savingsPercent:20}))
  it("apresenta pacote sem persistir derivados",()=>{const value:any={id:"p",name:"P",description:null,priceCents:4000,displayOrder:1,status:"ACTIVE",items:[{service:{id:"a",name:"A",priceCents:3000,durationMinutes:30,status:"ACTIVE",category:null}},{service:{id:"b",name:"B",priceCents:2000,durationMinutes:20,status:"ACTIVE",category:null}}]};expect(presentPackage(value)).toMatchObject({originalPriceCents:5000,durationMinutes:50})})
  it("busca por nome, descrição ou serviço",()=>{const packages:any[]=[{name:"Dia",description:"Completo",services:[{name:"Barba"}]}];expect(filterPackages(packages,"barba")).toHaveLength(1);expect(filterPackages(packages,"ausente")).toHaveLength(0)})
  it("normaliza payload sem tenant e com serviços deduplicados",()=>expect(normalizePackagePayload({name:" Combo ",description:" ",priceReais:"40,00",displayOrder:"2",serviceIds:["a","b","a"]})).toEqual({payload:{name:"Combo",description:null,priceCents:4000,displayOrder:2,serviceIds:["a","b"]}}))
  it("marca a aba de combos como disponível",()=>expect(serviceTabs.find(tab=>tab.value==="combos")).toMatchObject({label:"Combos / Pacotes",available:true}))
  it("não envia chaves preenchidas pela relação no nested create",()=>expect(buildPackageCreateData("tenant",{name:"Combo",description:null,priceCents:7000,displayOrder:0,status:"ACTIVE",serviceIds:["s1","s2"]}).items.create).toEqual([{serviceId:"s1",displayOrder:0},{serviceId:"s2",displayOrder:1}]))
})
