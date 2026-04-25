import { VOICE_API_PROVIDER_ID } from "../voice-constants"
import type {
  JsonAgent,
  JsonCall,
  JsonPhoneNumber,
  PaginatedList,
} from "./voice-types"

const DEFAULT_PAGE = 20
const MAX_PAGE = 100

type AgentStore = Map<string, JsonAgent>
type CallStore = Map<string, JsonCall>
type PhoneStore = Map<string, JsonPhoneNumber>

const agentsByUser = new Map<string, AgentStore>()
const callsByUser = new Map<string, CallStore>()
const phonesByUser = new Map<string, PhoneStore>()

function storeFor<T extends Map<string, unknown>>(
  root: Map<string, T>,
  userId: string
): T {
  let s = root.get(userId) as T | undefined
  if (!s) {
    s = new Map() as T
    root.set(userId, s)
  }
  return s
}

function takePage<T>(items: T[], limit: number, cursor: string | undefined): {
  slice: T[]
  nextCursor: string | undefined
  hasMore: boolean
} {
  let start = 0
  if (cursor) {
    const i = items.findIndex((x) => {
      const id = (x as { id: string }).id
      return id === cursor
    })
    if (i >= 0) start = i + 1
  }
  const slice = items.slice(start, start + limit)
  const hasMore = start + slice.length < items.length
  const last = slice[slice.length - 1] as { id: string } | undefined
  const nextCursor = hasMore && last ? last.id : undefined
  return { slice, nextCursor, hasMore }
}

function limitOf(n: number | undefined) {
  const v = n ?? DEFAULT_PAGE
  if (!Number.isFinite(v) || v < 1) return DEFAULT_PAGE
  return Math.min(Math.floor(v), MAX_PAGE)
}

