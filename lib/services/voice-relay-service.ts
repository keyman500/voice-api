import crypto from "node:crypto"
import type { Body } from "files-sdk"
import { createVoiceRepository, type VoiceRepository } from "./voice-repository"
import { getFileStorage, type FileStorage } from "./file-storage"
import { getLlmAdapter, type LlmAdapter } from "./llm-adapter"
import { twilioAdapter, type TwilioAdapter } from "./twilio-adapter"
import {
  creditsForRuntime,
  creditsForTokenUsage,
  getBillingService,
  type BillingService,
  type TokenUsage,
} from "./billing"
import type {
  JsonAgent,
  JsonCall,
  JsonPhoneNumber,
  PaginatedList,
  RedactedTwilioConfig,
} from "./voice-types"
import { VoiceServiceError } from "./voice-service"

type RecordInput = Record<string, unknown> | undefined

function providerOptionString(
  providerOptions: Record<string, unknown> | undefined,
  key: string
) {
  const value = providerOptions?.[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function providerOptionRecord(
  providerOptions: Record<string, unknown> | undefined,
  key: string
) {
  const value = providerOptions?.[key]
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function boolFrom(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value === "true"
  return undefined
}

function intFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function publicBaseUrl(input?: string) {
  const value =
    input ??
    process.env.TWILIO_WEBHOOK_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  return value.replace(/\/+$/, "")
}

function replaceBaseUrl(url: string, baseUrl: string) {
  const current = new URL(url)
  const base = new URL(publicBaseUrl(baseUrl))
  current.protocol = base.protocol
  current.hostname = base.hostname
  current.port = base.port
  return current.toString()
}

function wsBaseUrl(input?: string) {
  const base = publicBaseUrl(input)
  return base.startsWith("https://")
    ? `wss://${base.slice("https://".length)}`
    : base.startsWith("http://")
      ? `ws://${base.slice("http://".length)}`
      : base
}

function formValue(params: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = params[name]
    if (value) return value
  }
  return undefined
}

function normalizeStatus(status: string | undefined): JsonCall["status"] {
  switch (status) {
    case "queued":
    case "ringing":
      return status
    case "in-progress":
    case "answered":
      return "in-progress"
    case "completed":
    case "canceled":
    case "busy":
    case "no-answer":
      return "ended"
    case "failed":
      return "error"
    default:
      return "unknown"
  }
}

function transcriptLine(role: string, text: string) {
  return `${role}: ${text}`
}

function webhookSignature(secret: string, timestamp: string, body: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")
}

function webhookTimeoutMs(seconds: number | undefined) {
  const value = seconds ?? 10
  return Math.max(1, Math.min(30, value)) * 1000
}

function relayOptions(
  agent: JsonAgent | null,
  callId: string,
  baseUrl?: string
) {
  const providerOptions = agent?.providerOptions
  const relay = providerOptionRecord(providerOptions, "conversationRelay")
  return {
    websocketUrl: `${wsBaseUrl(baseUrl)}/api/v1/relay/ws?callId=${encodeURIComponent(callId)}`,
    welcomeGreeting: agent?.firstMessage,
    language: stringValue(relay?.language),
    ttsProvider:
      agent?.voice?.provider === "elevenlabs"
        ? "ElevenLabs"
        : stringValue(relay?.ttsProvider),
    voice: agent?.voice?.voiceId ?? stringValue(relay?.voice),
    transcriptionProvider: stringValue(relay?.transcriptionProvider),
    speechModel: stringValue(relay?.speechModel),
    interruptible:
      (stringValue(relay?.interruptible) as
        | "none"
        | "dtmf"
        | "speech"
        | "any"
        | undefined) ?? "any",
    interruptSensitivity:
      (stringValue(relay?.interruptSensitivity) as
        | "high"
        | "medium"
        | "low"
        | undefined) ?? "high",
    reportInputDuringAgentSpeech:
      (stringValue(relay?.reportInputDuringAgentSpeech) as
        | "none"
        | "dtmf"
        | "speech"
        | "any"
        | undefined) ?? "any",
    customParameters: {
      callId,
      agentId: agent?.id,
    },
  }
}

export type VoiceRelayService = ReturnType<typeof createVoiceRelayService>

export function createVoiceRelayService(
  repo: VoiceRepository = createVoiceRepository(),
  twilio: TwilioAdapter = twilioAdapter,
  llm: LlmAdapter = getLlmAdapter(),
  files: FileStorage = getFileStorage(),
  billing: BillingService = getBillingService()
) {
  const activeGenerations = new Map<string, AbortController>()
  const recentFinalPrompts = new Map<string, { text: string; at: number }>()

  async function recordAiUsage(input: {
    userId: string
    callId: string
    agentId?: string
    kind: "ai_tokens" | "post_call_analysis" | "success_evaluation"
    model: string
    usage?: TokenUsage
  }) {
    const priced = creditsForTokenUsage(input.model, input.usage ?? {})
    if (!priced.priced || priced.credits <= 0) return null
    return billing.recordUsage({
      userId: input.userId,
      callId: input.callId,
      agentId: input.agentId,
      kind: input.kind,
      model: input.model,
      usage: input.usage,
      credits: priced.credits,
      providerCostUsd: priced.providerCostUsd,
      billableUsd: priced.billableUsd,
      raw: { source: "ai-gateway" },
    })
  }

  return {
    async getTwilioConfig(userId: string): Promise<RedactedTwilioConfig> {
      return repo.getTwilioConfig(userId)
    },

    async upsertTwilioConfig(
      userId: string,
      input: {
        accountSid: string
        authToken: string
        defaultFromNumber?: string
        defaultWebhookBaseUrl?: string
        deleteTwilioRecordingAfterBlobUpload?: boolean
      }
    ) {
      return repo.upsertTwilioConfig(userId, input)
    },

    async deleteTwilioConfig(userId: string) {
      return repo.deleteTwilioConfig(userId)
    },

    async testTwilioConfig(userId: string) {
      const credentials = await repo.resolveTwilioCredentials(userId)
      if (!credentials) {
        throw new VoiceServiceError(
          400,
          "TWILIO_CONFIG_MISSING",
          "No user Twilio config or platform Twilio fallback is configured"
        )
      }
      await twilio.testCredentials(credentials)
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
        successEvaluationPrompt?: string
        webhookUrl?: string
        webhookTimeoutSeconds?: number
        webhookSecret?: string
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
        successEvaluationPrompt: input.successEvaluationPrompt,
        webhookUrl: input.webhookUrl,
        webhookTimeoutSeconds: input.webhookTimeoutSeconds,
        webhookSecret: input.webhookSecret,
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
        successEvaluationPrompt?: string
        webhookUrl?: string
        webhookTimeoutSeconds?: number
        webhookSecret?: string
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
        successEvaluationPrompt: input.successEvaluationPrompt,
        webhookUrl: input.webhookUrl,
        webhookTimeoutSeconds: input.webhookTimeoutSeconds,
        webhookSecret: input.webhookSecret,
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
        callSuccessful?: boolean
      }
    ) {
      return repo.listCalls(userId, q)
    },

    async getCall(userId: string, id: string) {
      return repo.getCall(userId, id)
    },

    async createCall(
      userId: string,
      input: {
        agentId?: string
        phoneNumberId?: string
        toNumber: string
        fromNumber?: string
        metadata?: RecordInput
        providerOptions?: RecordInput
      }
    ) {
      const agent = input.agentId
        ? await repo.getAgent(userId, input.agentId)
        : null
      if (input.agentId && !agent) {
        throw new VoiceServiceError(400, "AGENT_NOT_FOUND", "agentId not found")
      }
      await billing.assertCanStartCall(userId)
      const phone = input.phoneNumberId
        ? await repo.getPhoneNumber(userId, input.phoneNumberId)
        : null
      if (input.phoneNumberId && !phone) {
        throw new VoiceServiceError(
          400,
          "PHONE_NUMBER_NOT_FOUND",
          "phoneNumberId not found"
        )
      }
      if (input.phoneNumberId && !input.agentId) {
        throw new VoiceServiceError(
          400,
          "AGENT_REQUIRED",
          "agentId is required when phoneNumberId is used"
        )
      }
      if (input.phoneNumberId && !phone?.number) {
        throw new VoiceServiceError(
          400,
          "PHONE_NUMBER_VALUE_MISSING",
          "Selected phone number does not have a callable number"
        )
      }
      const credentials = await repo.resolveTwilioCredentials(userId)
      if (!credentials) {
        throw new VoiceServiceError(
          400,
          "TWILIO_CONFIG_MISSING",
          "No user Twilio config or platform Twilio fallback is configured"
        )
      }
      const fromNumber =
        phone?.number ?? input.fromNumber ?? credentials.defaultFromNumber
      if (!fromNumber) {
        throw new VoiceServiceError(
          400,
          "TWILIO_FROM_NUMBER_REQUIRED",
          "A Twilio from number is required"
        )
      }
      const baseUrl =
        providerOptionString(input.providerOptions, "webhookBaseUrl") ??
        credentials.defaultWebhookBaseUrl
      const call = await repo.createCall(userId, {
        id: crypto.randomUUID(),
        userId,
        agentId: input.agentId,
        direction: "outbound",
        status: "queued",
        postCallStatus: "pending",
        analysisStatus: "pending",
        successEvaluationStatus: "pending",
        webhookDeliveryStatus: "pending",
        toNumber: input.toNumber,
        fromNumber,
        phoneNumberId: phone?.id,
        providerSource: credentials.source,
        metadata: input.metadata ?? null,
        providerOptions: input.providerOptions ?? null,
        raw: {
          resolvedPhoneNumber: phone
            ? {
                id: phone.id,
                number: phone.number,
                twilioPhoneNumberSid: phone.twilioPhoneNumberSid,
              }
            : undefined,
        },
      })
      await repo.addCallEvent(userId, call.id, "call.queued", {
        toNumber: input.toNumber,
        fromNumber,
        phoneNumberId: phone?.id,
      })
      try {
        const root = publicBaseUrl(baseUrl)
        const created = await twilio.createCall(credentials, {
          to: input.toNumber,
          from: fromNumber,
          voiceUrl: `${root}/api/v1/twilio/voice?callId=${encodeURIComponent(call.id)}`,
          statusCallbackUrl: `${root}/api/v1/twilio/status?callId=${encodeURIComponent(call.id)}`,
          recordingStatusCallbackUrl: `${root}/api/v1/twilio/recording?callId=${encodeURIComponent(call.id)}`,
          record: boolFrom(input.providerOptions?.record) ?? true,
        })
        await repo.addCallEvent(userId, call.id, "twilio.call.created", {
          twilioCallSid: created.sid,
          status: created.status,
        })
        return (
          (await repo.updateCall(userId, call.id, {
            status:
              normalizeStatus(created.status) === "unknown"
                ? "ringing"
                : normalizeStatus(created.status),
            twilioCallSid: created.sid,
            twilioAccountSid: created.accountSid ?? credentials.accountSid,
            providerSource: credentials.source,
            raw: { twilio: { call: created.raw } },
          })) ?? call
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Twilio request failed"
        await repo.addCallEvent(userId, call.id, "call.error", {
          code: "TWILIO_REQUEST_FAILED",
          message,
        })
        await repo.updateCall(userId, call.id, {
          status: "error",
          endedAt: new Date(),
          raw: { error: message },
        })
        throw new VoiceServiceError(502, "TWILIO_REQUEST_FAILED", message)
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
        input.status === "ended" || input.status === "error"
          ? new Date()
          : undefined
      return repo.updateCall(userId, id, {
        metadata: input.metadata ?? current.metadata ?? null,
        providerOptions: input.providerOptions,
        status: input.status,
        endedAt,
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

    async importPhoneNumbers(userId: string) {
      const credentials = await repo.resolveTwilioCredentials(userId)
      if (!credentials) {
        throw new VoiceServiceError(
          400,
          "TWILIO_CONFIG_MISSING",
          "No user Twilio config or platform Twilio fallback is configured"
        )
      }
      const root = publicBaseUrl(credentials.defaultWebhookBaseUrl)
      const voiceUrl = `${root}/api/v1/twilio/voice`
      let incoming
      try {
        incoming = await twilio.listIncomingPhoneNumbers(credentials)
      } catch (error) {
        throw new VoiceServiceError(
          502,
          "TWILIO_PHONE_NUMBER_IMPORT_FAILED",
          error instanceof Error
            ? error.message
            : "Failed to import Twilio phone numbers"
        )
      }
      const existing = await repo.listPhoneNumbers(userId, { limit: 500 })
      const existingBySid = new Map(
        existing.items
          .filter((phone) => phone.twilioPhoneNumberSid)
          .map((phone) => [phone.twilioPhoneNumberSid, phone])
      )
      const existingByNumber = new Map(
        existing.items
          .filter((phone) => phone.number)
          .map((phone) => [phone.number, phone])
      )
      const imported: JsonPhoneNumber[] = []
      for (const remote of incoming) {
        let webhook:
          | { status: "configured"; voiceUrl?: string; voiceMethod?: string }
          | { status: "failed"; error: string }
        try {
          const updated = await twilio.updateIncomingPhoneNumberWebhook(
            credentials,
            {
              sid: remote.sid,
              voiceUrl,
              voiceMethod: "POST",
            }
          )
          webhook = {
            status: "configured",
            voiceUrl: updated.voiceUrl ?? voiceUrl,
            voiceMethod: updated.voiceMethod ?? "POST",
          }
        } catch (error) {
          webhook = {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Twilio webhook update failed",
          }
        }

        const current =
          existingBySid.get(remote.sid) ??
          existingByNumber.get(remote.phoneNumber)
        const providerOptions = {
          ...(current?.providerOptions ?? {}),
          twilioPhoneNumberSid: remote.sid,
          twilioAccountSid: remote.accountSid ?? credentials.accountSid,
          webhook,
          importedFromTwilioAt: new Date().toISOString(),
        }
        const raw = {
          ...(current?.raw && typeof current.raw === "object"
            ? (current.raw as Record<string, unknown>)
            : {}),
          twilio: remote.raw,
          webhook,
        }
        const input = {
          name: current?.name ?? remote.friendlyName,
          number: remote.phoneNumber,
          inboundAgentId: current?.inboundAgentId,
          outboundAgentId: current?.outboundAgentId,
          webhookUrl: voiceUrl,
          areaCode: current?.areaCode,
          twilioPhoneNumberSid: remote.sid,
          twilioAccountSid: remote.accountSid ?? credentials.accountSid,
          providerOptions,
          raw,
        }
        const saved = current
          ? await repo.updatePhoneNumber(userId, current.id, input)
          : await repo.createPhoneNumber(userId, input)
        if (saved) imported.push(saved)
      }
      return {
        items: imported,
        hasMore: false as const,
        imported: imported.length,
      }
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
        twilioPhoneNumberSid: providerOptionString(
          input.providerOptions,
          "twilioPhoneNumberSid"
        ),
        twilioAccountSid: providerOptionString(
          input.providerOptions,
          "twilioAccountSid"
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
        twilioPhoneNumberSid: providerOptionString(
          input.providerOptions,
          "twilioPhoneNumberSid"
        ),
        twilioAccountSid: providerOptionString(
          input.providerOptions,
          "twilioAccountSid"
        ),
      })
    },

    async deletePhoneNumber(userId: string, id: string) {
      return repo.deletePhoneNumber(userId, id)
    },

    async validateTwilioWebhook(input: {
      userId: string
      url: string
      params: Record<string, string>
      signature?: string | null
    }) {
      const credentials = await repo.resolveTwilioCredentials(input.userId)
      if (!credentials) return false
      const candidates = new Set([input.url])
      if (credentials.defaultWebhookBaseUrl) {
        candidates.add(
          replaceBaseUrl(input.url, credentials.defaultWebhookBaseUrl)
        )
      }
      if (process.env.TWILIO_WEBHOOK_BASE_URL) {
        candidates.add(
          replaceBaseUrl(input.url, process.env.TWILIO_WEBHOOK_BASE_URL)
        )
      }
      if (process.env.BETTER_AUTH_URL) {
        candidates.add(replaceBaseUrl(input.url, process.env.BETTER_AUTH_URL))
      }
      return [...candidates].some((url) =>
        twilio.validateSignature({
          authToken: credentials.authToken,
          url,
          params: input.params,
          signature: input.signature,
        })
      )
    },

    async handleVoiceWebhook(input: {
      url: string
      params: Record<string, string>
      signature?: string | null
      callId?: string
    }) {
      let call: JsonCall | null = null
      let userId: string | undefined
      const existing = input.callId
        ? await this.findCallForWebhook(input.callId)
        : null
      if (existing) {
        call = existing.call
        userId = existing.userId
      }
      let agent: JsonAgent | null = null
      let credentialsBaseUrl: string | undefined
      if (!call) {
        const toNumber = formValue(input.params, "To", "to")
        if (!toNumber) {
          throw new VoiceServiceError(
            400,
            "TWILIO_TO_MISSING",
            "Twilio To is required"
          )
        }
        const phone = await repo.findPhoneNumberByNumber(toNumber)
        if (!phone) {
          throw new VoiceServiceError(
            404,
            "PHONE_NUMBER_NOT_FOUND",
            "Phone number not found"
          )
        }
        userId = phone.userId
        if (
          !(await this.validateTwilioWebhook({
            userId,
            url: input.url,
            params: input.params,
            signature: input.signature,
          }))
        ) {
          throw new VoiceServiceError(
            401,
            "TWILIO_SIGNATURE_INVALID",
            "Invalid Twilio signature"
          )
        }
        credentialsBaseUrl = (await repo.resolveTwilioCredentials(userId))
          ?.defaultWebhookBaseUrl
        agent = phone.inboundAgentId
          ? await repo.getAgent(userId, phone.inboundAgentId)
          : null
        try {
          await billing.assertCanStartCall(userId)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "An active subscription is required to receive calls"
          call = await repo.createCall(userId, {
            id: crypto.randomUUID(),
            userId,
            agentId: phone.inboundAgentId,
            direction: "inbound",
            status: "error",
            postCallStatus: "failed",
            analysisStatus: "failed",
            successEvaluationStatus: "failed",
            webhookDeliveryStatus: "skipped",
            toNumber,
            fromNumber: formValue(input.params, "From", "from"),
            phoneNumberId: phone.id,
            twilioCallSid: formValue(input.params, "CallSid", "callSid"),
            twilioAccountSid: formValue(
              input.params,
              "AccountSid",
              "accountSid"
            ),
            providerSource: "user",
            metadata: null,
            providerOptions: null,
            raw: {
              twilio: input.params,
              error: message,
            },
          })
          await repo.addCallEvent(userId, call.id, "billing.call.blocked", {
            phoneNumberId: phone.id,
            toNumber,
            reason: message,
          })
          return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number needs an active subscription before it can receive calls. Please try again later.</Say></Response>'
        }
        if (!agent) {
          call = await repo.createCall(userId, {
            id: crypto.randomUUID(),
            userId,
            agentId: phone.inboundAgentId,
            direction: "inbound",
            status: "error",
            postCallStatus: "failed",
            analysisStatus: "failed",
            successEvaluationStatus: "failed",
            webhookDeliveryStatus: "skipped",
            toNumber,
            fromNumber: formValue(input.params, "From", "from"),
            phoneNumberId: phone.id,
            twilioCallSid: formValue(input.params, "CallSid", "callSid"),
            twilioAccountSid: formValue(
              input.params,
              "AccountSid",
              "accountSid"
            ),
            providerSource: "user",
            metadata: null,
            providerOptions: null,
            raw: {
              twilio: input.params,
              error: "No inbound agent configured for phone number",
            },
          })
          await repo.addCallEvent(
            userId,
            call.id,
            "twilio.voice.unconfigured",
            {
              phoneNumberId: phone.id,
              toNumber,
              reason: "No inbound agent configured for phone number",
            }
          )
          return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This phone number is not configured yet. Please try again later.</Say></Response>'
        }
        call = await repo.createCall(userId, {
          id: crypto.randomUUID(),
          userId,
          agentId: phone.inboundAgentId,
          direction: "inbound",
          status: "ringing",
          postCallStatus: "pending",
          analysisStatus: "pending",
          successEvaluationStatus: "pending",
          webhookDeliveryStatus: "pending",
          toNumber,
          fromNumber: formValue(input.params, "From", "from"),
          phoneNumberId: phone.id,
          twilioCallSid: formValue(input.params, "CallSid", "callSid"),
          twilioAccountSid: formValue(input.params, "AccountSid", "accountSid"),
          providerSource: "user",
          metadata: null,
          providerOptions: null,
          raw: { twilio: input.params },
        })
        await repo.addCallEvent(
          userId,
          call.id,
          "twilio.voice.inbound",
          input.params
        )
      } else {
        if (!userId) {
          throw new VoiceServiceError(
            400,
            "CALL_USER_MISSING",
            "Call user missing"
          )
        }
        if (
          !(await this.validateTwilioWebhook({
            userId,
            url: input.url,
            params: input.params,
            signature: input.signature,
          }))
        ) {
          await repo.addCallEvent(userId, call.id, "twilio.voice.error", {
            code: "TWILIO_SIGNATURE_INVALID",
            url: input.url,
          })
          throw new VoiceServiceError(
            401,
            "TWILIO_SIGNATURE_INVALID",
            "Invalid Twilio signature"
          )
        }
        credentialsBaseUrl = (await repo.resolveTwilioCredentials(userId))
          ?.defaultWebhookBaseUrl
        agent = call.agentId ? await repo.getAgent(userId, call.agentId) : null
      }
      await repo.addCallEvent(userId, call.id, "twilio.voice.answered", {
        callSid: formValue(input.params, "CallSid", "callSid"),
      })
      return twilio.conversationRelayTwiML(
        relayOptions(agent, call.id, credentialsBaseUrl)
      )
    },

    async findCallForWebhook(callId: string) {
      const found = await repo.findCallById(callId)
      return found ? { call: found, userId: found.userId } : null
    },

    async resolveRelayCall(callId: string) {
      const found = await repo.findCallById(callId)
      return found ? { call: found, userId: found.userId } : null
    },

    async handleStatusWebhook(input: {
      userId?: string
      callId?: string
      params: Record<string, string>
    }) {
      const callId = input.callId ?? input.params.callId
      const found = callId ? await repo.findCallById(callId) : null
      const userId =
        input.userId ?? found?.userId ?? process.env.TWILIO_WEBHOOK_USER_ID
      if (!callId || !userId) return { ok: true as const, matched: false }
      const status = normalizeStatus(
        formValue(input.params, "CallStatus", "callStatus", "call_status")
      )
      await repo.updateCall(userId, callId, {
        status,
        twilioCallSid: formValue(
          input.params,
          "CallSid",
          "callSid",
          "call_sid"
        ),
        endedAt:
          status === "ended" || status === "error" ? new Date() : undefined,
        duration: intFrom(
          formValue(
            input.params,
            "CallDuration",
            "callDuration",
            "call_duration"
          )
        ),
      })
      await repo.addCallEvent(
        userId,
        callId,
        "twilio.call.status",
        input.params
      )
      if (status === "ended" || status === "error") {
        const durationSeconds = intFrom(
          formValue(
            input.params,
            "CallDuration",
            "callDuration",
            "call_duration"
          )
        )
        const credits = creditsForRuntime(durationSeconds)
        if (credits > 0) {
          await billing.recordUsage({
            userId,
            callId,
            agentId: found?.agentId ?? undefined,
            kind: "call_runtime",
            durationSeconds,
            credits,
            raw: {
              source: "twilio.status",
              status,
              params: input.params,
            },
          })
        }
      }
      return { ok: true as const, matched: true }
    },

    async handleRecordingWebhook(input: {
      userId?: string
      callId?: string
      params: Record<string, string>
    }) {
      const callId = input.callId ?? input.params.callId
      const found = callId ? await repo.findCallById(callId) : null
      const userId =
        input.userId ?? found?.userId ?? process.env.TWILIO_WEBHOOK_USER_ID
      if (!userId || !callId) return { ok: true as const, matched: false }
      await repo.updateCall(userId, callId, {
        recordingSid: formValue(
          input.params,
          "RecordingSid",
          "recordingSid",
          "recording_sid"
        ),
        recordingStatus: formValue(
          input.params,
          "RecordingStatus",
          "recordingStatus",
          "recording_status"
        ),
        recordingUrl: formValue(
          input.params,
          "RecordingUrl",
          "recordingUrl",
          "recording_url"
        ),
        postCallStatus: "pending",
        analysisStatus: "pending",
        recordingIngestionError: null,
        analysisError: null,
      })
      await repo.addCallEvent(userId, callId, "twilio.recording", input.params)
      return {
        ok: true as const,
        matched: true,
        userId,
        callId,
        recordingSid: formValue(
          input.params,
          "RecordingSid",
          "recordingSid",
          "recording_sid"
        ),
        recordingStatus: formValue(
          input.params,
          "RecordingStatus",
          "recordingStatus",
          "recording_status"
        ),
      }
    },

    async markPostCallWorkflowStarted(input: {
      userId: string
      callId: string
      runId: string
    }) {
      await repo.updateCall(input.userId, input.callId, {
        postCallWorkflowRunId: input.runId,
        postCallStatus: "processing",
        analysisStatus: "pending",
      })
      await repo.addCallEvent(
        input.userId,
        input.callId,
        "post_call.workflow.started",
        {
          runId: input.runId,
        }
      )
    },

    async markPostCallWorkflowFailed(input: {
      userId: string
      callId: string
      error: string
    }) {
      await repo.updateCall(input.userId, input.callId, {
        postCallStatus: "failed",
        recordingIngestionError: input.error,
      })
      await repo.addCallEvent(
        input.userId,
        input.callId,
        "post_call.workflow.failed",
        {
          message: input.error,
        }
      )
    },

    async ingestRecording(input: {
      userId: string
      callId: string
      recordingSid?: string
      body: Body
      contentType?: string
    }) {
      const uploaded = await files.uploadRecording(input)
      await files.headRecording(uploaded.key)
      await repo.updateCall(input.userId, input.callId, {
        recordingStorageKey: uploaded.key,
        recordingStorageProvider: uploaded.provider,
        recordingContentType: uploaded.contentType,
        recordingSizeBytes: uploaded.size,
        recordingIngestedAt: new Date(),
      })
      await repo.addCallEvent(
        input.userId,
        input.callId,
        "recording.stored",
        uploaded
      )
      return uploaded
    },

    async downloadRecording(userId: string, callId: string) {
      const call = await repo.getCall(userId, callId)
      if (!call?.recordingStorageKey) {
        if (
          call?.postCallStatus === "pending" ||
          call?.postCallStatus === "processing"
        ) {
          throw new VoiceServiceError(
            202,
            "RECORDING_PROCESSING",
            "Recording is still processing"
          )
        }
        if (call?.postCallStatus === "failed") {
          throw new VoiceServiceError(
            409,
            "RECORDING_INGESTION_FAILED",
            call.recordingIngestionError ?? "Recording ingestion failed"
          )
        }
        throw new VoiceServiceError(
          404,
          "RECORDING_NOT_FOUND",
          "Recording not found"
        )
      }
      return files.downloadRecording(call.recordingStorageKey)
    },

    async processPostCall(input: {
      userId: string
      callId: string
      failOnNotReady?: boolean
    }) {
      const call = await repo.getCall(input.userId, input.callId)
      if (!call) {
        throw new VoiceServiceError(404, "CALL_NOT_FOUND", "Call not found")
      }
      await repo.updateCall(input.userId, input.callId, {
        postCallStatus: "processing",
        analysisStatus: "processing",
        successEvaluationStatus: "processing",
        recordingIngestionError: null,
        analysisError: null,
        successEvaluationError: null,
      })
      await repo.addCallEvent(input.userId, input.callId, "post_call.started")

      try {
        const credentials = await repo.resolveTwilioCredentials(input.userId)
        if (!credentials) {
          throw new VoiceServiceError(
            400,
            "TWILIO_CONFIG_MISSING",
            "Twilio config is required to ingest recording media"
          )
        }
        const recordingSid = call.recordingSid
        if (!recordingSid) {
          throw new VoiceServiceError(
            400,
            "RECORDING_SID_MISSING",
            "Twilio recording SID is missing"
          )
        }
        const metadata = await twilio.getRecording(credentials, recordingSid)
        await repo.updateCall(input.userId, input.callId, {
          recordingStatus: metadata.status ?? call.recordingStatus,
        })
        await repo.addCallEvent(
          input.userId,
          input.callId,
          "twilio.recording.metadata",
          {
            recordingSid,
            status: metadata.status,
            duration: metadata.duration,
          }
        )
        if (metadata.status && metadata.status !== "completed") {
          throw new VoiceServiceError(
            409,
            "RECORDING_NOT_READY",
            `Twilio recording is ${metadata.status}`
          )
        }
        const media = await twilio.fetchRecordingMedia(
          credentials,
          recordingSid
        )
        const uploaded = await files.uploadRecording({
          callId: input.callId,
          recordingSid,
          body: media.body,
          contentType: media.contentType,
        })
        const stored = await files.headRecording(uploaded.key)
        await repo.updateCall(input.userId, input.callId, {
          recordingStorageKey: uploaded.key,
          recordingStorageProvider: uploaded.provider,
          recordingContentType: stored.type || uploaded.contentType,
          recordingSizeBytes: stored.size || uploaded.size,
          recordingIngestedAt: new Date(),
          postCallStatus: "ready",
        })
        await repo.addCallEvent(
          input.userId,
          input.callId,
          "recording.stored",
          {
            ...uploaded,
            verified: true,
          }
        )

        if (credentials.deleteTwilioRecordingAfterBlobUpload) {
          await twilio.deleteRecording(credentials, recordingSid)
          await repo.updateCall(input.userId, input.callId, {
            recordingDeletedFromTwilioAt: new Date(),
          })
          await repo.addCallEvent(
            input.userId,
            input.callId,
            "twilio.recording.deleted",
            {
              recordingSid,
            }
          )
        }

        let analysisResult: Record<string, unknown> | undefined
        try {
          const refreshed = await repo.getCall(input.userId, input.callId)
          const analysisResponse = await llm.analyzeCall({
            callId: input.callId,
            transcript: refreshed?.transcript ?? call.transcript,
            events: refreshed?.events,
          })
          const analysis = analysisResponse.analysis
          await recordAiUsage({
            userId: input.userId,
            callId: input.callId,
            agentId: refreshed?.agentId ?? call.agentId ?? undefined,
            kind: "post_call_analysis",
            model: analysisResponse.model,
            usage: analysisResponse.usage,
          })
          analysisResult = analysis
          await repo.updateCall(input.userId, input.callId, {
            analysis,
            analysisStatus: "ready",
          })
          await repo.addCallEvent(
            input.userId,
            input.callId,
            "analysis.ready",
            {
              keys: Object.keys(analysis),
            }
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Call analysis failed"
          await repo.updateCall(input.userId, input.callId, {
            analysisStatus: "failed",
            analysisError: message,
          })
          await repo.addCallEvent(
            input.userId,
            input.callId,
            "analysis.failed",
            {
              message,
            }
          )
        }

        try {
          const refreshed = await repo.getCall(input.userId, input.callId)
          const agent = refreshed?.agentId
            ? await repo.getAgent(input.userId, refreshed.agentId)
            : null
          const successResponse = await llm.evaluateCallSuccess({
            callId: input.callId,
            transcript: refreshed?.transcript ?? call.transcript,
            successEvaluationPrompt: agent?.successEvaluationPrompt,
            analysis: analysisResult ?? refreshed?.analysis,
          })
          const successEvaluation = successResponse.evaluation
          await recordAiUsage({
            userId: input.userId,
            callId: input.callId,
            agentId: refreshed?.agentId ?? call.agentId ?? undefined,
            kind: "success_evaluation",
            model: successResponse.model,
            usage: successResponse.usage,
          })
          const nextAnalysis = {
            ...((analysisResult ?? refreshed?.analysis ?? {}) as Record<
              string,
              unknown
            >),
            successEvaluation,
          }
          await repo.updateCall(input.userId, input.callId, {
            analysis: nextAnalysis,
            callSuccessful: successEvaluation.successful,
            successEvaluationStatus: "ready",
            successEvaluationReason: successEvaluation.reason,
          })
          await repo.addCallEvent(
            input.userId,
            input.callId,
            "success_evaluation.ready",
            successEvaluation
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Success evaluation failed"
          await repo.updateCall(input.userId, input.callId, {
            successEvaluationStatus: "failed",
            successEvaluationError: message,
          })
          await repo.addCallEvent(
            input.userId,
            input.callId,
            "success_evaluation.failed",
            { message }
          )
        }

        return { ok: true as const }
      } catch (error) {
        if (
          error instanceof VoiceServiceError &&
          error.code === "RECORDING_NOT_READY" &&
          input.failOnNotReady === false
        ) {
          await repo.addCallEvent(
            input.userId,
            input.callId,
            "post_call.waiting",
            {
              message: error.message,
            }
          )
          throw error
        }
        const message =
          error instanceof Error ? error.message : "Recording ingestion failed"
        await repo.updateCall(input.userId, input.callId, {
          postCallStatus: "failed",
          recordingIngestionError: message,
          analysisStatus: "failed",
          analysisError: message,
          successEvaluationStatus: "failed",
          successEvaluationError: message,
        })
        await repo.addCallEvent(
          input.userId,
          input.callId,
          "post_call.failed",
          {
            message,
          }
        )
        throw error
      }
    },

    async deliverFinishedCallWebhook(input: {
      userId: string
      callId: string
      attempt: number
    }) {
      const call = await repo.getCall(input.userId, input.callId)
      if (!call) {
        throw new VoiceServiceError(404, "CALL_NOT_FOUND", "Call not found")
      }
      const agent = call.agentId
        ? await repo.getAgent(input.userId, call.agentId)
        : null
      if (!agent?.webhookUrl) {
        await repo.updateCall(input.userId, input.callId, {
          webhookDeliveryStatus: "skipped",
          webhookDeliveryAttempts: 0,
          webhookDeliveryError: null,
          webhookLastAttemptAt: new Date(),
        })
        await repo.addCallEvent(input.userId, input.callId, "webhook.skipped", {
          reason: "No agent webhook URL configured",
        })
        return { ok: true as const, skipped: true as const }
      }

      const secret = await repo.resolveAgentWebhookSecret(
        input.userId,
        agent.id
      )
      if (!secret) {
        const message = "Agent webhook secret is required for signed delivery"
        await repo.updateCall(input.userId, input.callId, {
          webhookDeliveryStatus: "failed",
          webhookDeliveryAttempts: input.attempt,
          webhookDeliveryError: message,
          webhookLastAttemptAt: new Date(),
        })
        await repo.addCallEvent(input.userId, input.callId, "webhook.failed", {
          attempt: input.attempt,
          message,
        })
        throw new VoiceServiceError(400, "WEBHOOK_SECRET_MISSING", message)
      }

      const timestamp = new Date().toISOString()
      const payload = {
        type: "call.finished",
        call,
        transcript: call.transcript,
        analysis: call.analysis,
        callSuccessful: call.callSuccessful,
        recording: {
          available: Boolean(call.recordingStorageKey),
          storageProvider: call.recordingStorageProvider,
          contentType: call.recordingContentType,
          sizeBytes: call.recordingSizeBytes,
          ingestedAt: call.recordingIngestedAt,
        },
        createdAt: timestamp,
      }
      const body = JSON.stringify(payload)
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        webhookTimeoutMs(agent.webhookTimeoutSeconds)
      )

      await repo.updateCall(input.userId, input.callId, {
        webhookDeliveryStatus: "processing",
        webhookDeliveryAttempts: input.attempt,
        webhookDeliveryError: null,
        webhookLastAttemptAt: new Date(),
      })

      try {
        const response = await fetch(agent.webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "voice-api-webhooks/1.0",
            "x-voice-api-event": "call.finished",
            "x-voice-api-timestamp": timestamp,
            "x-voice-api-signature": `sha256=${webhookSignature(
              secret,
              timestamp,
              body
            )}`,
          },
          body,
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Webhook responded with status ${response.status}`)
        }
        await repo.updateCall(input.userId, input.callId, {
          webhookDeliveryStatus: "delivered",
          webhookDeliveryAttempts: input.attempt,
          webhookDeliveryError: null,
          webhookDeliveredAt: new Date(),
        })
        await repo.addCallEvent(
          input.userId,
          input.callId,
          "webhook.delivered",
          {
            attempt: input.attempt,
            status: response.status,
          }
        )
        return { ok: true as const, skipped: false as const }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Webhook delivery failed"
        await repo.updateCall(input.userId, input.callId, {
          webhookDeliveryStatus: "failed",
          webhookDeliveryAttempts: input.attempt,
          webhookDeliveryError: message,
          webhookLastAttemptAt: new Date(),
        })
        await repo.addCallEvent(input.userId, input.callId, "webhook.failed", {
          attempt: input.attempt,
          message,
        })
        throw error
      } finally {
        clearTimeout(timeout)
      }
    },

    async handleRelayMessage(input: {
      userId: string
      callId: string
      message: Record<string, unknown>
      send?: (message: unknown) => void
    }) {
      const type = stringValue(input.message.type)
      const call = await repo.getCall(input.userId, input.callId)
      if (!call)
        throw new VoiceServiceError(404, "CALL_NOT_FOUND", "Call not found")
      await repo.addCallEvent(
        input.userId,
        input.callId,
        `relay.${type ?? "message"}`,
        input.message
      )

      if (type === "setup") {
        await repo.updateCall(input.userId, input.callId, {
          status: "in-progress",
          startedAt: new Date(),
          relaySessionId: stringValue(input.message.sessionId),
          twilioCallSid:
            stringValue(input.message.callSid) ?? call.twilioCallSid,
          twilioAccountSid:
            stringValue(input.message.accountSid) ?? call.twilioAccountSid,
        })
        return { ok: true as const }
      }

      if (type === "prompt") {
        const text = stringValue(input.message.voicePrompt)
        if (!text) return { ok: true as const }
        if (input.message.last !== false) {
          const recent = recentFinalPrompts.get(input.callId)
          const nowMs = Date.now()
          if (recent?.text === text && nowMs - recent.at < 1500) {
            await repo.addCallEvent(
              input.userId,
              input.callId,
              "relay.prompt.duplicate",
              input.message
            )
            return { ok: true as const, deduped: true as const }
          }
          recentFinalPrompts.set(input.callId, { text, at: nowMs })
        }
        const items = await repo.listTranscriptItems(input.userId, input.callId)
        await repo.addTranscriptItem(input.userId, {
          callId: input.callId,
          role: "user",
          text,
          status: input.message.last === false ? "partial" : "final",
          sequence: items.length + 1,
          raw: input.message,
        })
        await repo.updateCall(input.userId, input.callId, {
          transcript: [
            ...items.map((item) => transcriptLine(item.role, item.text)),
            transcriptLine("user", text),
          ].join("\n"),
        })
        const agent = call.agentId
          ? await repo.getAgent(input.userId, call.agentId)
          : null
        if (agent && input.message.last !== false && input.send) {
          activeGenerations.get(input.callId)?.abort()
          const controller = new AbortController()
          activeGenerations.set(input.callId, controller)
          const messages = [
            ...items.map((item) => ({
              role:
                item.role === "assistant"
                  ? ("assistant" as const)
                  : ("user" as const),
              content: item.text,
            })),
            { role: "user" as const, content: text },
          ]
          let assistantText = ""
          try {
            const llmResponse = llm.streamResponse({
              agent,
              callId: input.callId,
              messages,
              signal: controller.signal,
            })
            for await (const token of llmResponse.textStream) {
              assistantText += token
              input.send({
                type: "text",
                token,
                last: false,
                interruptible: true,
              })
            }
            await recordAiUsage({
              userId: input.userId,
              callId: input.callId,
              agentId: agent.id,
              kind: "ai_tokens",
              model: llmResponse.model,
              usage: await llmResponse.usage.catch(() => ({})),
            })
          } catch (error) {
            const aborted = controller.signal.aborted
            const message =
              error instanceof Error
                ? error.message
                : "Assistant generation failed"
            await repo.addCallEvent(
              input.userId,
              input.callId,
              "relay.llm.error",
              {
                message,
                aborted,
              }
            )
            if (aborted) return { ok: true as const, aborted: true as const }
            input.send({
              type: "text",
              token: "",
              last: true,
              interruptible: true,
            })
            return { ok: true as const, error: "LLM_STREAM_FAILED" as const }
          } finally {
            if (activeGenerations.get(input.callId) === controller) {
              activeGenerations.delete(input.callId)
            }
          }
          input.send({
            type: "text",
            token: "",
            last: true,
            interruptible: true,
          })
          if (assistantText.trim().length > 0) {
            const nextItems = await repo.listTranscriptItems(
              input.userId,
              input.callId
            )
            await repo.addTranscriptItem(input.userId, {
              callId: input.callId,
              role: "assistant",
              text: assistantText,
              status: "final",
              sequence: nextItems.length + 1,
              raw: { generated: true },
            })
          }
        }
      }

      if (type === "interrupt") {
        activeGenerations.get(input.callId)?.abort()
        activeGenerations.delete(input.callId)
        const text = stringValue(input.message.utteranceUntilInterrupt) ?? ""
        const items = await repo.listTranscriptItems(input.userId, input.callId)
        await repo.addTranscriptItem(input.userId, {
          callId: input.callId,
          role: "assistant",
          text,
          status: "interrupted",
          sequence: items.length + 1,
          raw: input.message,
        })
      }

      return { ok: true as const }
    },
  }
}

let voiceRelayService: VoiceRelayService | undefined

export function getVoiceRelayService() {
  voiceRelayService ??= createVoiceRelayService()
  return voiceRelayService
}

export function setVoiceRelayServiceForTests(
  service: VoiceRelayService | undefined
) {
  voiceRelayService = service
}
