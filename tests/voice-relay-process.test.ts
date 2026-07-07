import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createVoiceRelayService } = require("@/lib/services/voice-relay-service")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VoiceServiceError } = require("@/lib/services")

const fakeUser = { id: "relay-user-1" }

type AsyncMock = (...args: unknown[]) => Promise<unknown>

function mockAsync(implementation?: (...args: unknown[]) => Promise<unknown>) {
  return jest.fn(
    implementation ?? (async () => undefined)
  ) as jest.MockedFunction<AsyncMock>
}

function createProcessRepo() {
  const twilioConfigs = new Map<string, Record<string, unknown>>()
  const agents = new Map<string, Record<string, unknown>>()
  const calls = new Map<string, Record<string, unknown>>()
  const phones = new Map<string, Record<string, unknown>>()
  const events = new Map<string, Record<string, unknown>[]>()
  const transcriptItems = new Map<string, Record<string, unknown>[]>()

  const repo = {
    getTwilioConfig: mockAsync(async (userId) => {
      const row = twilioConfigs.get(String(userId))
      if (!row) return { configured: false, providerSource: "none" }
      return {
        configured: true,
        providerSource: "user",
        accountSidPrefix: String(row.accountSid).slice(0, 8),
        defaultFromNumber: row.defaultFromNumber,
        defaultWebhookBaseUrl: row.defaultWebhookBaseUrl,
        deleteTwilioRecordingAfterBlobUpload:
          row.deleteTwilioRecordingAfterBlobUpload ?? false,
        updatedAt: row.updatedAt,
      }
    }),
    upsertTwilioConfig: mockAsync(async (userId, input) => {
      const row: Record<string, unknown> = {
        ...(input as Record<string, unknown>),
        updatedAt: "2024-01-01T00:00:00.000Z",
      }
      twilioConfigs.set(String(userId), row)
      return {
        configured: true,
        providerSource: "user",
        accountSidPrefix: String(row.accountSid).slice(0, 8),
        defaultFromNumber: row.defaultFromNumber,
        defaultWebhookBaseUrl: row.defaultWebhookBaseUrl,
        deleteTwilioRecordingAfterBlobUpload:
          row.deleteTwilioRecordingAfterBlobUpload ?? false,
        updatedAt: row.updatedAt,
      }
    }),
    deleteTwilioConfig: mockAsync(async (userId) =>
      twilioConfigs.delete(String(userId))
    ),
    resolveTwilioCredentials: mockAsync(async (userId) => {
      const row = twilioConfigs.get(String(userId))
      if (!row) return null
      return {
        accountSid: row.accountSid,
        authToken: row.authToken,
        defaultFromNumber: row.defaultFromNumber,
        defaultWebhookBaseUrl: row.defaultWebhookBaseUrl,
        deleteTwilioRecordingAfterBlobUpload:
          row.deleteTwilioRecordingAfterBlobUpload ?? false,
        source: "user",
      }
    }),
    createAgent: mockAsync(async (userId, input) => {
      const row: Record<string, unknown> = {
        id: "agent-1",
        provider: VOICE_API_PROVIDER_ID,
        userId,
        ...(input as Record<string, unknown>),
      }
      agents.set(String(row.id), row)
      return row
    }),
    listAgents: mockAsync(async () => ({ items: Array.from(agents.values()), hasMore: false })),
    getAgent: mockAsync(async (_userId, id) => agents.get(String(id)) ?? null),
    updateAgent: mockAsync(async (_userId, id, input) => {
      const current = agents.get(String(id))
      if (!current) return null
      const next = { ...current, ...(input as Record<string, unknown>) }
      agents.set(String(id), next)
      return next
    }),
    resolveAgentWebhookSecret: mockAsync(async (_userId, agentId) => {
      const agent = agents.get(String(agentId))
      return agent?.webhookSecret ?? null
    }),
    deleteAgent: mockAsync(async (_userId, id) => agents.delete(String(id))),
    createCall: mockAsync(async (userId, input) => {
      const row: Record<string, unknown> = {
        id: "call-1",
        provider: VOICE_API_PROVIDER_ID,
        ...(input as Record<string, unknown>),
        userId,
      }
      calls.set(String(row.id), row)
      return row
    }),
    listCalls: mockAsync(async () => ({ items: Array.from(calls.values()), hasMore: false })),
    getCall: mockAsync(async (_userId, id) => calls.get(String(id)) ?? null),
    findCallById: mockAsync(async (id) => calls.get(String(id)) ?? null),
    updateCall: mockAsync(async (_userId, id, input) => {
      const current = calls.get(String(id))
      if (!current) return null
      const next = { ...current, ...(input as Record<string, unknown>) }
      calls.set(String(id), next)
      return next
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
        provider: VOICE_API_PROVIDER_ID,
        userId,
        ...(input as Record<string, unknown>),
      }
      phones.set(String(row.id), row)
      return { ...row, agentId: row.inboundAgentId }
    }),
    listPhoneNumbers: mockAsync(async () => ({ items: Array.from(phones.values()), hasMore: false })),
    getPhoneNumber: mockAsync(async (_userId, id) => phones.get(String(id)) ?? null),
    findPhoneNumberByNumber: mockAsync(async (number) => {
      for (const phone of phones.values()) {
        if (phone.number === number) return phone
      }
      return null
    }),
    updatePhoneNumber: mockAsync(async (_userId, id, input) => {
      const current = phones.get(String(id))
      if (!current) return null
      const next = { ...current, ...(input as Record<string, unknown>) }
      phones.set(String(id), next)
      return next
    }),
    deletePhoneNumber: mockAsync(async (_userId, id) => phones.delete(String(id))),
    addTranscriptItem: mockAsync(async (_userId, input) => {
      const item: Record<string, unknown> = {
        id: `transcript-${String(
          input && typeof input === "object" && "sequence" in input
            ? (input as Record<string, unknown>).sequence
            : 1
        )}`,
        ...(input as Record<string, unknown>),
        createdAt: "2024-01-01T00:00:00.000Z",
      }
      const items = transcriptItems.get(String(item.callId)) ?? []
      items.push(item)
      transcriptItems.set(String(item.callId), items)
      return item
    }),
    listTranscriptItems: mockAsync(async (_userId, callId) =>
      transcriptItems.get(String(callId)) ?? []
    ),
  }

  return { repo, stores: { twilioConfigs, agents, calls, phones, events, transcriptItems } }
}

