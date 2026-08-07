import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/auth/**/*.ts",
        "src/lib/permissions.ts",
        "src/app/api/barbershops/**/route.ts",
        "src/app/api/professionals/**/route.ts",
        "src/app/api/upload/route.ts",
        "src/app/api/dashboard/summary/route.ts",
        "src/app/api/register/route.ts",
      ],
    },
  },
})
