import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import * as schema from "@/lib/schema"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"
import { decryptSecret, encryptSecret } from "./encryption"
import type {
  JsonAgent,
  JsonCall,
  JsonCallEvent,
  JsonPhoneNumber,
  LiveKitCredentials,
  PaginatedList,
  RedactedLiveKitConfig,
} from "./voice-types"

const DEFAULT_PAGE = 20
const MAX_PAGE = 100

type AgentInsert = typeof schema.voiceAgent.$inferInsert
type CallInsert = typeof schema.voiceCall.$inferInsert
type PhoneInsert = typeof schema.voicePhoneNumber.$inferInsert

function now() {
  return new Date()
}

function iso(value: Date | string | null | undefined) {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : value
}

function limitOf(n: number | undefined) {
  const v = n ?? DEFAULT_PAGE
  if (!Number.isFinite(v) || v < 1) return DEFAULT_PAGE
  return Math.min(Math.floor(v), MAX_PAGE)
}

function takePage<T extends { id: string }>(
  items: T[],
  limit: number,
  cursor: string | undefined
): PaginatedList<T> {
  let start = 0
  if (cursor) {
    const index = items.findIndex((item) => item.id === cursor)
    if (index >= 0) start = index + 1
  }
  const slice = items.slice(start, start + limit)
  const last = slice[slice.length - 1]
  const hasMore = start + slice.length < items.length
  return { items: slice, hasMore, nextCursor: hasMore ? last?.id : undefined }
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  const record = jsonRecord(value)
  return record ?? undefined
}

function cleanUpdate<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>
}