function createTwilioMock() {
  return {
    testCredentials: jest.fn(async () => undefined),
    createCall: jest.fn(async () => ({
      sid: "CA123",
      accountSid: "AC123456789",
      status: "ringing",
      raw: { sid: "CA123", status: "ringing" },
    })),
    conversationRelayTwiML: jest.fn((input: { websocketUrl: string }) => {
      return `<Response><Connect><ConversationRelay url="${input.websocketUrl}" /></Connect></Response>`
    }),
    validateSignature: jest.fn((input: { url: string }) => Boolean(input.url)),
    getRecording: jest.fn(async (_credentials: unknown, _recordingSid: unknown) => ({
      sid: "RE123",
      status: "completed",
      contentType: "audio/mpeg",
      raw: { sid: "RE123", status: "completed" },
    })),
    fetchRecordingMedia: jest.fn(async (_credentials: unknown, _recordingSid: unknown) => ({
      body: "audio bytes",
      contentType: "audio/mpeg",
      size: 11,
    })),
    deleteRecording: jest.fn(async (_credentials: unknown, _recordingSid: unknown) => undefined),
  }
}

function createLlmMock() {
  return {
    async *streamResponse() {
      yield "Hello"
      yield " there"
    },
    analyzeCall: jest.fn(async () => ({
      summary: "Caller needed help.",
      outcome: "resolved",
      sentiment: "neutral",
      actionItems: [],
      keyMoments: [],
      transcriptQualityNotes: "Clear.",
    })),
    evaluateCallSuccess: jest.fn(async () => ({
      successful: true,
      reason: "The caller got the help they needed.",
    })),
  }
}

function createFailingLlmMock() {
  return {
    async *streamResponse() {
      throw new Error("rate limited")
    },
    analyzeCall: jest.fn(async () => ({ summary: "not used" })),
    evaluateCallSuccess: jest.fn(async () => ({
      successful: false,
      reason: "not used",
    })),
  }
}

