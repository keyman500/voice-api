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

export type RedactedLiveKitConfig = {
  configured: boolean
  providerSource: "user" | "platform" | "none"
  livekitUrl?: string
  apiKeyPrefix?: string
  defaultSipOutboundTrunkId?: string
  updatedAt?: string
}

export type LiveKitCredentials = {
  url: string
  apiKey: string
  apiSecret: string
  defaultSipOutboundTrunkId?: string
  source: "user" | "platform"
}
