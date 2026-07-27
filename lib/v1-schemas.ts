/**
 * Elysia `t` schemas for `/api/v1` — field names and semantics mirror
 * `voice-ai-sdk` `Create*Params` / `Update*Params` / list filters (camelCase JSON).
 */
import { t } from "elysia"

export const voiceConfig = t.Object({
  voiceId: t.String(),
  provider: t.Optional(t.String()),
})

export const modelConfig = t.Object({
  provider: t.String(),
  model: t.String(),
  systemPrompt: t.Optional(t.String()),
  knowledgeBaseIds: t.Optional(t.Array(t.String())),
})

export const voiceEngine = t.Union([
  t.Literal("conversation-relay"),
  t.Literal("realtime"),
])

/** Loose JSON object for metadata / passthrough. */
export const recordUnknown = t.Record(t.String(), t.Unknown())

export const toolFunctionConfig = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  parameters: t.Optional(recordUnknown),
})

export const toolServerConfig = t.Object({
  url: t.String(),
  timeoutSeconds: t.Optional(t.Number()),
  headers: t.Optional(t.Record(t.String(), t.String())),
  secret: t.Optional(t.String()),
})

const optionalRecordUnknown = t.Optional(recordUnknown)
const nullableString = t.Union([t.String(), t.Null(), t.Undefined()])
const nullableNumber = t.Union([t.Number(), t.Null(), t.Undefined()])
const nullableBoolean = t.Union([t.Boolean(), t.Null(), t.Undefined()])
const nullableRecordUnknown = t.Union([recordUnknown, t.Null(), t.Undefined()])
const nullableStringArray = t.Union([
  t.Array(t.String()),
  t.Null(),
  t.Undefined(),
])

export const errorResponse = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
})

export const standardErrorResponses = {
  400: errorResponse,
  401: errorResponse,
  402: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
}

export const okResponse = t.Object({ ok: t.Boolean() })

