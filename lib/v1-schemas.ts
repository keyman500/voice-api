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

/** Loose JSON object for metadata / passthrough. */
export const recordUnknown = t.Record(t.String(), t.Unknown())

const optionalRecordUnknown = t.Optional(recordUnknown)

export const createAgentBody = t.Object({
  name: t.Optional(t.String()),
  voice: t.Optional(voiceConfig),
  model: t.Optional(modelConfig),
  firstMessage: t.Optional(t.String()),
  maxDurationSeconds: t.Optional(t.Number()),
  backgroundSound: t.Optional(t.String()),
  voicemailMessage: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  webhookTimeoutSeconds: t.Optional(t.Number()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
})

export const updateAgentBody = t.Object({
  name: t.Optional(t.String()),
  voice: t.Optional(voiceConfig),
  model: t.Optional(modelConfig),
  firstMessage: t.Optional(t.String()),
  maxDurationSeconds: t.Optional(t.Number()),
  backgroundSound: t.Optional(t.String()),
  voicemailMessage: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  webhookTimeoutSeconds: t.Optional(t.Number()),
  metadata: optionalRecordUnknown,
  providerOptions: optionalRecordUnknown,
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
  direction: t.Optional(
    t.Union([t.Literal("inbound"), t.Literal("outbound")])
  ),
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

/** JSON-friendly agent row (dates as ISO strings if present). */
export const agentResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  name: t.Optional(t.String()),
  voice: t.Optional(voiceConfig),
  model: t.Optional(modelConfig),
  firstMessage: t.Optional(t.String()),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
  raw: t.Unknown(),
})

export const callResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  agentId: t.Optional(t.String()),
  toNumber: t.Optional(t.String()),
  fromNumber: t.Optional(t.String()),
  status: callStatus,
  startedAt: t.Optional(t.String()),
  endedAt: t.Optional(t.String()),
  duration: t.Optional(t.Number()),
  transcript: t.Optional(t.String()),
  recordingUrl: t.Optional(t.String()),
  analysis: t.Optional(t.Record(t.String(), t.Unknown())),
  events: t.Optional(
    t.Array(
      t.Object({
        id: t.String(),
        type: t.String(),
        payload: t.Optional(t.Record(t.String(), t.Unknown())),
        createdAt: t.String(),
      })
    )
  ),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
  providerOptions: t.Optional(t.Record(t.String(), t.Unknown())),
  raw: t.Unknown(),
  roomName: t.Optional(t.String()),
  livekitSipParticipantId: t.Optional(t.String()),
  livekitSipCallId: t.Optional(t.String()),
  livekitSipTrunkId: t.Optional(t.String()),
  providerSource: t.Optional(t.Union([t.Literal("user"), t.Literal("platform")])),
})

export const phoneNumberResponse = t.Object({
  id: t.String(),
  provider: t.String(),
  number: t.Optional(t.String()),
  name: t.Optional(t.String()),
  agentId: t.Optional(t.String()),
  inboundAgentId: t.Optional(t.String()),
  outboundAgentId: t.Optional(t.String()),
  webhookUrl: t.Optional(t.String()),
  areaCode: t.Optional(t.String()),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
  raw: t.Unknown(),
})
