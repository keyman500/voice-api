import { beforeEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => [
            {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              emailVerified: true,
              image: null,
              createdAt: new Date("2024-01-01T00:00:00.000Z"),
              updatedAt: new Date("2024-01-01T00:00:00.000Z"),
            },
          ]),
        })),
      })),
    })),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require("@/lib/auth")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAuthedContext } = require("@/lib/resolve-user")

const userRow = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
}

beforeEach(() => {
  jest.clearAllMocks()
  auth.api.getSession.mockResolvedValue(null)
  auth.api.verifyApiKey.mockResolvedValue({
    valid: false,
    key: null,
    error: null,
  })
})

describe("resolveAuthedContext", () => {
  it("returns a session context when Better Auth has a session", async () => {
    auth.api.getSession.mockResolvedValue({
      user: userRow,
      session: { id: "session-1", userId: userRow.id },
    })

    const ctx = await resolveAuthedContext(new Headers())

    expect(ctx).toMatchObject({
      user: userRow,
      authMethod: "session",
      apiKeyId: null,
    })
    expect(auth.api.verifyApiKey).not.toHaveBeenCalled()
  })

  it("accepts Authorization Bearer API keys", async () => {
    auth.api.verifyApiKey.mockResolvedValue({
      valid: true,
      key: { id: "key-1", referenceId: userRow.id },
      error: null,
    })

    const ctx = await resolveAuthedContext(
      new Headers({ authorization: "Bearer voice_secret" })
    )

    expect(auth.api.verifyApiKey).toHaveBeenCalledWith({
      body: { key: "voice_secret" },
    })
    expect(ctx).toMatchObject({
      user: expect.objectContaining({ id: userRow.id }),
      authMethod: "apiKey",
      apiKeyId: "key-1",
    })
  })

  it("accepts Better Auth x-api-key headers", async () => {
    auth.api.verifyApiKey.mockResolvedValue({
      valid: true,
      key: { id: "key-2", referenceId: userRow.id },
      error: null,
    })

    const ctx = await resolveAuthedContext(
      new Headers({ "x-api-key": "voice_x_secret" })
    )

    expect(auth.api.verifyApiKey).toHaveBeenCalledWith({
      body: { key: "voice_x_secret" },
    })
    expect(ctx).toMatchObject({
      authMethod: "apiKey",
      apiKeyId: "key-2",
    })
  })

  it("returns null for invalid API keys", async () => {
    const ctx = await resolveAuthedContext(
      new Headers({ "x-api-key": "not-valid" })
    )

    expect(ctx).toBeNull()
  })
})