export const createAgentBody = t.Object({
  voiceEngine,
  name: t.Optional(t.String()),
  voice: t.Optional(voiceConfig),
  model: t.Optional(modelConfig),
  toolIds: t.Optional(t.Array(t.String())),
  firstMessage: t.Optional(t.String()),
  maxDurationSeconds: t.Optional(t.Number()),
  backgroundSound: t.Optional(t.String()),
  voicemailMessage: t.Optional(t.String()),
  successEvaluationPrompt: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  webhookTimeoutSeconds: t.Optional(t.Number()),
  webhookSecret: t.Optional(t.String()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
})

export const updateAgentBody = t.Object({
  voiceEngine: t.Optional(voiceEngine),
  name: t.Optional(t.String()),
  voice: t.Optional(voiceConfig),
  model: t.Optional(modelConfig),
  toolIds: t.Optional(t.Array(t.String())),
  firstMessage: t.Optional(t.String()),
  maxDurationSeconds: t.Optional(t.Number()),
  backgroundSound: t.Optional(t.String()),
  voicemailMessage: t.Optional(t.String()),
  successEvaluationPrompt: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  webhookTimeoutSeconds: t.Optional(t.Number()),
  webhookSecret: t.Optional(t.String()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
})

export const createToolBody = t.Object({
  type: t.String(),
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
  function: t.Optional(toolFunctionConfig),
  server: t.Optional(toolServerConfig),
  messages: t.Optional(t.Array(recordUnknown)),
  async: t.Optional(t.Boolean()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
})

export const updateToolBody = t.Object({
  type: t.Optional(t.String()),
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
  function: t.Optional(toolFunctionConfig),
  server: t.Optional(toolServerConfig),
  messages: t.Optional(t.Array(recordUnknown)),
  async: t.Optional(t.Boolean()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
})

export const listToolsQuery = t.Object({
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
})

export const testToolBody = t.Object({
  arguments: t.Optional(recordUnknown),
  callId: t.Optional(t.String()),
})

export const listAgentsQuery = t.Object({
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
})

export const upsertLiveKitConfigBody = t.Object({
  livekitUrl: t.String(),
  apiKey: t.String(),
  apiSecret: t.String(),
  defaultSipOutboundTrunkId: t.Optional(t.String()),
})

export const upsertTwilioConfigBody = t.Object({
  accountSid: t.String(),
  authToken: t.String(),
  defaultFromNumber: t.Optional(t.String()),
  deleteTwilioRecordingAfterBlobUpload: t.Optional(t.Boolean()),
})

export const callStatus = t.Union([
  t.Literal("queued"),
  t.Literal("ringing"),
  t.Literal("in-progress"),
  t.Literal("ended"),
  t.Literal("error"),
  t.Literal("unknown"),
])

export const createCallBody = t.Object({
  agentId: t.Optional(t.String()),
  phoneNumberId: t.Optional(t.String()),
  toNumber: t.String(),
  fromNumber: t.Optional(t.String()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
})

export const updateCallBody = t.Object({
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
  providerOptions: optionalRecordUnknown,
  /** Out-of-band from SDK’s minimal UpdateCallParams; used to end a call in our API. */
  status: t.Optional(callStatus),
})

export const listCallsQuery = t.Object({
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
  agentId: t.Optional(t.String()),
  phoneNumberId: t.Optional(t.String()),
  callStatus: t.Optional(t.String()),
  direction: t.Optional(t.Union([t.Literal("inbound"), t.Literal("outbound")])),
  callType: t.Optional(t.String()),
  userSentiment: t.Optional(t.String()),
  callSuccessful: t.Optional(t.Boolean()),
  startTime: t.Optional(t.String()),
  endTime: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Union([t.Literal("startTime"), t.Literal("createdAt")]),
      order: t.Union([t.Literal("asc"), t.Literal("desc")]),
    })
  ),
  providerOptions: optionalRecordUnknown,
})

export const createPhoneNumberBody = t.Object({
  name: t.Optional(t.String()),
  inboundAgentId: t.Optional(t.String()),
  outboundAgentId: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  areaCode: t.Optional(t.String()),
  providerOptions: optionalRecordUnknown,
  /** E.164 or placeholder until telephony is wired. */
  number: t.Optional(t.String()),
})

export const updatePhoneNumberBody = t.Object({
  name: t.Optional(t.String()),
  inboundAgentId: t.Optional(t.String()),
  outboundAgentId: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  providerOptions: optionalRecordUnknown,
  number: t.Optional(t.String()),
})

export const listPhoneNumbersQuery = t.Object({
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
})

export const idParam = t.Object({ id: t.String() })

export const billingCheckoutBody = t.Object({
  plan: t.Union([t.Literal("starter"), t.Literal("pro")]),
})

/** JSON-friendly agent row (dates as ISO strings if present). */
export const agentResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  voiceEngine: t.Optional(voiceEngine),
  name: t.Optional(nullableString),
  voice: t.Optional(voiceConfig),
  model: t.Optional(modelConfig),
  toolIds: t.Optional(nullableStringArray),
  firstMessage: t.Optional(nullableString),
  maxDurationSeconds: t.Optional(nullableNumber),
  successEvaluationPrompt: t.Optional(nullableString),
  webhookUrl: t.Optional(nullableString),
  webhookTimeoutSeconds: t.Optional(nullableNumber),
  webhookSecretConfigured: t.Optional(t.Boolean()),
  metadata: t.Optional(nullableRecordUnknown),
  providerOptions: t.Optional(nullableRecordUnknown),
  raw: t.Unknown(),
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
})

export const agentListResponse = t.Object({
  items: t.Array(agentResponse),
  hasMore: t.Boolean(),
  nextCursor: t.Optional(t.String()),
})

export const toolResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  type: t.String(),
  name: t.Optional(nullableString),
  description: t.Optional(nullableString),
  function: t.Optional(
    t.Object({
      name: t.String(),
      description: t.Optional(nullableString),
      parameters: t.Optional(nullableRecordUnknown),
    })
  ),
  server: t.Optional(
    t.Object({
      url: t.String(),
      timeoutSeconds: t.Optional(nullableNumber),
      headers: t.Optional(t.Record(t.String(), t.String())),
      secretConfigured: t.Optional(t.Boolean()),
    })
  ),
  messages: t.Optional(t.Union([t.Array(recordUnknown), t.Null(), t.Undefined()])),
  async: t.Optional(t.Boolean()),
  metadata: t.Optional(nullableRecordUnknown),
  providerOptions: t.Optional(nullableRecordUnknown),
  raw: t.Unknown(),
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
})

export const toolListResponse = t.Object({
  items: t.Array(toolResponse),
  hasMore: t.Boolean(),
  nextCursor: t.Optional(t.String()),
})

export const toolTestResponse = t.Object({
  toolCallId: t.String(),
  name: t.String(),
  result: t.String(),
  ok: t.Boolean(),
  status: t.Optional(nullableNumber),
  error: t.Optional(nullableString),
})

