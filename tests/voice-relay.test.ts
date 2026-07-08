import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"

jest.mock("@/lib/resolve-user")

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAuthedContext } = require("@/lib/resolve-user")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setVoiceRelayServiceForTests } = require("@/lib/services/voice-relay-service")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setPostCallWorkflowStarterForTests } = require("@/lib/services/post-call-workflow-runner")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VoiceServiceError } = require("@/lib/services")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require("@/lib/api")

const fakeUser = {
  id: "relay-user-1",
  name: "Relay User",
  email: "relay@example.com",
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
    apiKeyId: "relay-key-1",
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

function createMockRelayService() {
  let twilioConfigured = false
  const agents = new Map<string, Record<string, unknown>>()
  const calls = new Map<string, Record<string, unknown>>()
  const phoneNumbers = new Map<string, Record<string, unknown>>()

  return {
    getTwilioConfig: jest.fn(async () => ({
      configured: twilioConfigured,
      providerSource: twilioConfigured ? "user" : "none",
      accountSidPrefix: twilioConfigured ? "AC123456" : undefined,
      defaultFromNumber: twilioConfigured ? "+15555550123" : undefined,
      defaultWebhookBaseUrl: twilioConfigured ? "https://voice.example.com" : undefined,
      deleteTwilioRecordingAfterBlobUpload: false,
      updatedAt: twilioConfigured ? "2024-01-01T00:00:00.000Z" : undefined,
    })),
    upsertTwilioConfig: jest.fn(async (_userId: string, input: Record<string, unknown>) => {
      twilioConfigured = true
      return {
        configured: true,
        providerSource: "user",
        accountSidPrefix: String(input.accountSid).slice(0, 8),
        defaultFromNumber: input.defaultFromNumber,
        defaultWebhookBaseUrl: input.defaultWebhookBaseUrl,
        deleteTwilioRecordingAfterBlobUpload:
          input.deleteTwilioRecordingAfterBlobUpload ?? false,
        updatedAt: "2024-01-01T00:00:00.000Z",
      }
    }),
    deleteTwilioConfig: jest.fn(async () => {
      const wasConfigured = twilioConfigured
      twilioConfigured = false
      return wasConfigured
    }),
    testTwilioConfig: jest.fn(async () => {
      if (!twilioConfigured) {
        throw new VoiceServiceError(
          400,
          "TWILIO_CONFIG_MISSING",
          "No user Twilio config or platform Twilio fallback is configured"
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
        successEvaluationPrompt: input.successEvaluationPrompt,
        webhookUrl: input.webhookUrl,
        webhookTimeoutSeconds: input.webhookTimeoutSeconds,
        webhookSecretConfigured: Boolean(input.webhookSecret),
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
      if (!twilioConfigured) {
        throw new VoiceServiceError(
          400,
          "TWILIO_CONFIG_MISSING",
          "No user Twilio config or platform Twilio fallback is configured"
        )
      }
      const call = {
        id: "call-1",
        provider: VOICE_API_PROVIDER_ID,
        agentId: input.agentId,
        phoneNumberId: input.phoneNumberId,
        toNumber: input.toNumber,
        fromNumber: input.fromNumber ?? "+15555550123",
        status: "ringing",
        twilioCallSid: "CA123",
        twilioAccountSid: "AC123",
        recordingSid: "RE123",
        postCallStatus: "processing",
        callSuccessful: true,
        successEvaluationStatus: "ready",
        successEvaluationReason: "The call was successful.",
        raw: { twilio: { sid: "CA123" } },
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
    downloadRecording: jest.fn(async () => {
      const bytes = new TextEncoder().encode("audio bytes")
      return new File([bytes], "recording.mp3", { type: "audio/mpeg" })
    }),
    listPhoneNumbers: jest.fn(async () => ({
      items: Array.from(phoneNumbers.values()),
      hasMore: false,
    })),
    importPhoneNumbers: jest.fn(async (_userId: string) => {
      const phone = {
        id: "phone-1",
        provider: VOICE_API_PROVIDER_ID,
        number: "+15555550123",
        name: "Support",
        twilioPhoneNumberSid: "PN123",
        twilioAccountSid: "AC123",
        providerOptions: {
          webhook: {
            status: "configured",
            voiceUrl: "https://voice.example.com/api/v1/twilio/voice",
          },
        },
        raw: {},
      }
      phoneNumbers.set(phone.id, phone)
      return { items: [phone], hasMore: false, imported: 1 }
    }),
    getPhoneNumber: jest.fn(async () => null),
    createPhoneNumber: jest.fn(async (_userId: string, input: Record<string, unknown>) => ({
      id: "phone-1",
      provider: VOICE_API_PROVIDER_ID,
      number: input.number,
      inboundAgentId: input.inboundAgentId,
      outboundAgentId: input.outboundAgentId,
      agentId: input.inboundAgentId,
      raw: {},
    })),
    updatePhoneNumber: jest.fn(async () => null),
    deletePhoneNumber: jest.fn(async () => false),
    handleVoiceWebhook: jest.fn(async () =>
      '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="wss://voice.example.com/api/v1/relay/ws?callId=call-1" /></Connect></Response>'
    ),
    handleStatusWebhook: jest.fn(async () => ({ ok: true, matched: true })),
    handleRecordingWebhook: jest.fn(async () => ({
      ok: true,
      matched: true,
      userId: fakeUser.id,
      callId: "call-1",
      recordingSid: "RE123",
      recordingStatus: "completed",
    })),
    markPostCallWorkflowStarted: jest.fn(async () => undefined),
    markPostCallWorkflowFailed: jest.fn(async () => undefined),
    handleRelayMessage: jest.fn(async () => ({ ok: true })),
  }
}

beforeEach(() => {
  authed()
  setVoiceRelayServiceForTests(createMockRelayService())
  setPostCallWorkflowStarterForTests(async (_input: unknown) => ({ runId: "run-1" }))
})

describe("/api/v1 relay routes", () => {
  it("GET /api/v1/agents returns 401 without auth", async () => {
    jest.mocked(resolveAuthedContext).mockResolvedValue(null)
    const res = await handle("/api/v1/agents")
    expect(res.status).toBe(401)
  })

  it("PUT /api/v1/twilio-config stores config without returning secrets", async () => {
    const res = await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
        defaultFromNumber: "+15555550123",
        defaultWebhookBaseUrl: "https://voice.example.com",
        deleteTwilioRecordingAfterBlobUpload: true,
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      configured: true,
      accountSidPrefix: "AC123456",
      deleteTwilioRecordingAfterBlobUpload: true,
    })
    expect(JSON.stringify(body)).not.toContain("secret-token")
  })

  it("POST /api/v1/calls returns Twilio call identifiers", async () => {
    await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
      }),
    })
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      status: "ringing",
      twilioCallSid: "CA123",
      twilioAccountSid: "AC123",
    })
  })

  it("POST /api/v1/calls forwards phoneNumberId with explicit agent", async () => {
    const service = createMockRelayService()
    setVoiceRelayServiceForTests(service as never)
    await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
      }),
    })

    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({
        agentId: "agent-1",
        phoneNumberId: "phone-1",
        toNumber: "+15555550100",
      }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      agentId: "agent-1",
      phoneNumberId: "phone-1",
    })
    expect(service.createCall).toHaveBeenCalledWith(
      fakeUser.id,
      expect.objectContaining({
        agentId: "agent-1",
        phoneNumberId: "phone-1",
      })
    )
  })

  it("POST /api/v1/phone-numbers/import requires auth", async () => {
    jest.mocked(resolveAuthedContext).mockResolvedValue(null)

    const res = await handle("/api/v1/phone-numbers/import", {
      method: "POST",
    })

    expect(res.status).toBe(401)
  })

  it("POST /api/v1/phone-numbers/import returns imported Twilio numbers", async () => {
    const service = createMockRelayService()
    setVoiceRelayServiceForTests(service as never)

    const res = await handle("/api/v1/phone-numbers/import", {
      method: "POST",
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      imported: 1,
      items: [
        expect.objectContaining({
          id: "phone-1",
          number: "+15555550123",
          twilioPhoneNumberSid: "PN123",
        }),
      ],
    })
    expect(service.importPhoneNumbers).toHaveBeenCalledWith(fakeUser.id)
  })

  it("POST /api/v1/agents accepts success evaluation and redacts webhook secret", async () => {
    const res = await handle("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "Support",
        successEvaluationPrompt: "Successful only if a demo is booked.",
        webhookUrl: "https://example.com/webhooks/voice",
        webhookTimeoutSeconds: 5,
        webhookSecret: "secret-token",
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      successEvaluationPrompt: "Successful only if a demo is booked.",
      webhookUrl: "https://example.com/webhooks/voice",
      webhookSecretConfigured: true,
    })
    expect(JSON.stringify(body)).not.toContain("secret-token")
  })

  it("GET /api/v1/calls forwards callSuccessful filter", async () => {
    const service = createMockRelayService()
    setVoiceRelayServiceForTests(service as never)

    const res = await handle("/api/v1/calls?callSuccessful=true")

    expect(res.status).toBe(200)
    expect(service.listCalls as jest.Mock).toHaveBeenCalledWith(
      fakeUser.id,
      expect.objectContaining({ callSuccessful: true })
    )
  })

  it("POST /api/v1/twilio/voice returns ConversationRelay TwiML", async () => {
    const res = await handle("/api/v1/twilio/voice", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        To: "+15555550123",
        From: "+15555550100",
        CallSid: "CA123",
      }).toString(),
    })
    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toContain("<ConversationRelay")
    expect(res.headers.get("content-type")).toContain("text/xml")
  })

  it("POST /api/v1/twilio/voice returns TwiML for known setup errors", async () => {
    const service = createMockRelayService()
    service.handleVoiceWebhook.mockRejectedValue(
      new VoiceServiceError(
        404,
        "PHONE_NUMBER_NOT_FOUND",
        "Phone number not found"
      )
    )
    setVoiceRelayServiceForTests(service as never)

    const res = await handle("/api/v1/twilio/voice", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        To: "+15555550123",
        From: "+15555550100",
        CallSid: "CA123",
      }).toString(),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/xml")
    await expect(res.text()).resolves.toContain("<Say>")
  })

  it("GET /api/v1/calls/:id/recording streams private storage bytes", async () => {
    await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({ accountSid: "AC123456789", authToken: "secret-token" }),
    })
    await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    const res = await handle("/api/v1/calls/call-1/recording")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("audio/mpeg")
    await expect(res.text()).resolves.toBe("audio bytes")
  })

  it("POST /api/v1/twilio/recording starts post-call workflow after metadata", async () => {
    const starter = jest.fn(async (_input: unknown) => ({ runId: "run-recording-1" }))
    setPostCallWorkflowStarterForTests(starter)

    const res = await handle("/api/v1/twilio/recording?callId=call-1", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        RecordingSid: "RE123",
        RecordingStatus: "completed",
      }).toString(),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      matched: true,
      workflowStarted: true,
    })
    expect(starter).toHaveBeenCalledWith({
      userId: fakeUser.id,
      callId: "call-1",
    })
  })

  it("POST /api/v1/calls/:id/post-call/retry restarts post-call workflow", async () => {
    await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({ accountSid: "AC123456789", authToken: "secret-token" }),
    })
    await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    const starter = jest.fn(async (_input: unknown) => ({ runId: "run-retry-1" }))
    setPostCallWorkflowStarterForTests(starter)

    const res = await handle("/api/v1/calls/call-1/post-call/retry", {
      method: "POST",
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ runId: "run-retry-1" })
    expect(starter).toHaveBeenCalledWith({
      userId: fakeUser.id,
      callId: "call-1",
    })
  })
})
