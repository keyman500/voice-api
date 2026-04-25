/**
 * Jest setup — avoid failing imports when the app (or better-auth) reads env.
 */
process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/voice_api_test"
process.env.BETTER_AUTH_SECRET ??= "0".repeat(32)
process.env.BETTER_AUTH_URL ??= "http://localhost:3000"

import { jest } from "@jest/globals"

/** Use `lib/__mocks__/auth.ts` so Jest does not load the `better-auth` ESM tree. */
jest.mock("@/lib/auth")
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { auth } = require("@/lib/auth") as any
auth.api.getSession.mockResolvedValue(null)
auth.api.verifyApiKey.mockResolvedValue({ valid: false, key: null, error: null })
