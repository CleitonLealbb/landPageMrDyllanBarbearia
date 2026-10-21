import http from "node:http"
import https from "node:https"
import net from "node:net"
import { afterEach, beforeEach, vi } from "vitest"

import { prismaMock, resetPrismaMock } from "./prisma-mock"

const TEST_DATABASE_URL = "postgresql://invalid:invalid@127.0.0.1:1/test"

function assertLocalDatabaseUrl(databaseUrl: string) {
  const parsed = new URL(databaseUrl)

  if (
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("aws.neon.tech") ||
    !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
  ) {
    throw new Error(`External DATABASE_URL is forbidden in tests: ${parsed.hostname}`)
  }
}

process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.JWT_SECRET = "unit-test-only-jwt-secret"
delete process.env.RESEND_API_KEY
delete process.env.CLOUDINARY_CLOUD_NAME
delete process.env.CLOUDINARY_API_KEY
delete process.env.CLOUDINARY_API_SECRET
assertLocalDatabaseUrl(process.env.DATABASE_URL)

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const networkError = () => {
  throw new Error("Network access is forbidden in unit tests")
}

beforeEach(() => {
  assertLocalDatabaseUrl(process.env.DATABASE_URL ?? "")
  resetPrismaMock()
  vi.stubGlobal("fetch", networkError)
  vi.spyOn(http, "request").mockImplementation(networkError as typeof http.request)
  vi.spyOn(https, "request").mockImplementation(networkError as typeof https.request)
  vi.spyOn(net, "connect").mockImplementation(networkError as typeof net.connect)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