export const callResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  voiceEngine: t.Optional(voiceEngine),
  realtimeModel: t.Optional(nullableString),
  direction: t.Optional(t.Union([t.Literal("inbound"), t.Literal("outbound")])),
  agentId: t.Optional(nullableString),
  phoneNumberId: t.Optional(nullableString),
  toNumber: t.Optional(nullableString),
  fromNumber: t.Optional(nullableString),
  status: callStatus,
  startedAt: t.Optional(nullableString),
  endedAt: t.Optional(nullableString),
  duration: t.Optional(nullableNumber),
  transcript: t.Optional(nullableString),
  transcriptionStatus: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("ready"),
      t.Literal("failed"),
    ])
  ),
  transcriptionModel: t.Optional(nullableString),
  transcriptionError: t.Optional(nullableString),
  terminalReason: t.Optional(nullableString),
  recordingUrl: t.Optional(nullableString),
  analysis: t.Optional(nullableRecordUnknown),
  postCallStatus: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("ready"),
      t.Literal("failed"),
    ])
  ),
  postCallWorkflowRunId: t.Optional(nullableString),
  recordingIngestedAt: t.Optional(nullableString),
  recordingDeletedFromTwilioAt: t.Optional(nullableString),
  recordingIngestionError: t.Optional(nullableString),
  analysisStatus: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("ready"),
      t.Literal("failed"),
    ])
  ),
  analysisError: t.Optional(nullableString),
  callSuccessful: t.Optional(nullableBoolean),
  successEvaluationStatus: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("ready"),
      t.Literal("failed"),
    ])
  ),
  successEvaluationReason: t.Optional(nullableString),
  successEvaluationError: t.Optional(nullableString),
  webhookDeliveryStatus: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("delivered"),
      t.Literal("failed"),
      t.Literal("skipped"),
    ])
  ),
  webhookDeliveryAttempts: t.Optional(nullableNumber),
  webhookDeliveryError: t.Optional(nullableString),
  webhookLastAttemptAt: t.Optional(nullableString),
  webhookDeliveredAt: t.Optional(nullableString),
  billing: t.Optional(
    t.Object({
      status: t.Union([
        t.Literal("pending"),
        t.Literal("ready"),
        t.Literal("failed"),
      ]),
      runtimeCredits: t.Number(),
      agentCredits: t.Number(),
      postCallCredits: t.Number(),
      totalCredits: t.Number(),
      creditsRemaining: t.Number(),
      estimatedOverageCredits: t.Number(),
    })
  ),
  events: t.Optional(
    t.Array(
      t.Object({
        id: t.String(),
        type: t.String(),
        payload: t.Optional(nullableRecordUnknown),
        createdAt: t.String(),
      })
    )
  ),
  metadata: t.Optional(nullableRecordUnknown),
  providerOptions: t.Optional(nullableRecordUnknown),
  raw: t.Unknown(),
  roomName: t.Optional(nullableString),
  livekitSipParticipantId: t.Optional(nullableString),
  livekitSipCallId: t.Optional(nullableString),
  livekitSipTrunkId: t.Optional(nullableString),
  twilioCallSid: t.Optional(nullableString),
  twilioAccountSid: t.Optional(nullableString),
  relaySessionId: t.Optional(nullableString),
  recordingSid: t.Optional(nullableString),
  recordingStatus: t.Optional(nullableString),
  recordingStorageKey: t.Optional(nullableString),
  recordingStorageProvider: t.Optional(nullableString),
  recordingContentType: t.Optional(nullableString),
  recordingSizeBytes: t.Optional(nullableNumber),
  providerSource: t.Optional(
    t.Union([t.Literal("user"), t.Literal("platform")])
  ),
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
})

export const callListResponse = t.Object({
  items: t.Array(callResponse),
  hasMore: t.Boolean(),
  nextCursor: t.Optional(t.String()),
})

export const phoneNumberResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  number: t.Optional(nullableString),
  name: t.Optional(nullableString),
  agentId: t.Optional(nullableString),
  inboundAgentId: t.Optional(nullableString),
  outboundAgentId: t.Optional(nullableString),
  webhookUrl: t.Optional(nullableString),
  areaCode: t.Optional(nullableString),
  twilioPhoneNumberSid: t.Optional(nullableString),
  twilioAccountSid: t.Optional(nullableString),
  metadata: t.Optional(nullableRecordUnknown),
  providerOptions: t.Optional(nullableRecordUnknown),
  raw: t.Unknown(),
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
})

export const phoneNumberListResponse = t.Object({
  items: t.Array(phoneNumberResponse),
  hasMore: t.Boolean(),
  nextCursor: t.Optional(t.String()),
})

export const importPhoneNumbersResponse = t.Object({
  items: t.Array(phoneNumberResponse),
  hasMore: t.Boolean(),
  nextCursor: t.Optional(t.String()),
  imported: t.Optional(t.Number()),
})

