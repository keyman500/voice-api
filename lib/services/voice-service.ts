import { liveKitAdapter, type LiveKitAdapter } from "./livekit-adapter"
import {
  createVoiceRepository,
  type VoiceRepository,
} from "./voice-repository"
import type {
  JsonAgent,
  JsonCall,
  JsonPhoneNumber,
  PaginatedList,
  RedactedLiveKitConfig,
} from "./voice-types"

export class VoiceServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
  }
}

type RecordInput = Record<string, unknown> | undefined

function metadataWithExtras(
  metadata: RecordInput,
  extras: Record<string, unknown>
) {
  const next = { ...(metadata ?? {}), ...extras }
  return Object.keys(next).length ? next : null
}

function roomNameFor(callId: string) {
  return `voice-api-call-${callId}`
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function providerOptionString(
  providerOptions: Record<string, unknown> | undefined,
  key: string
) {
  return providerOptions ? stringFrom(providerOptions[key]) : undefined
}

export type VoiceService = ReturnType<typeof createVoiceService>

export function createVoiceService(
  repo: VoiceRepository = createVoiceRepository(),
  livekit: LiveKitAdapter = liveKitAdapter
) {
  return {
    async getLiveKitConfig(userId: string): Promise<RedactedLiveKitConfig> {
      return repo.getLiveKitConfig(userId)
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
      return repo.upsertLiveKitConfig(userId, input)
    },

    async deleteLiveKitConfig(userId: string) {
      return repo.deleteLiveKitConfig(userId)
    },

    async testLiveKitConfig(userId: string) {
      const credentials = await repo.resolveLiveKitCredentials(userId)
      if (!credentials) {
        throw new VoiceServiceError(
          400,
          "LIVEKIT_CONFIG_MISSING",
          "No user LiveKit config or platform LiveKit fallback is configured"
        )
      }
      await livekit.testCredentials(credentials)
      return { ok: true as const, providerSource: credentials.source }
    },

    async listAgents(
      userId: string,
      q: { limit?: number; cursor?: string }
    ): Promise<PaginatedList<JsonAgent>> {
      return repo.listAgents(userId, q)
    },

    async getAgent(userId: string, id: string) {
      return repo.getAgent(userId, id)
    },

    async createAgent(
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
        metadata?: RecordInput
        providerOptions?: RecordInput
      }
    ) {
      return repo.createAgent(userId, {
        name: input.name,
        voice: input.voice ?? null,
        model: input.model ?? null,
        firstMessage: input.firstMessage,
        maxDurationSeconds: input.maxDurationSeconds,
        backgroundSound: input.backgroundSound,
        voicemailMessage: input.voicemailMessage,
        webhookUrl: input.webhookUrl,
        webhookTimeoutSeconds: input.webhookTimeoutSeconds,
        metadata: input.metadata ?? null,
        providerOptions: input.providerOptions ?? null,
        raw: {},
      })
    },

    async updateAgent(
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
        metadata?: RecordInput
        providerOptions?: RecordInput
      }
    ) {
      return repo.updateAgent(userId, id, {
        name: input.name,
        voice: input.voice ?? undefined,
        model: input.model ?? undefined,
        firstMessage: input.firstMessage,
        maxDurationSeconds: input.maxDurationSeconds,
        backgroundSound: input.backgroundSound,
        voicemailMessage: input.voicemailMessage,
        webhookUrl: input.webhookUrl,
        webhookTimeoutSeconds: input.webhookTimeoutSeconds,
        metadata: input.metadata,
        providerOptions: input.providerOptions,
      })
    },

    async deleteAgent(userId: string, id: string) {
      return repo.deleteAgent(userId, id)
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
      return repo.listCalls(userId, q)
    },

    async getCall(userId: string, id: string) {
      return repo.getCall(userId, id)
    },

    async createCall(
      userId: string,
      input: {
        agentId?: string
        toNumber: string
        fromNumber?: string
        metadata?: RecordInput
        providerOptions?: RecordInput
      }
    ) {
      if (input.agentId) {
        const agent = await repo.getAgent(userId, input.agentId)
        if (!agent) {
          throw new VoiceServiceError(400, "AGENT_NOT_FOUND", "agentId not found")
        }
      }

      const callId = crypto.randomUUID()
      const roomName =
        providerOptionString(input.providerOptions, "roomName") ?? roomNameFor(callId)
      let call = await repo.createCall(userId, {
        id: callId,
        userId,
        agentId: input.agentId,
        direction: "outbound",
        status: "queued",
        toNumber: input.toNumber,
        fromNumber: input.fromNumber,
        livekitRoomName: roomName,
        providerSource: "user",
        metadata: input.metadata ?? null,
        providerOptions: input.providerOptions ?? null,
        raw: {},
      })
      await repo.addCallEvent(userId, call.id, "call.queued", {
        toNumber: input.toNumber,
        roomName,
      })

      const credentials = await repo.resolveLiveKitCredentials(userId)
      if (!credentials) {
        await repo.addCallEvent(userId, call.id, "call.error", {
          code: "LIVEKIT_CONFIG_MISSING",
        })
        await repo.updateCall(userId, call.id, {
          status: "error",
          endedAt: new Date(),
          raw: { error: "LIVEKIT_CONFIG_MISSING" },
        })
        throw new VoiceServiceError(
          400,
          "LIVEKIT_CONFIG_MISSING",
          "No user LiveKit config or platform LiveKit fallback is configured"
        )
      }

      const sipTrunkId =
        providerOptionString(input.providerOptions, "sipTrunkId") ??
        credentials.defaultSipOutboundTrunkId
      if (!sipTrunkId) {
        await repo.addCallEvent(userId, call.id, "call.error", {
          code: "LIVEKIT_SIP_TRUNK_REQUIRED",
        })
        await repo.updateCall(userId, call.id, {
          status: "error",
          endedAt: new Date(),
          providerSource: credentials.source,
          raw: { error: "LIVEKIT_SIP_TRUNK_REQUIRED" },
        })
        throw new VoiceServiceError(
          400,
          "LIVEKIT_SIP_TRUNK_REQUIRED",
          "A LiveKit SIP outbound trunk id is required"
        )
      }

      try {
        const room = await livekit.createRoom(credentials, roomName)
        await repo.addCallEvent(userId, call.id, "livekit.room.created", {
          roomName,
          room,
          providerSource: credentials.source,
        })
        const participant = await livekit.createSipParticipant(credentials, {
          sipTrunkId,
          phoneNumber: input.toNumber,
          roomName,
          participantIdentity: `phone-${call.id}`,
          participantName: input.toNumber,
        })
        await repo.addCallEvent(userId, call.id, "livekit.sip_participant.created", {
          participantIdentity: participant.participantIdentity,
          sipCallId: participant.sipCallId,
          attributes: participant.attributes,
        })
        call =
          (await repo.updateCall(userId, call.id, {
            status: "ringing",
            startedAt: new Date(),
            livekitSipParticipantId: participant.participantIdentity,
            livekitSipCallId: participant.sipCallId,
            livekitSipTrunkId: sipTrunkId,
            providerSource: credentials.source,
            metadata: metadataWithExtras(input.metadata, {
              billingProviderSource: credentials.source,
            }),
            raw: {
              livekit: {
                room,
                sipParticipant: participant.raw,
              },
            },
          })) ?? call
        return call
      } catch (error) {
        const message = error instanceof Error ? error.message : "LiveKit request failed"
        await repo.addCallEvent(userId, call.id, "call.error", {
          code: "LIVEKIT_REQUEST_FAILED",
          message,
        })
        await repo.updateCall(userId, call.id, {
          status: "error",
          endedAt: new Date(),
          providerSource: credentials.source,
          raw: { error: message },
        })
        throw new VoiceServiceError(502, "LIVEKIT_REQUEST_FAILED", message)
      }
    },

    async updateCall(
      userId: string,
      id: string,
      input: {
        metadata?: RecordInput
        providerOptions?: RecordInput
        status?: JsonCall["status"]
      }
    ) {
      const current = await repo.getCall(userId, id)
      if (!current) return null
      const endedAt =
        input.status === "ended" || input.status === "error" ? new Date() : undefined
      const startedAt = current.startedAt ? new Date(current.startedAt) : undefined
      const duration =
        startedAt && endedAt
          ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
          : undefined
      return repo.updateCall(userId, id, {
        metadata: metadataWithExtras(current.metadata, input.metadata ?? {}),
        providerOptions: input.providerOptions,
        status: input.status,
        endedAt,
        duration,
      })
    },

    async deleteCall(userId: string, id: string) {
      return repo.deleteCall(userId, id)
    },

    async listPhoneNumbers(
      userId: string,
      q: { limit?: number; cursor?: string }
    ): Promise<PaginatedList<JsonPhoneNumber>> {
      return repo.listPhoneNumbers(userId, q)
    },

    async getPhoneNumber(userId: string, id: string) {
      return repo.getPhoneNumber(userId, id)
    },

    async createPhoneNumber(
      userId: string,
      input: {
        name?: string
        inboundAgentId?: string
        outboundAgentId?: string
        webhookUrl?: string
        areaCode?: string
        providerOptions?: RecordInput
        number?: string
      }
    ) {
      return repo.createPhoneNumber(userId, {
        name: input.name,
        inboundAgentId: input.inboundAgentId,
        outboundAgentId: input.outboundAgentId,
        webhookUrl: input.webhookUrl,
        areaCode: input.areaCode,
        number: input.number,
        livekitSipInboundTrunkId: providerOptionString(
          input.providerOptions,
          "livekitSipInboundTrunkId"
        ),
        livekitSipOutboundTrunkId: providerOptionString(
          input.providerOptions,
          "livekitSipOutboundTrunkId"
        ),
        providerOptions: input.providerOptions ?? null,
        raw: {},
      })
    },

    async updatePhoneNumber(
      userId: string,
      id: string,
      input: {
        name?: string
        inboundAgentId?: string
        outboundAgentId?: string
        webhookUrl?: string
        providerOptions?: RecordInput
        number?: string
      }
    ) {
      return repo.updatePhoneNumber(userId, id, {
        name: input.name,
        inboundAgentId: input.inboundAgentId,
        outboundAgentId: input.outboundAgentId,
        webhookUrl: input.webhookUrl,
        number: input.number,
        providerOptions: input.providerOptions,
        livekitSipInboundTrunkId: providerOptionString(
          input.providerOptions,
          "livekitSipInboundTrunkId"
        ),
        livekitSipOutboundTrunkId: providerOptionString(
          input.providerOptions,
          "livekitSipOutboundTrunkId"
        ),
      })
    },

    async deletePhoneNumber(userId: string, id: string) {
      return repo.deletePhoneNumber(userId, id)
    },
  }
}

let voiceService: VoiceService | undefined

export function getVoiceService() {
  voiceService ??= createVoiceService()
  return voiceService
}

export function setVoiceServiceForTests(service: VoiceService | undefined) {
  voiceService = service
}
