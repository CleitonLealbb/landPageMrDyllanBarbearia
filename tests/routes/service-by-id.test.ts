import { beforeEach, describe, expect, it, vi } from "vitest"

import { expectJson, jsonRequest } from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"
import { ownerSession } from "../setup/session-fixtures"

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }))

import { DELETE, PUT } from "@/app/api/services/[id]/route"
import { PUT as PUT_PROFESSIONALS } from "@/app/api/services/[id]/professionals/route"

const context = (id = "service-one") => ({ params: Promise.resolve({ id }) })
const service = {
  id: "service-one",
  name: "Corte",
  description: null,
  priceCents: 5000,
  durationMinutes: 40,
  displayOrder: 0,
  status: "ACTIVE",
  professionals: [],
}

function allowOwner() {
  getSessionMock.mockResolvedValue(ownerSession)
  prismaMock.barbershopUser.findFirst.mockResolvedValue({ id: "membership" })
}

function mockTransaction() {
  prismaMock.$transaction.mockImplementation(async (...args: unknown[]) => {
    const callback = args[0] as (transaction: typeof prismaMock) => Promise<unknown>
    return callback(prismaMock)
  })
}

describe("/api/services/[id]", () => {
  beforeEach(allowOwner)

  it("retorna 404 para servico de outro tenant sem mutar", async () => {
    prismaMock.service.findFirst.mockResolvedValue(null)
    await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { name: "Novo" }), context("other")),
      404
    )
    expect(prismaMock.service.findFirst).toHaveBeenCalledWith({
      where: { id: "other", barbershopId: ownerSession.barbershopId },
      select: { id: true },
    })
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })

  it("atualiza somente campos permitidos sem mover tenant", async () => {
    prismaMock.service.findFirst.mockResolvedValue({ id: "service-one" })
    prismaMock.service.update.mockResolvedValue({ ...service, name: "Novo" })
    await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { name: " Novo " }), context()),
      200
    )
    expect(prismaMock.service.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "service-one" },
      data: { name: "Novo" },
    }))
  })

  it("rejeita tenant e campos inesperados", async () => {
    prismaMock.service.findFirst.mockResolvedValue({ id: "service-one" })
    await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { barbershopId: "other" }), context()),
      400
    )
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })

  it("retorna 409 sanitizado em duplicidade", async () => {
    prismaMock.service.findFirst.mockResolvedValue({ id: "service-one" })
    prismaMock.service.update.mockRejectedValue({ code: "P2002", message: "database secret" })
    const body = await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { name: "Duplicado" }), context()),
      409
    )
    expect(body).toEqual({ message: "Ja existe um servico com este nome." })
  })

  it("inativa sem excluir fisicamente", async () => {
    prismaMock.service.findFirst.mockResolvedValue(service)
    prismaMock.service.update.mockResolvedValue({ ...service, status: "INACTIVE" })
    await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context()), 200)
    expect(prismaMock.service.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "service-one" },
      data: { status: "INACTIVE" },
    }))
  })

  it("inativacao repetida e idempotente", async () => {
    prismaMock.service.findFirst.mockResolvedValue({ ...service, status: "INACTIVE" })
    await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context()), 200)
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })
})

describe("/api/services/[id]/professionals", () => {
  beforeEach(allowOwner)

  it("recusa servico de outro tenant", async () => {
    prismaMock.service.findFirst.mockResolvedValue(null)
    await expectJson(
      await PUT_PROFESSIONALS(jsonRequest("http://test/x", "PUT", { professionalIds: [] }), context("other")),
      404
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("recusa associacao cruzada e preserva associacoes", async () => {
    prismaMock.service.findFirst.mockResolvedValue({ id: "service-one" })
    prismaMock.professional.findMany.mockResolvedValue([{ id: "same-tenant" }])
    await expectJson(
      await PUT_PROFESSIONALS(
        jsonRequest("http://test/x", "PUT", { professionalIds: ["same-tenant", "other-tenant"] }),
        context()
      ),
      400
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.professionalService.deleteMany).not.toHaveBeenCalled()
  })

  it("substitui associacoes deduplicadas atomicamente", async () => {
    prismaMock.service.findFirst
      .mockResolvedValueOnce({ id: "service-one" })
      .mockResolvedValueOnce(service)
    prismaMock.professional.findMany.mockResolvedValue([{ id: "professional-one" }])
    prismaMock.professionalService.deleteMany.mockResolvedValue({ count: 2 })
    prismaMock.professionalService.createMany.mockResolvedValue({ count: 1 })
    mockTransaction()

    await expectJson(
      await PUT_PROFESSIONALS(
        jsonRequest("http://test/x", "PUT", { professionalIds: ["professional-one", "professional-one"] }),
        context()
      ),
      200
    )
    expect(prismaMock.professionalService.deleteMany).toHaveBeenCalledWith({
      where: { barbershopId: ownerSession.barbershopId, serviceId: "service-one" },
    })
    expect(prismaMock.professionalService.createMany).toHaveBeenCalledWith({
      data: [{
        barbershopId: ownerSession.barbershopId,
        serviceId: "service-one",
        professionalId: "professional-one",
      }],
    })
  })

  it("aceita lista vazia e somente remove associacoes dentro da transacao", async () => {
    prismaMock.service.findFirst
      .mockResolvedValueOnce({ id: "service-one" })
      .mockResolvedValueOnce(service)
    prismaMock.professionalService.deleteMany.mockResolvedValue({ count: 1 })
    mockTransaction()
    await expectJson(
      await PUT_PROFESSIONALS(jsonRequest("http://test/x", "PUT", { professionalIds: [] }), context()),
      200
    )
    expect(prismaMock.professionalService.createMany).not.toHaveBeenCalled()
  })

  it("sanitiza falha transacional", async () => {
    prismaMock.service.findFirst.mockResolvedValue({ id: "service-one" })
    prismaMock.$transaction.mockRejectedValue(new Error("database secret"))
    const body = await expectJson(
      await PUT_PROFESSIONALS(jsonRequest("http://test/x", "PUT", { professionalIds: [] }), context()),
      500
    )
    expect(body).toEqual({ message: "Erro interno do servidor." })
  })
})
