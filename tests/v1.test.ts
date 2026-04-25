import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"

jest.mock("@/lib/resolve-user")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAuthedContext } = require("@/lib/resolve-user")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setVoiceServiceForTests, VoiceServiceError } = require("@/lib/services")
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

function createMockVoiceService() {
  const agents = new Map<string, Record<string, unknown>>()
  const calls = new Map<string, Record<string, unknown>>()
  let livekitConfigured = false

  return {
    getLiveKitConfig: jest.fn(async () => ({
      configured: livekitConfigured,
      providerSource: livekitConfigured ? "user" : "none",
      livekitUrl: livekitConfigured ? "https://example.livekit.cloud" : undefined,
      apiKeyPrefix: livekitConfigured ? "lk_api" : undefined,
      defaultSipOutboundTrunkId: livekitConfigured ? "trunk-1" : undefined,
      updatedAt: livekitConfigured ? new Date("2024-01-01").toISOString() : undefined,
    })),
    upsertLiveKitConfig: jest.fn(async (_userId: string, input: Record<string, unknown>) => {
      livekitConfigured = true
      return {
        configured: true,
        providerSource: "user",
        livekitUrl: input.livekitUrl,
        apiKeyPrefix: String(input.apiKey).slice(0, 6),
        defaultSipOutboundTrunkId: input.defaultSipOutboundTrunkId,
        updatedAt: new Date("2024-01-01").toISOString(),
      }
    }),
    deleteLiveKitConfig: jest.fn(async () => {
      const wasConfigured = livekitConfigured
      livekitConfigured = false
      return wasConfigured
    }),
    testLiveKitConfig: jest.fn(async () => {
      if (!livekitConfigured) {
        throw new VoiceServiceError(
          400,
          "LIVEKIT_CONFIG_MISSING",
          "No user LiveKit config or platform LiveKit fallback is configured"
        )
      }
      return { ok: true, providerSource: "user" }
    }),
    listAgents: jest.fn(async () => ({
      items: Array.from(agents.values()),
      hasMore: false,
    })),
    getAgent: jest.fn(async (_userId: string, id: string) => agents.get(id) ?? null),
    createAgent: jest.fn(async (_userId: string, input: Record<string, unknown>) => {
      const agent = {
        id: "agent-1",
        provider: VOICE_API_PROVIDER_ID,
        name: input.name,
        voice: input.voice,
        model: input.model,
        metadata: input.metadata,
        raw: {},
      }
      agents.set(agent.id, agent)
      return agent
    }),
    updateAgent: jest.fn(async (_userId: string, id: string, input: Record<string, unknown>) => {
      const current = agents.get(id)
      if (!current) return null
      const next = { ...current, ...input }
      agents.set(id, next)
      return next
    }),
    deleteAgent: jest.fn(async (_userId: string, id: string) => agents.delete(id)),
    listCalls: jest.fn(async () => ({
      items: Array.from(calls.values()),
      hasMore: false,
    })),
    getCall: jest.fn(async (_userId: string, id: string) => calls.get(id) ?? null),
    createCall: jest.fn(async (_userId: string, input: Record<string, unknown>) => {
      if (!livekitConfigured) {
        throw new VoiceServiceError(
          400,
          "LIVEKIT_CONFIG_MISSING",
          "No user LiveKit config or platform LiveKit fallback is configured"
        )
      }
      const call = {
        id: "call-1",
        provider: VOICE_API_PROVIDER_ID,
        agentId: input.agentId,
        toNumber: input.toNumber,
        fromNumber: input.fromNumber,
        status: "ringing",
        roomName: "voice-api-call-call-1",
        livekitSipParticipantId: "phone-call-1",
        livekitSipCallId: "sip-call-1",
        livekitSipTrunkId: "trunk-1",
        providerSource: "user",
        metadata: { ...(input.metadata as object), billingProviderSource: "user" },
        events: [
          {
            id: "event-1",
            type: "livekit.sip_participant.created",
            payload: { sipCallId: "sip-call-1" },
            createdAt: new Date("2024-01-01").toISOString(),
          },
        ],
        raw: { livekit: { sipParticipant: { participantIdentity: "phone-call-1" } } },
      }
      calls.set(call.id, call)
      return call
    }),
    updateCall: jest.fn(async (_userId: string, id: string, input: Record<string, unknown>) => {
      const current = calls.get(id)
      if (!current) return null
      const next = { ...current, ...input }
      calls.set(id, next)
      return next
    }),
    deleteCall: jest.fn(async (_userId: string, id: string) => calls.delete(id)),
    listPhoneNumbers: jest.fn(async () => ({ items: [], hasMore: false })),
    getPhoneNumber: jest.fn(async () => null),
    createPhoneNumber: jest.fn(async (_userId: string, input: Record<string, unknown>) => ({
      id: "phone-1",
      provider: VOICE_API_PROVIDER_ID,
      number: input.number,
      name: input.name,
      inboundAgentId: input.inboundAgentId,
      outboundAgentId: input.outboundAgentId,
      agentId: input.inboundAgentId,
      webhookUrl: input.webhookUrl,
      areaCode: input.areaCode,
      raw: {},
    })),
    updatePhoneNumber: jest.fn(async () => null),
    deletePhoneNumber: jest.fn(async () => false),
  }
}

beforeEach(() => {
  authed()
  setVoiceServiceForTests(createMockVoiceService())
})

describe("/api/v1 with mocked auth and voice service", () => {
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

  it("PUT /api/v1/livekit-config stores config without returning secrets", async () => {
    const res = await handle("/api/v1/livekit-config", {
      method: "PUT",
      body: JSON.stringify({
        livekitUrl: "https://example.livekit.cloud",
        apiKey: "lk_api_secret_value",
        apiSecret: "super-secret",
        defaultSipOutboundTrunkId: "trunk-1",
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.configured).toBe(true)
    expect(body.apiKeyPrefix).toBe("lk_api")
    expect(JSON.stringify(body)).not.toContain("super-secret")
    expect(JSON.stringify(body)).not.toContain("lk_api_secret_value")
  })

  it("POST /api/v1/livekit-config/test validates stored config", async () => {
    await handle("/api/v1/livekit-config", {
      method: "PUT",
      body: JSON.stringify({
        livekitUrl: "https://example.livekit.cloud",
        apiKey: "lk_api_secret_value",
        apiSecret: "super-secret",
      }),
    })
    const res = await handle("/api/v1/livekit-config/test", { method: "POST" })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, providerSource: "user" })
  })

  it("POST /api/v1/calls with invalid body is rejected by server validation", async () => {
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it("POST /api/v1/calls fails clearly when LiveKit config is missing", async () => {
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("LIVEKIT_CONFIG_MISSING")
  })

  it("POST /api/v1/calls returns LiveKit call identifiers and embedded events", async () => {
    await handle("/api/v1/livekit-config", {
      method: "PUT",
      body: JSON.stringify({
        livekitUrl: "https://example.livekit.cloud",
        apiKey: "lk_api_secret_value",
        apiSecret: "super-secret",
        defaultSipOutboundTrunkId: "trunk-1",
      }),
    })
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      toNumber?: string
      status: string
      livekitSipCallId?: string
      events?: unknown[]
    }
    expect(body.toNumber).toBe("+15555550100")
    expect(body.status).toBe("ringing")
    expect(body.livekitSipCallId).toBe("sip-call-1")
    expect(body.events).toHaveLength(1)
  })
})
