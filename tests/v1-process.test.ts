import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"

jest.mock("@/lib/resolve-user")
jest.mock("livekit-server-sdk", () => ({
  RoomServiceClient: jest.fn(),
  SipClient: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAuthedContext } = require("@/lib/resolve-user")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createVoiceService } = require("@/lib/services/voice-service")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setVoiceServiceForTests } = require("@/lib/services")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { liveKitAdapter } = require("@/lib/services/livekit-adapter")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require("@/lib/api")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RoomServiceClient, SipClient } = require("livekit-server-sdk")

const fakeUser = {
  id: "jest-user-1",
  name: "Jest User",
  email: "jest@example.com",
  emailVerified: true,
  image: null as string | null,
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2020-01-01"),
}

type AsyncMock = (...args: unknown[]) => Promise<unknown>

function mockAsync(implementation?: (...args: unknown[]) => Promise<unknown>) {
  return jest.fn(
    implementation ?? (async () => undefined)
  ) as jest.MockedFunction<AsyncMock>
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
  authed()
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

function createProcessRepo() {
  const livekitConfigs = new Map<string, Record<string, unknown>>()
  const agents = new Map<string, Record<string, unknown>>()
  const calls = new Map<string, Record<string, unknown>>()
  const phones = new Map<string, Record<string, unknown>>()
  const events = new Map<string, Record<string, unknown>[]>()

  return {
    stores: { livekitConfigs, agents, calls, phones, events },
    repo: {
      getLiveKitConfig: mockAsync(async (userId) => {
        const row = livekitConfigs.get(String(userId))
        if (!row) return { configured: false, providerSource: "none" }
        return {
          configured: true,
          providerSource: "user",
          livekitUrl: row.livekitUrl,
          apiKeyPrefix: String(row.apiKey).slice(0, 6),
          defaultSipOutboundTrunkId: row.defaultSipOutboundTrunkId,
          updatedAt: row.updatedAt,
        }
      }),
      upsertLiveKitConfig: mockAsync(async (userId, input) => {
        const row: Record<string, unknown> = {
          ...(input as Record<string, unknown>),
          updatedAt: "2024-01-01T00:00:00.000Z",
        }
        livekitConfigs.set(String(userId), row)
        return {
          configured: true,
          providerSource: "user",
          livekitUrl: row.livekitUrl,
          apiKeyPrefix: String(row.apiKey).slice(0, 6),
          defaultSipOutboundTrunkId: row.defaultSipOutboundTrunkId,
          updatedAt: row.updatedAt,
        }
      }),
      deleteLiveKitConfig: mockAsync(async (userId) =>
        livekitConfigs.delete(String(userId))
      ),
      resolveLiveKitCredentials: mockAsync(async (userId) => {
        const row = livekitConfigs.get(String(userId))
        if (!row) return null
        return {
          url: row.livekitUrl,
          apiKey: row.apiKey,
          apiSecret: row.apiSecret,
          defaultSipOutboundTrunkId: row.defaultSipOutboundTrunkId,
          source: "user",
        }
      }),
      createAgent: mockAsync(async (userId, input) => {
        const row = {
          id: "agent-1",
          userId,
          provider: VOICE_API_PROVIDER_ID,
          ...(input as Record<string, unknown>),
        }
        agents.set(row.id, row)
        return row
      }),
      listAgents: mockAsync(async () => ({
        items: Array.from(agents.values()),
        hasMore: false,
      })),
      getAgent: mockAsync(async (_userId, id) => agents.get(String(id)) ?? null),
      updateAgent: mockAsync(async (_userId, id, input) => {
        const current = agents.get(String(id))
        if (!current) return null
        const next = { ...current, ...(input as Record<string, unknown>) }
        agents.set(String(id), next)
        return next
      }),
      deleteAgent: mockAsync(async (_userId, id) => agents.delete(String(id))),
      createCall: mockAsync(async (userId, input) => {
        const row: Record<string, unknown> = {
          provider: VOICE_API_PROVIDER_ID,
          ...(input as Record<string, unknown>),
          userId,
        }
        calls.set(String(row.id), row)
        return {
          id: row.id,
          provider: VOICE_API_PROVIDER_ID,
          agentId: row.agentId,
          toNumber: row.toNumber,
          fromNumber: row.fromNumber,
          status: row.status,
          roomName: row.livekitRoomName,
          metadata: row.metadata,
          raw: row.raw,
        }
      }),
      listCalls: mockAsync(async () => ({
        items: Array.from(calls.values()),
        hasMore: false,
      })),
      getCall: mockAsync(async (_userId, id) => {
        const row = calls.get(String(id))
        if (!row) return null
        return {
          ...row,
          events: events.get(String(id)) ?? [],
        }
      }),
      updateCall: mockAsync(async (_userId, id, input) => {
        const current = calls.get(String(id))
        if (!current) return null
        const next = { ...current, ...(input as Record<string, unknown>) }
        calls.set(String(id), next)
        return {
          id,
          provider: VOICE_API_PROVIDER_ID,
          agentId: next.agentId,
          toNumber: next.toNumber,
          fromNumber: next.fromNumber,
          status: next.status,
          roomName: next.livekitRoomName,
          livekitSipParticipantId: next.livekitSipParticipantId,
          livekitSipCallId: next.livekitSipCallId,
          livekitSipTrunkId: next.livekitSipTrunkId,
          providerSource: next.providerSource,
          metadata: next.metadata,
          raw: next.raw,
          events: events.get(String(id)) ?? [],
        }
      }),
      deleteCall: mockAsync(async (_userId, id) => calls.delete(String(id))),
      addCallEvent: mockAsync(async (_userId, callId, type, payload) => {
        const event = {
          id: `${type}-event`,
          type,
          payload,
          createdAt: "2024-01-01T00:00:00.000Z",
        }
        const callEvents = events.get(String(callId)) ?? []
        callEvents.push(event)
        events.set(String(callId), callEvents)
        return event
      }),
      createPhoneNumber: mockAsync(async (userId, input) => {
        const row: Record<string, unknown> = {
          id: "phone-1",
          userId,
          provider: VOICE_API_PROVIDER_ID,
          ...(input as Record<string, unknown>),
        }
        phones.set(String(row.id), row)
        return {
          ...row,
          agentId: row.inboundAgentId,
        }
      }),
      listPhoneNumbers: mockAsync(async () => ({
        items: Array.from(phones.values()),
        hasMore: false,
      })),
      getPhoneNumber: mockAsync(async (_userId, id) => phones.get(String(id)) ?? null),
      updatePhoneNumber: mockAsync(async (_userId, id, input) => {
        const current = phones.get(String(id))
        if (!current) return null
        const next = { ...current, ...(input as Record<string, unknown>) }
        phones.set(String(id), next)
        return next
      }),
      deletePhoneNumber: mockAsync(async (_userId, id) =>
        phones.delete(String(id))
      ),
    },
  }
}

function setLiveKitSdkMocks() {
  const roomService = {
    listRooms: jest.fn(async () => []),
    createRoom: jest.fn(async (input: Record<string, unknown>) => ({
      sid: "room-sid-1",
      name: input.name,
    })),
  }
  const sipService = {
    createSipParticipant: jest.fn(async (...args: unknown[]) => {
      void args
      return {
        participantIdentity: "phone-call-1",
        attributes: {
          "sip.callID": "sip-call-1",
          "sip.callStatus": "dialing",
        },
      }
    }),
  }
  jest.mocked(RoomServiceClient).mockImplementation(() => roomService)
  jest.mocked(SipClient).mockImplementation(() => sipService)
  return { roomService, sipService }
}

beforeEach(() => {
  authed()
  jest.mocked(RoomServiceClient).mockReset()
  jest.mocked(SipClient).mockReset()
})

describe("/api/v1 endpoint process tests", () => {
  it("POST /api/v1/agents returns 200 and writes the expected database values", async () => {
    const { repo, stores } = createProcessRepo()
    setVoiceServiceForTests(createVoiceService(repo as never, liveKitAdapter))

    const res = await handle("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "Support",
        voice: { voiceId: "alloy", provider: "openai" },
        model: { provider: "openai", model: "gpt-4.1-mini" },
        firstMessage: "Hello",
        maxDurationSeconds: 300,
        webhookUrl: "https://example.com/webhook",
        metadata: { team: "sales" },
        providerOptions: { temperature: 0.3 },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      id: "agent-1",
      provider: VOICE_API_PROVIDER_ID,
      name: "Support",
      firstMessage: "Hello",
    })
    expect(repo.createAgent).toHaveBeenCalledWith(fakeUser.id, {
      name: "Support",
      voice: { voiceId: "alloy", provider: "openai" },
      model: { provider: "openai", model: "gpt-4.1-mini" },
      firstMessage: "Hello",
      maxDurationSeconds: 300,
      backgroundSound: undefined,
      voicemailMessage: undefined,
      webhookUrl: "https://example.com/webhook",
      webhookTimeoutSeconds: undefined,
      metadata: { team: "sales" },
      providerOptions: { temperature: 0.3 },
      raw: {},
    })
    expect(stores.agents.get("agent-1")).toMatchObject({
      userId: fakeUser.id,
      name: "Support",
      metadata: { team: "sales" },
      providerOptions: { temperature: 0.3 },
    })
    expect(RoomServiceClient).not.toHaveBeenCalled()
    expect(SipClient).not.toHaveBeenCalled()
  })

  it("PUT /api/v1/livekit-config returns redacted config and stores expected database values", async () => {
    const { repo, stores } = createProcessRepo()
    setVoiceServiceForTests(createVoiceService(repo as never, liveKitAdapter))

    const res = await handle("/api/v1/livekit-config", {
      method: "PUT",
      body: JSON.stringify({
        livekitUrl: "https://tenant.livekit.cloud",
        apiKey: "lk_api_secret_value",
        apiSecret: "lk_secret_value",
        defaultSipOutboundTrunkId: "trunk-1",
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toEqual({
      configured: true,
      providerSource: "user",
      livekitUrl: "https://tenant.livekit.cloud",
      apiKeyPrefix: "lk_api",
      defaultSipOutboundTrunkId: "trunk-1",
      updatedAt: "2024-01-01T00:00:00.000Z",
    })
    expect(JSON.stringify(body)).not.toContain("lk_secret_value")
    expect(repo.upsertLiveKitConfig).toHaveBeenCalledWith(fakeUser.id, {
      livekitUrl: "https://tenant.livekit.cloud",
      apiKey: "lk_api_secret_value",
      apiSecret: "lk_secret_value",
      defaultSipOutboundTrunkId: "trunk-1",
    })
    expect(stores.livekitConfigs.get(fakeUser.id)).toMatchObject({
      livekitUrl: "https://tenant.livekit.cloud",
      apiKey: "lk_api_secret_value",
      apiSecret: "lk_secret_value",
      defaultSipOutboundTrunkId: "trunk-1",
    })
  })

  it("POST /api/v1/livekit-config/test calls the mocked real LiveKit SDK", async () => {
    const { repo } = createProcessRepo()
    const { roomService } = setLiveKitSdkMocks()
    setVoiceServiceForTests(createVoiceService(repo as never, liveKitAdapter))

    await handle("/api/v1/livekit-config", {
      method: "PUT",
      body: JSON.stringify({
        livekitUrl: "https://tenant.livekit.cloud",
        apiKey: "lk_api_secret_value",
        apiSecret: "lk_secret_value",
      }),
    })
    const res = await handle("/api/v1/livekit-config/test", { method: "POST" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      providerSource: "user",
    })
    expect(RoomServiceClient).toHaveBeenCalledWith(
      "https://tenant.livekit.cloud",
      "lk_api_secret_value",
      "lk_secret_value"
    )
    expect(roomService.listRooms).toHaveBeenCalled()
  })

  it("POST /api/v1/calls returns call data, writes DB values, and calls LiveKit SDK with expected params", async () => {
    const { repo, stores } = createProcessRepo()
    const { roomService, sipService } = setLiveKitSdkMocks()
    setVoiceServiceForTests(createVoiceService(repo as never, liveKitAdapter))

    await handle("/api/v1/livekit-config", {
      method: "PUT",
      body: JSON.stringify({
        livekitUrl: "https://tenant.livekit.cloud",
        apiKey: "lk_api_secret_value",
        apiSecret: "lk_secret_value",
        defaultSipOutboundTrunkId: "trunk-default",
      }),
    })
    await handle("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Support" }),
    })

    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-1",
        toNumber: "+15555550100",
        fromNumber: "+15555550999",
        metadata: { leadId: "lead-1" },
        providerOptions: {
          roomName: "custom-room",
          sipTrunkId: "trunk-override",
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      provider: VOICE_API_PROVIDER_ID,
      agentId: "agent-1",
      toNumber: "+15555550100",
      status: "ringing",
      roomName: "custom-room",
      livekitSipParticipantId: "phone-call-1",
      livekitSipCallId: "sip-call-1",
      livekitSipTrunkId: "trunk-override",
      providerSource: "user",
      metadata: { leadId: "lead-1", billingProviderSource: "user" },
    })
    expect(repo.createCall).toHaveBeenCalledWith(fakeUser.id, {
      id: expect.any(String),
      userId: fakeUser.id,
      agentId: "agent-1",
      direction: "outbound",
      status: "queued",
      toNumber: "+15555550100",
      fromNumber: "+15555550999",
      livekitRoomName: "custom-room",
      providerSource: "user",
      metadata: { leadId: "lead-1" },
      providerOptions: {
        roomName: "custom-room",
        sipTrunkId: "trunk-override",
      },
      raw: {},
    })
    expect(RoomServiceClient).toHaveBeenCalledWith(
      "https://tenant.livekit.cloud",
      "lk_api_secret_value",
      "lk_secret_value"
    )
    expect(roomService.createRoom).toHaveBeenCalledWith({ name: "custom-room" })
    expect(SipClient).toHaveBeenCalledWith(
      "https://tenant.livekit.cloud",
      "lk_api_secret_value",
      "lk_secret_value"
    )
    expect(sipService.createSipParticipant).toHaveBeenCalledWith(
      "trunk-override",
      "+15555550100",
      "custom-room",
      {
        participantIdentity: `phone-${body.id}`,
        participantName: "+15555550100",
        waitUntilAnswered: false,
      }
    )
    expect(repo.updateCall).toHaveBeenCalledWith(fakeUser.id, body.id, {
      status: "ringing",
      startedAt: expect.any(Date),
      livekitSipParticipantId: "phone-call-1",
      livekitSipCallId: "sip-call-1",
      livekitSipTrunkId: "trunk-override",
      providerSource: "user",
      metadata: { leadId: "lead-1", billingProviderSource: "user" },
      raw: {
        livekit: {
          room: { sid: "room-sid-1", name: "custom-room" },
          sipParticipant: {
            participantIdentity: "phone-call-1",
            attributes: {
              "sip.callID": "sip-call-1",
              "sip.callStatus": "dialing",
            },
          },
        },
      },
    })
    expect(stores.calls.get(String(body.id))).toMatchObject({
      status: "ringing",
      livekitSipParticipantId: "phone-call-1",
      livekitSipCallId: "sip-call-1",
      livekitSipTrunkId: "trunk-override",
      providerSource: "user",
    })
    expect(stores.events.get(String(body.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "call.queued" }),
        expect.objectContaining({ type: "livekit.room.created" }),
        expect.objectContaining({ type: "livekit.sip_participant.created" }),
      ])
    )
  })

  it("POST /api/v1/phone-numbers returns 200 and writes SIP trunk metadata to the database", async () => {
    const { repo, stores } = createProcessRepo()
    setVoiceServiceForTests(createVoiceService(repo as never, liveKitAdapter))

    const res = await handle("/api/v1/phone-numbers", {
      method: "POST",
      body: JSON.stringify({
        number: "+15555550123",
        name: "Main line",
        inboundAgentId: "agent-in",
        outboundAgentId: "agent-out",
        webhookUrl: "https://example.com/phone-webhook",
        areaCode: "555",
        providerOptions: {
          livekitSipInboundTrunkId: "inbound-trunk",
          livekitSipOutboundTrunkId: "outbound-trunk",
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      id: "phone-1",
      provider: VOICE_API_PROVIDER_ID,
      number: "+15555550123",
      name: "Main line",
      inboundAgentId: "agent-in",
      outboundAgentId: "agent-out",
    })
    expect(repo.createPhoneNumber).toHaveBeenCalledWith(fakeUser.id, {
      name: "Main line",
      inboundAgentId: "agent-in",
      outboundAgentId: "agent-out",
      webhookUrl: "https://example.com/phone-webhook",
      areaCode: "555",
      number: "+15555550123",
      livekitSipInboundTrunkId: "inbound-trunk",
      livekitSipOutboundTrunkId: "outbound-trunk",
      providerOptions: {
        livekitSipInboundTrunkId: "inbound-trunk",
        livekitSipOutboundTrunkId: "outbound-trunk",
      },
      raw: {},
    })
    expect(stores.phones.get("phone-1")).toMatchObject({
      userId: fakeUser.id,
      livekitSipInboundTrunkId: "inbound-trunk",
      livekitSipOutboundTrunkId: "outbound-trunk",
    })
  })
})