export const voiceInMemory = {
  // --- Agents ----------------------------------------------------------------
  createAgent(
    userId: string,
    input: {
      name?: string
      voice?: JsonAgent["voice"]
      model?: JsonAgent["model"]
      firstMessage?: string
      maxDurationSeconds?: number
      backgroundSound?: string
      voicemailMessage?: string
      webhookUrl?: string
      webhookTimeoutSeconds?: number
      metadata?: Record<string, unknown>
      providerOptions?: Record<string, unknown>
    }
  ): JsonAgent {
    const id = crypto.randomUUID()
    const row: JsonAgent = {
      id,
      provider: VOICE_API_PROVIDER_ID,
      name: input.name,
      voice: input.voice,
      model: input.model,
      firstMessage: input.firstMessage,
      metadata: {
        ...input.metadata,
        ...(input.maxDurationSeconds != null
          ? { maxDurationSeconds: input.maxDurationSeconds }
          : {}),
        ...(input.backgroundSound != null
          ? { backgroundSound: input.backgroundSound }
          : {}),
        ...(input.voicemailMessage != null
          ? { voicemailMessage: input.voicemailMessage }
          : {}),
        ...(input.webhookUrl != null ? { webhookUrl: input.webhookUrl } : {}),
        ...(input.webhookTimeoutSeconds != null
          ? { webhookTimeoutSeconds: input.webhookTimeoutSeconds }
          : {}),
      },
      raw: { stub: true, providerOptions: input.providerOptions ?? {} },
    }
    if (
      !row.metadata ||
      Object.keys(row.metadata).length === 0
    ) {
      delete row.metadata
    }
    storeFor(agentsByUser, userId).set(id, row)
    return row
  },

  listAgents(
    userId: string,
    q: { limit?: number; cursor?: string }
  ): PaginatedList<JsonAgent> {
    const items = Array.from(
      storeFor(agentsByUser, userId).values()
    ).sort((a, b) => a.id.localeCompare(b.id))
    const limit = limitOf(q.limit)
    const { slice, nextCursor, hasMore } = takePage(items, limit, q.cursor)
    return { items: slice, hasMore, nextCursor }
  },

  getAgent(userId: string, id: string): JsonAgent | null {
    return storeFor(agentsByUser, userId).get(id) ?? null
  },

  updateAgent(
    userId: string,
    id: string,
    input: {
      name?: string
      voice?: JsonAgent["voice"]
      model?: JsonAgent["model"]
      firstMessage?: string
      maxDurationSeconds?: number
      backgroundSound?: string
      voicemailMessage?: string
      webhookUrl?: string
      webhookTimeoutSeconds?: number
      metadata?: Record<string, unknown>
      providerOptions?: Record<string, unknown>
    }
  ): JsonAgent | null {
    const s = storeFor(agentsByUser, userId)
    const cur = s.get(id)
    if (!cur) return null
    const next: JsonAgent = {
      ...cur,
      name: input.name ?? cur.name,
      voice: input.voice ?? cur.voice,
      model: input.model ?? cur.model,
      firstMessage: input.firstMessage ?? cur.firstMessage,
      metadata: {
        ...cur.metadata,
        ...input.metadata,
        ...(input.maxDurationSeconds != null
          ? { maxDurationSeconds: input.maxDurationSeconds }
          : {}),
        ...(input.backgroundSound != null
          ? { backgroundSound: input.backgroundSound }
          : {}),
        ...(input.voicemailMessage != null
          ? { voicemailMessage: input.voicemailMessage }
          : {}),
        ...(input.webhookUrl != null ? { webhookUrl: input.webhookUrl } : {}),
        ...(input.webhookTimeoutSeconds != null
          ? { webhookTimeoutSeconds: input.webhookTimeoutSeconds }
          : {}),
      },
      raw: {
        ...(typeof cur.raw === "object" && cur.raw
          ? (cur.raw as object)
          : { prev: cur.raw }),
        providerOptions: input.providerOptions,
        stub: true,
      },
    }
    s.set(id, next)
    return next
  },

  deleteAgent(userId: string, id: string): boolean {
    return storeFor(agentsByUser, userId).delete(id)
  },

  // --- Calls ----------------------------------------------------------------
  createCall(
    userId: string,
    input: {
      agentId?: string
      toNumber: string
      fromNumber?: string
      metadata?: Record<string, unknown>
      providerOptions?: Record<string, unknown>
    }
  ): JsonCall {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row: JsonCall = {
      id,
      provider: VOICE_API_PROVIDER_ID,
      agentId: input.agentId,
      toNumber: input.toNumber,
      fromNumber: input.fromNumber,
      status: "in-progress",
      startedAt: now,
      metadata: input.metadata,
      raw: { stub: true, providerOptions: input.providerOptions ?? {} },
    }
    storeFor(callsByUser, userId).set(id, row)
    return row
  },

  listCalls(
    userId: string,
    q: {
      limit?: number
      cursor?: string
      agentId?: string
      phoneNumberId?: string
      callStatus?: string
    }
  ): PaginatedList<JsonCall> {
    let items = Array.from(
      storeFor(callsByUser, userId).values()
    ).sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
    if (q.agentId) {
      items = items.filter((c) => c.agentId === q.agentId)
    }
    if (q.phoneNumberId) {
      items = items.filter(
        (c) => (c.metadata as { phoneNumberId?: string } | undefined)
          ?.phoneNumberId === q.phoneNumberId
      )
    }
    if (q.callStatus) {
      items = items.filter((c) => c.status === q.callStatus)
    }
    const limit = limitOf(q.limit)
    const { slice, nextCursor, hasMore } = takePage(
      items,
      limit,
      q.cursor
    )
    return { items: slice, hasMore, nextCursor }
  },

  getCall(userId: string, id: string): JsonCall | null {
    return storeFor(callsByUser, userId).get(id) ?? null
  },

  updateCall(
    userId: string,
    id: string,
    input: {
      metadata?: Record<string, unknown>
      providerOptions?: Record<string, unknown>
      status?: JsonCall["status"]
    }
  ): JsonCall | null {
    const s = storeFor(callsByUser, userId)
    const cur = s.get(id)
    if (!cur) return null
    const endStatuses: JsonCall["status"][] = ["ended", "error"]
    const next: JsonCall = {
      ...cur,
      metadata: { ...cur.metadata, ...input.metadata },
      status: input.status ?? cur.status,
      endedAt: input.status && endStatuses.includes(input.status)
        ? new Date().toISOString()
        : cur.endedAt,
      raw: {
        ...(typeof cur.raw === "object" && cur.raw
          ? (cur.raw as object)
          : {}),
        providerOptions: input.providerOptions,
        stub: true,
      },
    }
    if (next.startedAt && next.endedAt) {
      const sMs = new Date(next.startedAt).getTime()
      const eMs = new Date(next.endedAt).getTime()
      if (eMs > sMs) next.duration = Math.round((eMs - sMs) / 1000)
    }
    s.set(id, next)
    return next
  },

  deleteCall(userId: string, id: string): boolean {
    return storeFor(callsByUser, userId).delete(id)
  },

  // --- Phone numbers --------------------------------------------------------
  createPhoneNumber(
    userId: string,
    input: {
      name?: string
      inboundAgentId?: string
      outboundAgentId?: string
      webhookUrl?: string
      areaCode?: string
      providerOptions?: Record<string, unknown>
      number?: string
    }
  ): JsonPhoneNumber {
    const id = crypto.randomUUID()
    const row: JsonPhoneNumber = {
      id,
      provider: VOICE_API_PROVIDER_ID,
      number: input.number,
      name: input.name,
      inboundAgentId: input.inboundAgentId,
      outboundAgentId: input.outboundAgentId,
      agentId: input.inboundAgentId,
      webhookUrl: input.webhookUrl,
      areaCode: input.areaCode,
      raw: { stub: true, providerOptions: input.providerOptions ?? {} },
    }
    storeFor(phonesByUser, userId).set(id, row)
    return row
  },

  listPhoneNumbers(
    userId: string,
    q: { limit?: number; cursor?: string }
  ): PaginatedList<JsonPhoneNumber> {
    const items = Array.from(
      storeFor(phonesByUser, userId).values()
    ).sort((a, b) => a.id.localeCompare(b.id))
    const limit = limitOf(q.limit)
    const { slice, nextCursor, hasMore } = takePage(items, limit, q.cursor)
    return { items: slice, hasMore, nextCursor }
  },

  getPhoneNumber(userId: string, id: string): JsonPhoneNumber | null {
    return storeFor(phonesByUser, userId).get(id) ?? null
  },

  updatePhoneNumber(
    userId: string,
    id: string,
    input: {
      name?: string
      inboundAgentId?: string
      outboundAgentId?: string
      webhookUrl?: string
      providerOptions?: Record<string, unknown>
      number?: string
    }
  ): JsonPhoneNumber | null {
    const s = storeFor(phonesByUser, userId)
    const cur = s.get(id)
    if (!cur) return null
    const next: JsonPhoneNumber = {
      ...cur,
      name: input.name ?? cur.name,
      inboundAgentId: input.inboundAgentId ?? cur.inboundAgentId,
      outboundAgentId: input.outboundAgentId ?? cur.outboundAgentId,
      agentId: input.inboundAgentId ?? cur.inboundAgentId,
      webhookUrl: input.webhookUrl ?? cur.webhookUrl,
      number: input.number ?? cur.number,
      raw: {
        ...(typeof cur.raw === "object" && cur.raw
          ? (cur.raw as object)
          : {}),
        providerOptions: input.providerOptions,
        stub: true,
      },
    }
    s.set(id, next)
    return next
  },

  deletePhoneNumber(userId: string, id: string): boolean {
    return storeFor(phonesByUser, userId).delete(id)
  },
}
