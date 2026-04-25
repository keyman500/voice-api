import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"

/**
 * ESM `import` runs before `jest.mock` can apply. Load the app and mocked
 * `resolveAuthedContext` with `require` after the mock.
 */
jest.mock("@/lib/resolve-user")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAuthedContext } = require("@/lib/resolve-user")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require("@/lib/api")

const fakeUser = {
  id: "jest-user-1",
  name: "Jest User",
  email: "jest@example.com",
  emailVerified: true,
  image: null as string | null,
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2020-01-01"),
}

function authed() {
  jest.mocked(resolveAuthedContext).mockResolvedValue({
    user: fakeUser,
    session: null,
    authMethod: "apiKey",
    apiKeyId: "jest-key-1",
  })
}

function handle(path: string, init?: RequestInit) {
  return app.handle(
    new Request(new URL(path, "http://localhost"), {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake",
        ...init?.headers,
      },
    })
  )
}

beforeEach(() => {
  authed()
})

describe("/api/v1 with mocked auth", () => {
  it("GET /api/v1/agents returns paginated list", async () => {
    const res = await handle("/api/v1/agents")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: unknown[]
      hasMore: boolean
    }
    expect(Array.isArray(body.items)).toBe(true)
    expect(typeof body.hasMore).toBe("boolean")
  })

  it("POST /api/v1/agents creates an agent with provider id", async () => {
    const res = await handle("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Test agent" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; provider: string; name?: string }
    expect(body.id).toBeDefined()
    expect(body.provider).toBe(VOICE_API_PROVIDER_ID)
    expect(body.name).toBe("Test agent")
  })

  it("POST /api/v1/calls with invalid body is rejected (server-side validation)", async () => {
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it("POST /api/v1/calls with valid body succeeds", async () => {
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { toNumber?: string; status: string }
    expect(body.toNumber).toBe("+15555550100")
  })
})
