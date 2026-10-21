import { beforeEach, describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import {
  ownerSession,
  professionalBarberSession,
  superAdminSession,
} from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData } from "../helpers/route-assertions"

const { getSessionMock, getCurrentBarbershopMock, uploadStreamMock, cloudinaryConfigMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(), getCurrentBarbershopMock: vi.fn(),
  uploadStreamMock: vi.fn<(
    options: Record<string, unknown>,
    callback: (error: Error | null, result?: { secure_url: string }) => void
  ) => { end: () => void }>(() => { throw new Error("Unexpected Cloudinary upload") }),
  cloudinaryConfigMock: vi.fn(),
}))
vi.mock("@/lib/auth/session", () => ({
  getSession: getSessionMock, getCurrentBarbershop: getCurrentBarbershopMock,
}))
vi.mock("cloudinary", () => ({
  v2: { config: cloudinaryConfigMock, uploader: { upload_stream: uploadStreamMock } },
}))

import { POST } from "@/app/api/upload/route"

const emptyUploadRequest = () => new Request("http://test/api/upload", { method: "POST", body: new FormData() })
const userBarber = { ...ownerSession, tenantRole: "BARBER" } as const
const userAssistant = { ...ownerSession, tenantRole: "ASSISTANT" } as const

function allowOwner() {
  getSessionMock.mockResolvedValue(ownerSession)
  getCurrentBarbershopMock.mockResolvedValue({ id: ownerSession.barbershopId, name: "One" })
  prismaMock.barbershopUser.findFirst.mockResolvedValue({ id: "membership" })
}

describe("/api/upload", () => {
  beforeEach(allowOwner)

  it.each([
    [null, 401], [superAdminSession, 403], [userBarber, 403], [userAssistant, 403],
    [professionalBarberSession, 403],
  ])("bloqueia identidade sem permissao", async (session, status) => {
    getSessionMock.mockResolvedValue(session)
    await expectJson(await POST(emptyUploadRequest()), status)
    expect(uploadStreamMock).not.toHaveBeenCalled()
    expect(prismaMock.barbershopUser.findFirst).not.toHaveBeenCalled()
  })

  it("owner sem membership retorna 403 sem Cloudinary", async () => {
    prismaMock.barbershopUser.findFirst.mockResolvedValue(null)
    await expectJson(await POST(emptyUploadRequest()), 403)
    expect(uploadStreamMock).not.toHaveBeenCalled()
  })

  it("owner com tenant divergente retorna 403 antes da membership", async () => {
    getCurrentBarbershopMock.mockResolvedValue({ id: "other-tenant" })
    await expectJson(await POST(emptyUploadRequest()), 403)
    expect(prismaMock.barbershopUser.findFirst).not.toHaveBeenCalled()
    expect(uploadStreamMock).not.toHaveBeenCalled()
  })

  it("owner valido alcanca validacao do arquivo sem upload externo", async () => {
    await expectJson(await POST(emptyUploadRequest()), 400)
    expect(uploadStreamMock).not.toHaveBeenCalled()
  })

  it("arquivo vazio retorna status atual sem Cloudinary", async () => {
    const data = new FormData()
    data.set("file", new File([], "empty.png", { type: "image/png" }))
    await expectJson(await POST(new Request("http://test/api/upload", { method: "POST", body: data })), 400)
    expect(uploadStreamMock).not.toHaveBeenCalled()
  })

  it("arquivo permitido usa Cloudinary mockado e retorna somente URL segura", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud"
    process.env.CLOUDINARY_API_KEY = "test-key"
    process.env.CLOUDINARY_API_SECRET = "test-secret"
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const data = new FormData()
    data.set("file", new File([pngSignature], "image.png", { type: "image/png" }))
    uploadStreamMock.mockImplementation((_options, callback) => ({
      end: vi.fn(() => callback(null, { secure_url: "https://cdn.test/image.png" })),
    }))

    const body = await expectJson(
      await POST(new Request("http://test/api/upload", { method: "POST", body: data })),
      200
    )
    expect(uploadStreamMock).toHaveBeenCalledOnce()
    expect(body).toEqual({ url: "https://cdn.test/image.png" })
    expectNoSensitiveData(body)
    expect(JSON.stringify(body)).not.toContain("test-secret")
  })

  it("erro de Cloudinary retorna 502 sanitizado", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud"
    process.env.CLOUDINARY_API_KEY = "test-key"
    process.env.CLOUDINARY_API_SECRET = "test-secret"
    const data = new FormData()
    data.set("file", new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], "image.png", { type: "image/png" }))
    uploadStreamMock.mockImplementation((_options, callback) => ({
      end: vi.fn(() => callback(new Error("cloudinary raw secret"))),
    }))
    const body = await expectJson(
      await POST(new Request("http://test/api/upload", { method: "POST", body: data })), 502
    )
    expect(JSON.stringify(body)).not.toContain("cloudinary raw secret")
  })
})
