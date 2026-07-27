import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"

jest.mock("@/lib/resolve-user")

/* eslint-disable @typescript-eslint/no-require-imports */
const { resolveAuthedContext } = require("@/lib/resolve-user")
const {
  setVoiceRelayServiceForTests,
} = require("@/lib/services/voice-relay-service")
const {
  setPostCallWorkflowStarterForTests,
} = require("@/lib/services/post-call-workflow-runner")
const { VoiceServiceError } = require("@/lib/services")
const { setBillingServiceForTests } = require("@/lib/services/billing")
const { app } = require("@/lib/api")
/* eslint-enable @typescript-eslint/no-require-imports */

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
  let telnyxConfigured = false
  const agents = new Map<string, Record<string, unknown>>()
  const calls = new Map<string, Record<string, unknown>>()
  const phoneNumbers = new Map<string, Record<string, unknown>>()

  return {
    getTwilioConfig: jest.fn(async () => ({
      configured: twilioConfigured,
      providerSource: twilioConfigured ? "user" : "none",
      accountSidPrefix: twilioConfigured ? "AC123456" : undefined,
      defaultFromNumber: twilioConfigured ? "+15555550123" : undefined,
      defaultWebhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL,
      deleteTwilioRecordingAfterBlobUpload: false,
      updatedAt: twilioConfigured ? "2024-01-01T00:00:00.000Z" : undefined,
    })),
    upsertTwilioConfig: jest.fn(
      async (_userId: string, input: Record<string, unknown>) => {
        twilioConfigured = true
        return {
          configured: true,
          providerSource: "user",
          accountSidPrefix: String(input.accountSid).slice(0, 8),
          defaultFromNumber: input.defaultFromNumber,
          defaultWebhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL,
          deleteTwilioRecordingAfterBlobUpload:
            input.deleteTwilioRecordingAfterBlobUpload ?? false,
          updatedAt: "2024-01-01T00:00:00.000Z",
        }
      }
    ),
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
    getTelnyxConfig: jest.fn(async () => ({
      configured: telnyxConfigured,
      providerSource: telnyxConfigured ? "user" : "none",
      accountSidPrefix: telnyxConfigured ? "acct_tel" : undefined,
      applicationSidPrefix: telnyxConfigured ? "app_teln" : undefined,
      apiKeyPrefix: telnyxConfigured ? "KEY12345" : undefined,
      publicKeyConfigured: false,
      defaultFromNumber: telnyxConfigured ? "+15555550155" : undefined,
      defaultWebhookBaseUrl: process.env.TELNYX_WEBHOOK_BASE_URL,
      deleteTelnyxRecordingAfterBlobUpload: false,
      updatedAt: telnyxConfigured ? "2024-01-01T00:00:00.000Z" : undefined,
    })),
    upsertTelnyxConfig: jest.fn(
      async (_userId: string, input: Record<string, unknown>) => {
        telnyxConfigured = true
        return {
          configured: true,
          providerSource: "user",
          accountSidPrefix: String(input.accountSid).slice(0, 8),
          applicationSidPrefix: String(input.applicationSid).slice(0, 8),
          apiKeyPrefix: String(input.apiKey).slice(0, 8),
          publicKeyConfigured: Boolean(input.publicKey),
          defaultFromNumber: input.defaultFromNumber,
          defaultWebhookBaseUrl: process.env.TELNYX_WEBHOOK_BASE_URL,
          deleteTelnyxRecordingAfterBlobUpload:
            input.deleteTelnyxRecordingAfterBlobUpload ?? false,
          updatedAt: "2024-01-01T00:00:00.000Z",
        }
      }
    ),
    deleteTelnyxConfig: jest.fn(async () => {
      const wasConfigured = telnyxConfigured
      telnyxConfigured = false
      return wasConfigured
    }),
    testTelnyxConfig: jest.fn(async () => {
      if (!telnyxConfigured) {
        throw new VoiceServiceError(
          400,
          "TELNYX_CONFIG_MISSING",
          "No user Telnyx config or platform Telnyx fallback is configured"
        )
      }
      return { ok: true, providerSource: "user" }
    }),
    listAgents: jest.fn(async () => ({
      items: Array.from(agents.values()),
      hasMore: false,
    })),
    getAgent: jest.fn(
      async (_userId: string, id: string) => agents.get(id) ?? null
    ),
    createAgent: jest.fn(
      async (_userId: string, input: Record<string, unknown>) => {
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
      }
    ),
    updateAgent: jest.fn(
      async (_userId: string, id: string, input: Record<string, unknown>) => {
        const current = agents.get(id)
        if (!current) return null
        const next = { ...current, ...input }
        agents.set(id, next)
        return next
      }
    ),
    deleteAgent: jest.fn(async (_userId: string, id: string) =>
      agents.delete(id)
    ),
    listCalls: jest.fn(async () => ({
      items: Array.from(calls.values()),
      hasMore: false,
    })),
    getCall: jest.fn(
      async (_userId: string, id: string) => calls.get(id) ?? null
    ),
    createCall: jest.fn(
      async (_userId: string, input: Record<string, unknown>) => {
        const wantsTelnyx =
          input.providerOptions &&
          typeof input.providerOptions === "object" &&
          (input.providerOptions as Record<string, unknown>)
            .telephonyProvider === "telnyx"
        if (wantsTelnyx || (telnyxConfigured && !twilioConfigured)) {
          if (!telnyxConfigured) {
            throw new VoiceServiceError(
              400,
              "TELNYX_CONFIG_MISSING",
              "No user Telnyx config or platform Telnyx fallback is configured"
            )
          }
          const call = {
            id: "call-1",
            provider: VOICE_API_PROVIDER_ID,
            agentId: input.agentId,
            phoneNumberId: input.phoneNumberId,
            toNumber: input.toNumber,
            fromNumber: input.fromNumber ?? "+15555550155",
            status: "ringing",
            telnyxCallSid: "v3:telnyx-call-1",
            telnyxAccountSid: "acct_telnyx_1",
            telephonyProvider: "telnyx",
            recordingSid: "rec_telnyx_1",
            postCallStatus: "processing",
            callSuccessful: true,
            successEvaluationStatus: "ready",
            successEvaluationReason: "The call was successful.",
            billing: {
              status: "ready",
              runtimeCredits: 2,
              agentCredits: 0.25,
              postCallCredits: 0.05,
              totalCredits: 2.3,
              creditsRemaining: 997.7,
              estimatedOverageCredits: 0,
            },
            raw: { telnyx: { sid: "v3:telnyx-call-1" } },
          }
          calls.set(call.id, call)
          return call
        }
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
          telephonyProvider: "twilio",
          recordingSid: "RE123",
          postCallStatus: "processing",
          callSuccessful: true,
          successEvaluationStatus: "ready",
          successEvaluationReason: "The call was successful.",
          billing: {
            status: "ready",
            runtimeCredits: 2,
            agentCredits: 0.25,
            postCallCredits: 0.05,
            totalCredits: 2.3,
            creditsRemaining: 997.7,
            estimatedOverageCredits: 0,
          },
          raw: { twilio: { sid: "CA123" } },
        }
        calls.set(call.id, call)
        return call
      }
    ),
    updateCall: jest.fn(
      async (_userId: string, id: string, input: Record<string, unknown>) => {
        const current = calls.get(id)
        if (!current) return null
        const next = { ...current, ...input }
        calls.set(id, next)
        return next
      }
    ),
    deleteCall: jest.fn(async (_userId: string, id: string) =>
      calls.delete(id)
    ),
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
    createPhoneNumber: jest.fn(
      async (_userId: string, input: Record<string, unknown>) => ({
        id: "phone-1",
        provider: VOICE_API_PROVIDER_ID,
        number: input.number,
        inboundAgentId: input.inboundAgentId,
        outboundAgentId: input.outboundAgentId,
        agentId: input.inboundAgentId,
        raw: {},
      })
    ),
    updatePhoneNumber: jest.fn(async () => null),
    deletePhoneNumber: jest.fn(async () => false),
    handleVoiceWebhook: jest.fn(
      async () =>
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

function createMockBillingService() {
  const plans = {
    starter: {
      id: "starter",
      name: "Starter",
      priceUsd: 29,
      includedCredits: 1000,
      productEnv: "POLAR_STARTER_PRODUCT_ID",
    },
    pro: {
      id: "pro",
      name: "Pro",
      priceUsd: 99,
      includedCredits: 5000,
      productEnv: "POLAR_PRO_PRODUCT_ID",
    },
  }
  return {
    plans,
    modelPricing: jest.fn(() => ({
      eventName: "voice_credit_usage",
      creditUsd: 0.01,
      aiMarkup: 1.5,
      runtimeCreditsPerStartedMinute: 1,
      models: [
        {
          model: "openai/gpt-4o-mini",
          inputUsdPerToken: 0.00000015,
          outputUsdPerToken: 0.0000006,
          source: "ai-gateway",
          inputCreditsPer1kTokens: 0.0225,
          outputCreditsPer1kTokens: 0.09,
        },
      ],
    })),
    status: jest.fn(async () => ({
      configured: true,
      active: true,
      plan: {
        id: "starter",
        name: "Starter",
        includedCredits: 1000,
        priceUsd: 29,
        subscriptionStatus: "active",
      },
      plans,
      credits: {
        used: 125,
        credited: 1000,
        balance: 875,
        estimatedOverageCredits: 0,
      },
      recentUsage: [],
    })),
    assertCanStartCall: jest.fn(async () => true),
    checkout: jest.fn(async (_userId: string, plan: string) => ({
      url: `https://polar.example/checkout/${plan}`,
      plan,
    })),
    portal: jest.fn(async () => ({ url: "https://polar.example/portal" })),
    callUsage: jest.fn(async () => ({
      status: "ready",
      runtimeCredits: 2,
      agentCredits: 0.25,
      postCallCredits: 0.05,
      totalCredits: 2.3,
      creditsRemaining: 997.7,
      estimatedOverageCredits: 0,
    })),
    recordUsage: jest.fn(async (input: unknown) => input),
  }
}

beforeEach(() => {
  authed()
  setVoiceRelayServiceForTests(createMockRelayService())
  setBillingServiceForTests(createMockBillingService() as never)
  setPostCallWorkflowStarterForTests(async (_input: unknown) => ({
    runId: "run-1",
  }))
})

describe("/api/v1 relay routes", () => {
  it("GET /api/v1/agents returns 401 without auth", async () => {
    jest.mocked(resolveAuthedContext).mockResolvedValue(null)
    const res = await handle("/api/v1/agents")
    expect(res.status).toBe(401)
  })

  it("GET /api/v1/billing/status requires auth", async () => {
    jest.mocked(resolveAuthedContext).mockResolvedValue(null)
    const res = await handle("/api/v1/billing/status")
    expect(res.status).toBe(401)
  })

  it("GET /api/v1/billing/status returns plan and credit fields", async () => {
    const res = await handle("/api/v1/billing/status")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      active: true,
      plan: { id: "starter", includedCredits: 1000 },
      credits: { used: 125, credited: 1000, balance: 875 },
    })
  })

  it("POST /api/v1/billing/checkout returns a Polar checkout URL", async () => {
    const res = await handle("/api/v1/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "pro" }),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      url: "https://polar.example/checkout/pro",
      plan: "pro",
    })
  })

  it("POST /api/v1/billing/portal returns a Polar portal URL", async () => {
    const res = await handle("/api/v1/billing/portal", { method: "POST" })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      url: "https://polar.example/portal",
    })
  })

  it("GET /api/v1/billing/model-pricing returns credit rates", async () => {
    const res = await handle("/api/v1/billing/model-pricing")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      eventName: "voice_credit_usage",
      creditUsd: 0.01,
      runtimeCreditsPerStartedMinute: 1,
    })
    expect(body.models[0]).toMatchObject({ model: "openai/gpt-4o-mini" })
  })

  it("PUT /api/v1/twilio-config stores config without returning secrets", async () => {
    const res = await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
        defaultFromNumber: "+15555550123",
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

  it("PUT /api/v1/telnyx-config stores config without returning secrets", async () => {
    const res = await handle("/api/v1/telnyx-config", {
      method: "PUT",
      body: JSON.stringify({
        apiKey: "KEY-secret-token",
        publicKey: "public-secret",
        accountSid: "acct_telnyx_1",
        applicationSid: "app_telnyx_1",
        defaultFromNumber: "+15555550155",
        deleteTelnyxRecordingAfterBlobUpload: true,
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      configured: true,
      accountSidPrefix: "acct_tel",
      applicationSidPrefix: "app_teln",
      apiKeyPrefix: "KEY-secr",
      publicKeyConfigured: true,
      deleteTelnyxRecordingAfterBlobUpload: true,
    })
    expect(JSON.stringify(body)).not.toContain("KEY-secret-token")
    expect(JSON.stringify(body)).not.toContain("public-secret")
  })

  it("POST /api/v1/calls returns Telnyx call identifiers when requested", async () => {
    await handle("/api/v1/telnyx-config", {
      method: "PUT",
      body: JSON.stringify({
        apiKey: "KEY123456789",
        accountSid: "acct_telnyx_1",
        applicationSid: "app_telnyx_1",
      }),
    })
    const res = await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({
        toNumber: "+15555550100",
        providerOptions: { telephonyProvider: "telnyx" },
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      status: "ringing",
      telnyxCallSid: "v3:telnyx-call-1",
      telnyxAccountSid: "acct_telnyx_1",
      telephonyProvider: "telnyx",
    })
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
    expect(service.importPhoneNumbers).toHaveBeenCalledWith(fakeUser.id, {
      telephonyProvider: undefined,
    })
  })

  it("POST /api/v1/agents accepts success evaluation and redacts webhook secret", async () => {
    const res = await handle("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        voiceEngine: "conversation-relay",
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

  it("requires an explicit voice engine for new agents", async () => {
    const res = await handle("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Missing engine" }),
    })
    expect(res.status).toBe(422)
  })

  it("lists supported realtime models", async () => {
    const res = await handle("/api/v1/realtime-models")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      maxDurationSeconds: 1440,
      transcriptionModel: "xai/grok-stt",
      models: expect.arrayContaining([
        expect.objectContaining({
          model: "xai/grok-voice-think-fast-1.0",
        }),
      ]),
    })
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

  it("GET /api/v1/calls/:id returns the per-call credit breakdown", async () => {
    await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
      }),
    })
    await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })

    const res = await handle("/api/v1/calls/call-1")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      billing: {
        runtimeCredits: 2,
        agentCredits: 0.25,
        totalCredits: 2.3,
        creditsRemaining: 997.7,
      },
    })
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
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
      }),
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
    const starter = jest.fn(async (_input: unknown) => ({
      runId: "run-recording-1",
    }))
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

  it("POST /api/v1/twilio/recording does not start workflow for absent recordings", async () => {
    const service = createMockRelayService()
    service.handleRecordingWebhook.mockResolvedValueOnce({
      ok: true,
      matched: true,
      userId: fakeUser.id,
      callId: "call-1",
      recordingSid: "",
      recordingStatus: "absent",
    })
    setVoiceRelayServiceForTests(service as never)
    const starter = jest.fn(async (_input: unknown) => ({
      runId: "run-recording-1",
    }))
    setPostCallWorkflowStarterForTests(starter)

    const res = await handle("/api/v1/twilio/recording", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        CallSid: "CA123",
        RecordingStatus: "absent",
      }).toString(),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      matched: true,
      recordingStatus: "absent",
    })
    expect(starter).not.toHaveBeenCalled()
  })

  it("POST /api/v1/calls/:id/post-call/retry restarts post-call workflow", async () => {
    await handle("/api/v1/twilio-config", {
      method: "PUT",
      body: JSON.stringify({
        accountSid: "AC123456789",
        authToken: "secret-token",
      }),
    })
    await handle("/api/v1/calls", {
      method: "POST",
      body: JSON.stringify({ toNumber: "+15555550100" }),
    })
    const starter = jest.fn(async (_input: unknown) => ({
      runId: "run-retry-1",
    }))
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