export const twilioConfigResponse = t.Object({
  configured: t.Boolean(),
  providerSource: t.Union([
    t.Literal("user"),
    t.Literal("platform"),
    t.Literal("none"),
  ]),
  accountSidPrefix: t.Optional(nullableString),
  defaultFromNumber: t.Optional(nullableString),
  defaultWebhookBaseUrl: t.Optional(nullableString),
  deleteTwilioRecordingAfterBlobUpload: t.Boolean(),
  updatedAt: t.Optional(nullableString),
})

export const twilioConfigTestResponse = t.Object({
  ok: t.Boolean(),
  providerSource: t.Optional(t.String()),
})

export const deleteResponse = t.Object({
  ok: t.Boolean(),
  deleted: t.Optional(t.Boolean()),
})

export const billingPlanResponse = t.Object({
  id: t.String(),
  name: t.String(),
  priceUsd: t.Number(),
  includedCredits: t.Number(),
  productEnv: t.Optional(t.String()),
  subscriptionStatus: t.Optional(nullableString),
  currentPeriodStart: t.Optional(t.Unknown()),
  currentPeriodEnd: t.Optional(t.Unknown()),
  cancelAtPeriodEnd: t.Optional(t.Boolean()),
})

export const usageLedgerResponse = t.Object({
  id: t.String(),
  userId: t.String(),
  callId: t.Optional(nullableString),
  agentId: t.Optional(nullableString),
  kind: t.String(),
  eventName: t.String(),
  model: t.Optional(nullableString),
  inputTokens: t.Optional(nullableNumber),
  outputTokens: t.Optional(nullableNumber),
  totalTokens: t.Optional(nullableNumber),
  durationSeconds: t.Optional(nullableNumber),
  credits: t.Number(),
  providerCostUsd: t.Optional(nullableNumber),
  billableUsd: t.Optional(nullableNumber),
  markup: t.Optional(nullableNumber),
  polarEventId: t.Optional(nullableString),
  polarIngestStatus: t.String(),
  polarIngestError: t.Optional(nullableString),
  raw: t.Optional(nullableRecordUnknown),
  createdAt: t.Unknown(),
  updatedAt: t.Unknown(),
})

export const billingStatusResponse = t.Object({
  configured: t.Boolean(),
  active: t.Boolean(),
  plan: t.Union([billingPlanResponse, t.Null()]),
  plans: t.Object({
    starter: billingPlanResponse,
    pro: billingPlanResponse,
  }),
  credits: t.Object({
    used: t.Number(),
    credited: t.Number(),
    balance: t.Number(),
    estimatedOverageCredits: t.Number(),
  }),
  recentUsage: t.Array(usageLedgerResponse),
})

export const billingCheckoutResponse = t.Object({
  url: t.String(),
  checkoutId: t.Optional(t.String()),
  plan: t.String(),
})

export const billingPortalResponse = t.Object({
  url: t.String(),
})

export const modelPricingResponse = t.Object({
  eventName: t.String(),
  creditUsd: t.Number(),
  aiMarkup: t.Number(),
  runtimeCreditsPerStartedMinute: t.Number(),
  models: t.Array(
    t.Object({
      model: t.String(),
      inputUsdPerToken: t.Number(),
      outputUsdPerToken: t.Number(),
      source: t.String(),
      inputCreditsPer1kTokens: t.Number(),
      outputCreditsPer1kTokens: t.Number(),
    })
  ),
})

export const realtimeModelsResponse = t.Object({
  pricingLastVerifiedAt: t.String(),
  maxDurationSeconds: t.Number(),
  transcriptionModel: t.String(),
  models: t.Array(
    t.Object({
      model: t.String(),
      provider: t.String(),
      name: t.String(),
      voices: t.Array(t.String()),
      estimatedProviderUsdPerMinute: t.Union([t.Number(), t.Null()]),
      estimatedCreditsPerMinute: t.Union([t.Number(), t.Null()]),
      pricingUnit: t.String(),
      audioInputUsdPerToken: t.Union([t.Number(), t.Null()]),
      audioOutputUsdPerToken: t.Union([t.Number(), t.Null()]),
      available: t.Boolean(),
    })
  ),
})

export const postCallRetryResponse = t.Object({
  runId: t.Optional(t.String()),
})

export const twilioStatusWebhookResponse = t.Object({
  ok: t.Boolean(),
  matched: t.Boolean(),
})

export const twilioRecordingWebhookResponse = t.Object({
  ok: t.Optional(t.Boolean()),
  matched: t.Boolean(),
  userId: t.Optional(t.String()),
  callId: t.Optional(t.String()),
  recordingSid: t.Optional(t.String()),
  recordingStatus: t.Optional(nullableString),
  workflowStarted: t.Optional(t.Boolean()),
  workflowError: t.Optional(t.String()),
})