function createFilesMock() {
  return {
    provider: "memory",
    uploadRecording: jest.fn(async () => ({
      key: "recordings/call-1/rec-1.mp3",
      provider: "memory",
      size: 11,
      contentType: "audio/mpeg",
    })),
    downloadRecording: jest.fn(),
    headRecording: jest.fn(async (_key: unknown) => new File(["audio bytes"], "recording.mp3", { type: "audio/mpeg" })),
    deleteRecording: jest.fn(),
  }
}

beforeEach(() => {
  delete process.env.TWILIO_WEBHOOK_USER_ID
})

describe("voice relay service process behavior", () => {
  it("POST /api/v1/calls writes DB values and calls Twilio with webhook URLs", async () => {
    const { repo, stores } = createProcessRepo()
    const twilio = createTwilioMock()
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
      defaultWebhookBaseUrl: "https://voice.example.com",
    })

    const call = await service.createCall(fakeUser.id, {
      toNumber: "+15555550100",
      providerOptions: { record: true },
    })

    expect(call).toMatchObject({
      status: "ringing",
      twilioCallSid: "CA123",
      twilioAccountSid: "AC123456789",
    })
    expect(twilio.createCall as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ accountSid: "AC123456789" }),
      expect.objectContaining({
        to: "+15555550100",
        from: "+15555550123",
        voiceUrl: `https://voice.example.com/api/v1/twilio/voice?callId=${call.id}`,
        statusCallbackUrl: `https://voice.example.com/api/v1/twilio/status?callId=${call.id}`,
        recordingStatusCallbackUrl:
          `https://voice.example.com/api/v1/twilio/recording?callId=${call.id}`,
        record: true,
      })
    )
    expect(stores.events.get(String(call.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "call.queued" }),
        expect.objectContaining({ type: "twilio.call.created" }),
      ])
    )
  })

  it("POST /api/v1/calls records outbound calls by default", async () => {
    const { repo } = createProcessRepo()
    const twilio = createTwilioMock()
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
      defaultWebhookBaseUrl: "https://voice.example.com",
    })

    await service.createCall(fakeUser.id, { toNumber: "+15555550100" })

    expect(twilio.createCall as jest.Mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ record: true })
    )
  })

  it("inbound voice webhook rejects invalid Twilio signatures", async () => {
    const { repo } = createProcessRepo()
    const twilio = createTwilioMock()
    twilio.validateSignature.mockReturnValue(false)
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
    })
    await service.createPhoneNumber(fakeUser.id, {
      number: "+15555550123",
      inboundAgentId: "agent-1",
    })

    await expect(
      service.handleVoiceWebhook({
        url: "https://voice.example.com/api/v1/twilio/voice",
        signature: "bad",
        params: { To: "+15555550123", From: "+15555550100", CallSid: "CA123" },
      })
    ).rejects.toMatchObject(
      new VoiceServiceError(
        401,
        "TWILIO_SIGNATURE_INVALID",
        "Invalid Twilio signature"
      )
    )
  })

  it("validates Twilio signatures against the configured webhook base URL", async () => {
    const { repo } = createProcessRepo()
    const twilio = createTwilioMock()
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultWebhookBaseUrl: "https://voice.example.com",
    })
    twilio.validateSignature.mockImplementation(
      (input: { url: string }) =>
        input.url ===
        "https://voice.example.com/api/v1/twilio/voice?callId=call-1"
    )

    await expect(
      service.validateTwilioWebhook({
        userId: fakeUser.id,
        url: "http://localhost:3000/api/v1/twilio/voice?callId=call-1",
        signature: "valid",
        params: { CallSid: "CA123" },
      })
    ).resolves.toBe(true)
    expect(
      twilio.validateSignature.mock.calls.map(([input]) => input.url)
    ).toContain(
      "https://voice.example.com/api/v1/twilio/voice?callId=call-1"
    )
  })

  it("voice webhook emits relay TwiML with the configured public websocket URL", async () => {
    const { repo, stores } = createProcessRepo()
    const twilio = createTwilioMock()
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
      defaultWebhookBaseUrl: "https://voice.example.com",
    })
    await service.createAgent(fakeUser.id, { name: "Support" })
    const call = await service.createCall(fakeUser.id, {
      agentId: "agent-1",
      toNumber: "+15555550100",
    })

    const twiml = await service.handleVoiceWebhook({
      url: `http://localhost:3000/api/v1/twilio/voice?callId=${call.id}`,
      signature: "valid",
      callId: String(call.id),
      params: {
        CallSid: "CA123",
        AccountSid: "AC123456789",
        To: "+15555550100",
        From: "+15555550123",
      },
    })

    expect(twiml).toContain(
      `wss://voice.example.com/api/v1/relay/ws?callId=${call.id}`
    )
    expect(twilio.conversationRelayTwiML).toHaveBeenCalledWith(
      expect.objectContaining({
        websocketUrl: `wss://voice.example.com/api/v1/relay/ws?callId=${call.id}`,
      })
    )
    expect(stores.events.get(String(call.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "twilio.voice.answered" }),
      ])
    )
  })

  it("resolves relay websocket ownership from callId", async () => {
    const { repo } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      toNumber: "+15555550100",
    })

    await expect(service.resolveRelayCall(String(call.id))).resolves.toMatchObject({
      userId: fakeUser.id,
      call: expect.objectContaining({ id: call.id }),
    })
  })

  it("relay prompt stores transcript/events and streams assistant tokens", async () => {
    const { repo, stores } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.createAgent(fakeUser.id, {
      name: "Support",
      model: { provider: "openai", model: "gpt-4.1-mini" },
    })
    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      agentId: "agent-1",
      toNumber: "+15555550100",
    })

    const sent: unknown[] = []
    await service.handleRelayMessage({
      userId: fakeUser.id,
      callId: String(call.id),
      message: { type: "prompt", voicePrompt: "I need help", last: true },
      send: (message: unknown) => sent.push(message),
    })

    expect(stores.events.get(String(call.id))).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "relay.prompt" })])
    )
    expect(stores.transcriptItems.get(String(call.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", text: "I need help" }),
        expect.objectContaining({ role: "assistant", text: "Hello there" }),
      ])
    )
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", token: "Hello" }),
        expect.objectContaining({ type: "text", last: true }),
      ])
    )
  })

  it("status webhook resolves user from callId and marks ended", async () => {
    const { repo, stores } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      toNumber: "+15555550100",
    })

    await expect(
      service.handleStatusWebhook({
        callId: String(call.id),
        params: {
          CallSid: "CA123",
          CallStatus: "completed",
          CallDuration: "42",
        },
      })
    ).resolves.toMatchObject({ ok: true, matched: true })

    expect(stores.calls.get(String(call.id))).toMatchObject({
      status: "ended",
      duration: 42,
    })
    expect(stores.events.get(String(call.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "twilio.call.status" }),
      ])
    )
  })

  it("recording webhook resolves user from callId and stores metadata", async () => {
    const { repo, stores } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      toNumber: "+15555550100",
    })

    await expect(
      service.handleRecordingWebhook({
        callId: String(call.id),
        params: {
          RecordingSid: "RE123",
          RecordingStatus: "completed",
          RecordingUrl: "https://api.twilio.com/recording",
        },
      })
    ).resolves.toMatchObject({ ok: true, matched: true })

    expect(stores.calls.get(String(call.id))).toMatchObject({
      recordingSid: "RE123",
      recordingStatus: "completed",
      recordingUrl: "https://api.twilio.com/recording",
      postCallStatus: "pending",
    })
  })

  it("relay prompt records an LLM error without fake assistant text", async () => {
    const { repo, stores } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createFailingLlmMock() as never,
      createFilesMock() as never
    )

    await service.createAgent(fakeUser.id, {
      name: "Support",
      model: { provider: "openai", model: "gpt-4o-mini" },
    })
    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      agentId: "agent-1",
      toNumber: "+15555550100",
    })

    const sent: unknown[] = []
    await service.handleRelayMessage({
      userId: fakeUser.id,
      callId: String(call.id),
      message: { type: "prompt", voicePrompt: "Who are you?", last: true },
      send: (message: unknown) => sent.push(message),
    })

    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", token: "", last: true }),
      ])
    )
    expect(stores.transcriptItems.get(String(call.id))).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "assistant" })])
    )
    expect(stores.events.get(String(call.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "relay.llm.error" }),
      ])
    )
  })

  it("recording ingestion stores through file storage and updates the call", async () => {
    const { repo, stores } = createProcessRepo()
    const files = createFilesMock()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      files as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, { toNumber: "+15555550100" })

    const uploaded = await service.ingestRecording({
      userId: fakeUser.id,
      callId: String(call.id),
      recordingSid: "rec-1",
      body: "audio bytes",
      contentType: "audio/mpeg",
    })

    expect(uploaded.key).toBe("recordings/call-1/rec-1.mp3")
    expect(files.uploadRecording).toHaveBeenCalled()
    expect(stores.calls.get(String(call.id))).toMatchObject({
      recordingStorageKey: "recordings/call-1/rec-1.mp3",
      recordingStorageProvider: "memory",
      recordingContentType: "audio/mpeg",
      recordingSizeBytes: 11,
      recordingIngestedAt: expect.any(Date),
    })
    expect(stores.events.get(String(call.id))).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "recording.stored" })])
    )
  })

  it("post-call processing uploads recording, verifies Blob, analyzes, and keeps Twilio by default", async () => {
    const { repo, stores } = createProcessRepo()
    const twilio = createTwilioMock()
    const files = createFilesMock()
    const llm = createLlmMock()
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      llm as never,
      files as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, { toNumber: "+15555550100" })
    await service.handleRecordingWebhook({
      callId: String(call.id),
      params: { RecordingSid: "RE123", RecordingStatus: "completed" },
    })

    await expect(
      service.processPostCall({ userId: fakeUser.id, callId: String(call.id) })
    ).resolves.toEqual({ ok: true })

    expect(twilio.fetchRecordingMedia).toHaveBeenCalledWith(
      expect.objectContaining({ accountSid: "AC123456789" }),
      "RE123"
    )
    expect(files.uploadRecording).toHaveBeenCalled()
    expect(files.headRecording).toHaveBeenCalledWith("recordings/call-1/rec-1.mp3")
    expect(twilio.deleteRecording).not.toHaveBeenCalled()
    expect(stores.calls.get(String(call.id))).toMatchObject({
      postCallStatus: "ready",
      analysisStatus: "ready",
      successEvaluationStatus: "ready",
      callSuccessful: true,
      successEvaluationReason: "The caller got the help they needed.",
      analysis: expect.objectContaining({ summary: "Caller needed help." }),
      recordingStorageKey: "recordings/call-1/rec-1.mp3",
    })
  })

  it("post-call success evaluation uses the agent prompt when configured", async () => {
    const { repo } = createProcessRepo()
    const llm = createLlmMock()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      llm as never,
      createFilesMock() as never
    )

    await service.createAgent(fakeUser.id, {
      name: "Support",
      successEvaluationPrompt: "The call is successful only if a demo was booked.",
    })
    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      agentId: "agent-1",
      toNumber: "+15555550100",
    })
    await service.handleRecordingWebhook({
      callId: String(call.id),
      params: { RecordingSid: "RE123", RecordingStatus: "completed" },
    })

    await service.processPostCall({ userId: fakeUser.id, callId: String(call.id) })

    expect(llm.evaluateCallSuccess as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        successEvaluationPrompt:
          "The call is successful only if a demo was booked.",
      })
    )
  })

  it("failed success evaluation does not break recording ingestion", async () => {
    const { repo, stores } = createProcessRepo()
    const llm = createLlmMock()
    llm.evaluateCallSuccess.mockRejectedValue(new Error("eval failed"))
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      llm as never,
      createFilesMock() as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, { toNumber: "+15555550100" })
    await service.handleRecordingWebhook({
      callId: String(call.id),
      params: { RecordingSid: "RE123", RecordingStatus: "completed" },
    })

    await expect(
      service.processPostCall({ userId: fakeUser.id, callId: String(call.id) })
    ).resolves.toEqual({ ok: true })

    expect(stores.calls.get(String(call.id))).toMatchObject({
      postCallStatus: "ready",
      recordingStorageKey: "recordings/call-1/rec-1.mp3",
      successEvaluationStatus: "failed",
      successEvaluationError: "eval failed",
    })
  })

  it("finished-call webhook sends signed payload when configured", async () => {
    const { repo, stores } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      createFilesMock() as never
    )
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))

    try {
      await service.createAgent(fakeUser.id, {
        name: "Support",
        webhookUrl: "https://example.com/webhooks/voice",
        webhookTimeoutSeconds: 5,
        webhookSecret: "secret",
      })
      await service.upsertTwilioConfig(fakeUser.id, {
        accountSid: "AC123456789",
        authToken: "token",
        defaultFromNumber: "+15555550123",
      })
      const call = await service.createCall(fakeUser.id, {
        agentId: "agent-1",
        toNumber: "+15555550100",
      })
      await service.handleRecordingWebhook({
        callId: String(call.id),
        params: { RecordingSid: "RE123", RecordingStatus: "completed" },
      })
      await service.processPostCall({
        userId: fakeUser.id,
        callId: String(call.id),
      })

      await expect(
        service.deliverFinishedCallWebhook({
          userId: fakeUser.id,
          callId: String(call.id),
          attempt: 1,
        })
      ).resolves.toMatchObject({ ok: true, skipped: false })

      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/webhooks/voice",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-voice-api-event": "call.finished",
            "x-voice-api-signature": expect.stringMatching(/^sha256=/),
          }),
        })
      )
      expect(stores.calls.get(String(call.id))).toMatchObject({
        webhookDeliveryStatus: "delivered",
        webhookDeliveryAttempts: 1,
      })
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("finished-call webhook is skipped when no agent webhook URL is set", async () => {
    const { repo, stores } = createProcessRepo()
    const service = createVoiceRelayService(
      repo as never,
      createTwilioMock() as never,
      createLlmMock() as never,
      createFilesMock() as never
    )

    await service.createAgent(fakeUser.id, { name: "Support" })
    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
    })
    const call = await service.createCall(fakeUser.id, {
      agentId: "agent-1",
      toNumber: "+15555550100",
    })

    await expect(
      service.deliverFinishedCallWebhook({
        userId: fakeUser.id,
        callId: String(call.id),
        attempt: 1,
      })
    ).resolves.toMatchObject({ ok: true, skipped: true })

    expect(stores.calls.get(String(call.id))).toMatchObject({
      webhookDeliveryStatus: "skipped",
    })
  })

  it("post-call processing deletes Twilio only after Blob verification when the switch is enabled", async () => {
    const { repo, stores } = createProcessRepo()
    const twilio = createTwilioMock()
    const files = createFilesMock()
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      files as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      defaultFromNumber: "+15555550123",
      deleteTwilioRecordingAfterBlobUpload: true,
    })
    const call = await service.createCall(fakeUser.id, { toNumber: "+15555550100" })
    await service.handleRecordingWebhook({
      callId: String(call.id),
      params: { RecordingSid: "RE123", RecordingStatus: "completed" },
    })

    await service.processPostCall({ userId: fakeUser.id, callId: String(call.id) })

    expect(files.headRecording).toHaveBeenCalledWith("recordings/call-1/rec-1.mp3")
    expect(twilio.deleteRecording).toHaveBeenCalledWith(
      expect.objectContaining({ accountSid: "AC123456789" }),
      "RE123"
    )
    expect(stores.calls.get(String(call.id))).toMatchObject({
      recordingDeletedFromTwilioAt: expect.any(Date),
    })
  })

  it("failed Blob upload marks post-call failed without deleting Twilio", async () => {
    const { repo, stores } = createProcessRepo()
    const twilio = createTwilioMock()
    const files = createFilesMock()
    files.uploadRecording.mockRejectedValue(new Error("blob down"))
    const service = createVoiceRelayService(
      repo as never,
      twilio as never,
      createLlmMock() as never,
      files as never
    )

    await service.upsertTwilioConfig(fakeUser.id, {
      accountSid: "AC123456789",
      authToken: "token",
      deleteTwilioRecordingAfterBlobUpload: true,
    })
    const call = await service.createCall(fakeUser.id, {
      toNumber: "+15555550100",
      fromNumber: "+15555550123",
    })
    await service.handleRecordingWebhook({
      callId: String(call.id),
      params: { RecordingSid: "RE123", RecordingStatus: "completed" },
    })

    await expect(
      service.processPostCall({ userId: fakeUser.id, callId: String(call.id) })
    ).rejects.toThrow("blob down")

    expect(twilio.deleteRecording).not.toHaveBeenCalled()
    expect(stores.calls.get(String(call.id))).toMatchObject({
      postCallStatus: "failed",
      recordingIngestionError: "blob down",
    })
  })
})
