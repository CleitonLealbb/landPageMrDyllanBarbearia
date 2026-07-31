import { expect } from "vitest"

const sensitiveKeys = new Set([
  "password",
  "sessionVersion",
  "resetToken",
  "resetExpires",
  "inviteToken",
  "inviteExpires",
  "hash",
  "jwt",
  "secret",
  "apiKey",
  "apiSecret",
])

export async function expectJson(response: Response, status: number) {
  expect(response.status).toBe(status)
  return response.json() as Promise<unknown>
}

export function expectNoSensitiveData(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoSensitiveData)
    return
  }

  if (!value || typeof value !== "object") return

  for (const [key, child] of Object.entries(value)) {
    expect(sensitiveKeys.has(key)).toBe(false)
    expectNoSensitiveData(child)
  }
}

export function jsonRequest(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown
) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
