import { VOICE_API_PROVIDER_ID } from "../voice-constants"

/** In-memory / wire representation — `startedAt`/`endedAt` as ISO strings in JSON. */
export type JsonAgent = {
  id: string
  provider: typeof VOICE_API_PROVIDER_ID
  name?: string
  voice?: { voiceId: string; provider?: string }
  model?: {
    provider: string
    model: string
    systemPrompt?: string
    knowledgeBaseIds?: string[]
  }
  firstMessage?: string
  successEvaluationPrompt?: string
  webhookUrl?: string
  webhookTimeoutSeconds?: number
  webhookSecretConfigured?: boolean
  metadata?: Record<string, unknown>
  providerOptions?: Record<string, unknown>
  raw: unknown
  createdAt?: string
  updatedAt?: string
}

export type JsonCall = {
  id: string
  provider: typeof VOICE_API_PROVIDER_ID
  agentId?: string
  toNumber?: string
  fromNumber?: string
  status:
    | "queued"
    | "ringing"
    | "in-progress"
    | "ended"
    | "error"
    | "unknown"
  startedAt?: string
  endedAt?: string
  duration?: number
  transcript?: string
  recordingUrl?: string
  analysis?: Record<string, unknown>
  events?: JsonCallEvent[]
  metadata?: Record<string, unknown>
  providerOptions?: Record<string, unknown>
  raw: unknown
  roomName?: string
  livekitSipParticipantId?: string
  livekitSipCallId?: string
  livekitSipTrunkId?: string
  twilioCallSid?: string
  twilioAccountSid?: string
  relaySessionId?: string
  recordingSid?: string
  recordingStatus?: string
  recordingStorageKey?: string
  recordingStorageProvider?: string
  recordingContentType?: string
  recordingSizeBytes?: number
  postCallStatus?: "pending" | "processing" | "ready" | "failed"
  postCallWorkflowRunId?: string
  recordingIngestedAt?: string
  recordingDeletedFromTwilioAt?: string
  recordingIngestionError?: string
  analysisStatus?: "pending" | "processing" | "ready" | "failed"
  analysisError?: string
  callSuccessful?: boolean | null
  successEvaluationStatus?: "pending" | "processing" | "ready" | "failed"
  successEvaluationReason?: string
  successEvaluationError?: string
  webhookDeliveryStatus?:
    | "pending"
    | "processing"
    | "delivered"
    | "failed"
    | "skipped"
  webhookDeliveryAttempts?: number
  webhookDeliveryError?: string
  webhookLastAttemptAt?: string
  webhookDeliveredAt?: string
  providerSource?: "user" | "platform"
  createdAt?: string
  updatedAt?: string
}

export type JsonPhoneNumber = {
  id: string
  provider: typeof VOICE_API_PROVIDER_ID
  number?: string
  name?: string
  /** Convenience alias: inbound agent when a single `agentId` is used. */
  agentId?: string
  inboundAgentId?: string
  outboundAgentId?: string
  webhookUrl?: string
  areaCode?: string
  twilioPhoneNumberSid?: string
  twilioAccountSid?: string
  metadata?: Record<string, unknown>
  providerOptions?: Record<string, unknown>
  raw: unknown
  createdAt?: string
  updatedAt?: string
}

export type PaginatedList<T> = {
  items: T[]
  hasMore: boolean
  nextCursor?: string
}

export type JsonCallEvent = {
  id: string
  type: string
  payload?: Record<string, unknown>
  createdAt: string
}

export type JsonTranscriptItem = {
  id: string
  callId: string
  role: "user" | "assistant" | "system" | "tool"
  text: string
  status: "partial" | "final" | "interrupted"
  sequence: number
  raw?: Record<string, unknown>
  createdAt: string
  updatedAt?: string
}

export type RedactedLiveKitConfig = {
  configured: boolean
  providerSource: "user" | "platform" | "none"
  livekitUrl?: string
  apiKeyPrefix?: string
  defaultSipOutboundTrunkId?: string
  updatedAt?: string
}

export type RedactedTwilioConfig = {
  configured: boolean
  providerSource: "user" | "platform" | "none"
  accountSidPrefix?: string
  defaultFromNumber?: string
  defaultWebhookBaseUrl?: string
  deleteTwilioRecordingAfterBlobUpload: boolean
  updatedAt?: string
}

export type LiveKitCredentials = {
  url: string
  apiKey: string
  apiSecret: string
  defaultSipOutboundTrunkId?: string
  source: "user" | "platform"
}

export type TwilioCredentials = {
  accountSid: string
  authToken: string
  defaultFromNumber?: string
  defaultWebhookBaseUrl?: string
  deleteTwilioRecordingAfterBlobUpload: boolean
  source: "user" | "platform"
}