function toAgent(row: typeof schema.voiceAgent.$inferSelect): JsonAgent {
  return {
    id: row.id,
    provider: VOICE_API_PROVIDER_ID,
    name: row.name ?? undefined,
    voice: (row.voice as JsonAgent["voice"]) ?? undefined,
    model: (row.model as JsonAgent["model"]) ?? undefined,
    firstMessage: row.firstMessage ?? undefined,
    metadata: row.metadata ?? undefined,
    providerOptions: row.providerOptions ?? undefined,
    raw: row.raw ?? {},
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

function toCall(
  row: typeof schema.voiceCall.$inferSelect,
  events: JsonCallEvent[] = []
): JsonCall {
  return {
    id: row.id,
    provider: VOICE_API_PROVIDER_ID,
    agentId: row.agentId ?? undefined,
    toNumber: row.toNumber ?? undefined,
    fromNumber: row.fromNumber ?? undefined,
    status: row.status as JsonCall["status"],
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    duration: row.duration ?? undefined,
    transcript: row.transcript ?? undefined,
    recordingUrl: row.recordingUrl ?? undefined,
    analysis: row.analysis ?? undefined,
    events,
    metadata: row.metadata ?? undefined,
    providerOptions: row.providerOptions ?? undefined,
    raw: row.raw ?? {},
    roomName: row.livekitRoomName ?? undefined,
    livekitSipParticipantId: row.livekitSipParticipantId ?? undefined,
    livekitSipCallId: row.livekitSipCallId ?? undefined,
    livekitSipTrunkId: row.livekitSipTrunkId ?? undefined,
    providerSource: row.providerSource as JsonCall["providerSource"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

function toPhone(row: typeof schema.voicePhoneNumber.$inferSelect): JsonPhoneNumber {
  return {
    id: row.id,
    provider: VOICE_API_PROVIDER_ID,
    number: row.number ?? undefined,
    name: row.name ?? undefined,
    agentId: row.inboundAgentId ?? undefined,
    inboundAgentId: row.inboundAgentId ?? undefined,
    outboundAgentId: row.outboundAgentId ?? undefined,
    webhookUrl: row.webhookUrl ?? undefined,
    areaCode: row.areaCode ?? undefined,
    metadata: row.metadata ?? undefined,
    providerOptions: row.providerOptions ?? undefined,
    raw: row.raw ?? {},
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

function toEvent(row: typeof schema.voiceCallEvent.$inferSelect): JsonCallEvent {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload ?? undefined,
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
  }
}

export type VoiceRepository = ReturnType<typeof createVoiceRepository>

export function createVoiceRepository() {
  return {
    async getLiveKitConfig(userId: string): Promise<RedactedLiveKitConfig> {
      const [row] = await db
        .select()
        .from(schema.livekitConfig)
        .where(eq(schema.livekitConfig.userId, userId))
        .limit(1)
      if (row) {
        const apiKey = decryptSecret(row.encryptedApiKey)
        return {
          configured: true,
          providerSource: "user",
          livekitUrl: decryptSecret(row.encryptedUrl),
          apiKeyPrefix: apiKey.slice(0, 6),
          defaultSipOutboundTrunkId: row.defaultSipOutboundTrunkId ?? undefined,
          updatedAt: iso(row.updatedAt),
        }
      }
      return {
        configured: Boolean(
          process.env.LIVEKIT_URL &&
            process.env.LIVEKIT_API_KEY &&
            process.env.LIVEKIT_API_SECRET
        ),
        providerSource:
          process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET
            ? "platform"
            : "none",
        livekitUrl: process.env.LIVEKIT_URL,
        apiKeyPrefix: process.env.LIVEKIT_API_KEY?.slice(0, 6),
        defaultSipOutboundTrunkId: process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID,
      }
    },

    async upsertLiveKitConfig(
      userId: string,
      input: {
        livekitUrl: string
        apiKey: string
        apiSecret: string
        defaultSipOutboundTrunkId?: string
      }
    ): Promise<RedactedLiveKitConfig> {
      const id = crypto.randomUUID()
      const updatedAt = now()
      await db
        .insert(schema.livekitConfig)
        .values({
          id,
          userId,
          encryptedUrl: encryptSecret(input.livekitUrl),
          encryptedApiKey: encryptSecret(input.apiKey),
          encryptedApiSecret: encryptSecret(input.apiSecret),
          defaultSipOutboundTrunkId: input.defaultSipOutboundTrunkId,
          createdAt: updatedAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.livekitConfig.userId,
          set: {
            encryptedUrl: encryptSecret(input.livekitUrl),
            encryptedApiKey: encryptSecret(input.apiKey),
            encryptedApiSecret: encryptSecret(input.apiSecret),
            defaultSipOutboundTrunkId: input.defaultSipOutboundTrunkId,
            updatedAt,
          },
        })
      return this.getLiveKitConfig(userId)
    },

    async deleteLiveKitConfig(userId: string): Promise<boolean> {
      const rows = await db
        .delete(schema.livekitConfig)
        .where(eq(schema.livekitConfig.userId, userId))
        .returning({ id: schema.livekitConfig.id })
      return rows.length > 0
    },

    async resolveLiveKitCredentials(
      userId: string
    ): Promise<LiveKitCredentials | null> {
      const [row] = await db
        .select()
        .from(schema.livekitConfig)
        .where(eq(schema.livekitConfig.userId, userId))
        .limit(1)
      if (row) {
        return {
          url: decryptSecret(row.encryptedUrl),
          apiKey: decryptSecret(row.encryptedApiKey),
          apiSecret: decryptSecret(row.encryptedApiSecret),
          defaultSipOutboundTrunkId: row.defaultSipOutboundTrunkId ?? undefined,
          source: "user",
        }
      }
      if (
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET
      ) {
        return {
          url: process.env.LIVEKIT_URL,
          apiKey: process.env.LIVEKIT_API_KEY,
          apiSecret: process.env.LIVEKIT_API_SECRET,
          defaultSipOutboundTrunkId: process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID,
          source: "platform",
        }
      }
      return null
    },

    async createAgent(
      userId: string,
      input: Omit<AgentInsert, "id" | "userId" | "createdAt" | "updatedAt">
    ): Promise<JsonAgent> {
      const [row] = await db
        .insert(schema.voiceAgent)
        .values({
          id: crypto.randomUUID(),
          userId,
          ...input,
          raw: input.raw ?? {},
          createdAt: now(),
          updatedAt: now(),
        })
        .returning()
      return toAgent(row)
    },

    async listAgents(
      userId: string,
      q: { limit?: number; cursor?: string }
    ): Promise<PaginatedList<JsonAgent>> {
      const rows = await db
        .select()
        .from(schema.voiceAgent)
        .where(eq(schema.voiceAgent.userId, userId))
      return takePage(
        rows.map(toAgent).sort((a, b) => a.id.localeCompare(b.id)),
        limitOf(q.limit),
        q.cursor
      )
    },

    async getAgent(userId: string, id: string): Promise<JsonAgent | null> {
      const [row] = await db
        .select()
        .from(schema.voiceAgent)
        .where(and(eq(schema.voiceAgent.userId, userId), eq(schema.voiceAgent.id, id)))
        .limit(1)
      return row ? toAgent(row) : null
    },

    async updateAgent(
      userId: string,
      id: string,
      input: Partial<AgentInsert>
    ): Promise<JsonAgent | null> {
      const rows = await db
        .update(schema.voiceAgent)
        .set(cleanUpdate({ ...input, updatedAt: now() }))
        .where(and(eq(schema.voiceAgent.userId, userId), eq(schema.voiceAgent.id, id)))
        .returning()
      return rows[0] ? toAgent(rows[0]) : null
    },

    async deleteAgent(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(schema.voiceAgent)
        .where(and(eq(schema.voiceAgent.userId, userId), eq(schema.voiceAgent.id, id)))
        .returning({ id: schema.voiceAgent.id })
      return rows.length > 0
    },

    async createCall(userId: string, input: CallInsert): Promise<JsonCall> {
      const [row] = await db
        .insert(schema.voiceCall)
        .values({
          ...input,
          id: input.id ?? crypto.randomUUID(),
          userId,
          createdAt: now(),
          updatedAt: now(),
        })
        .returning()
      return toCall(row)
    },

    async listCalls(
      userId: string,
      q: {
        limit?: number
        cursor?: string
        agentId?: string
        phoneNumberId?: string
        callStatus?: string
      }
    ): Promise<PaginatedList<JsonCall>> {
      let rows = await db
        .select()
        .from(schema.voiceCall)
        .where(eq(schema.voiceCall.userId, userId))
      if (q.agentId) rows = rows.filter((row) => row.agentId === q.agentId)
      if (q.phoneNumberId) rows = rows.filter((row) => row.phoneNumberId === q.phoneNumberId)
      if (q.callStatus) rows = rows.filter((row) => row.status === q.callStatus)
      return takePage(
        rows
          .map((row) => toCall(row))
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
        limitOf(q.limit),
        q.cursor
      )
    },

    async getCall(userId: string, id: string): Promise<JsonCall | null> {
      const [row] = await db
        .select()
        .from(schema.voiceCall)
        .where(and(eq(schema.voiceCall.userId, userId), eq(schema.voiceCall.id, id)))
        .limit(1)
      if (!row) return null
      const events = await db
        .select()
        .from(schema.voiceCallEvent)
        .where(and(eq(schema.voiceCallEvent.userId, userId), eq(schema.voiceCallEvent.callId, id)))
      return toCall(
        row,
        events
          .map(toEvent)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      )
    },

    async updateCall(
      userId: string,
      id: string,
      input: Partial<CallInsert>
    ): Promise<JsonCall | null> {
      const rows = await db
        .update(schema.voiceCall)
        .set(cleanUpdate({ ...input, updatedAt: now() }))
        .where(and(eq(schema.voiceCall.userId, userId), eq(schema.voiceCall.id, id)))
        .returning()
      return rows[0] ? toCall(rows[0]) : null
    },

    async deleteCall(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(schema.voiceCall)
        .where(and(eq(schema.voiceCall.userId, userId), eq(schema.voiceCall.id, id)))
        .returning({ id: schema.voiceCall.id })
      return rows.length > 0
    },

    async addCallEvent(
      userId: string,
      callId: string,
      type: string,
      payload?: Record<string, unknown>
    ): Promise<JsonCallEvent> {
      const [row] = await db
        .insert(schema.voiceCallEvent)
        .values({
          id: crypto.randomUUID(),
          userId,
          callId,
          type,
          payload: payload ?? null,
          createdAt: now(),
        })
        .returning()
      return toEvent(row)
    },

    async createPhoneNumber(
      userId: string,
      input: Omit<PhoneInsert, "id" | "userId" | "createdAt" | "updatedAt">
    ): Promise<JsonPhoneNumber> {
      const [row] = await db
        .insert(schema.voicePhoneNumber)
        .values({
          id: crypto.randomUUID(),
          userId,
          ...input,
          raw: input.raw ?? {},
          createdAt: now(),
          updatedAt: now(),
        })
        .returning()
      return toPhone(row)
    },

    async listPhoneNumbers(
      userId: string,
      q: { limit?: number; cursor?: string }
    ): Promise<PaginatedList<JsonPhoneNumber>> {
      const rows = await db
        .select()
        .from(schema.voicePhoneNumber)
        .where(eq(schema.voicePhoneNumber.userId, userId))
      return takePage(
        rows.map(toPhone).sort((a, b) => a.id.localeCompare(b.id)),
        limitOf(q.limit),
        q.cursor
      )
    },

    async getPhoneNumber(
      userId: string,
      id: string
    ): Promise<JsonPhoneNumber | null> {
      const [row] = await db
        .select()
        .from(schema.voicePhoneNumber)
        .where(
          and(eq(schema.voicePhoneNumber.userId, userId), eq(schema.voicePhoneNumber.id, id))
        )
        .limit(1)
      return row ? toPhone(row) : null
    },

    async updatePhoneNumber(
      userId: string,
      id: string,
      input: Partial<PhoneInsert>
    ): Promise<JsonPhoneNumber | null> {
      const rows = await db
        .update(schema.voicePhoneNumber)
        .set(cleanUpdate({ ...input, updatedAt: now() }))
        .where(
          and(eq(schema.voicePhoneNumber.userId, userId), eq(schema.voicePhoneNumber.id, id))
        )
        .returning()
      return rows[0] ? toPhone(rows[0]) : null
    },

    async deletePhoneNumber(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(schema.voicePhoneNumber)
        .where(
          and(eq(schema.voicePhoneNumber.userId, userId), eq(schema.voicePhoneNumber.id, id))
        )
        .returning({ id: schema.voicePhoneNumber.id })
      return rows.length > 0
    },

    jsonRecord,
    optionalRecord,
  }
}
