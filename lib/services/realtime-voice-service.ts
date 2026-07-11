import { gateway } from "@ai-sdk/gateway"
import type {
  Experimental_RealtimeClientEvent,
  Experimental_RealtimeModel,
  Experimental_RealtimeServerEvent,
} from "ai"
import { createVoiceRepository, type VoiceRepository } from "./voice-repository"
import { getBillingService, type BillingService } from "./billing"
import { realtimeModel } from "./realtime-models"
import { VoiceServiceError } from "./voice-service"

type SendTwilio = (payload: Record<string, unknown>) => void

function rawRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined
}

function nestedNumber(value: unknown, ...path: string[]) {
  let current: unknown = value
  for (const key of path) current = rawRecord(current)?.[key]
  return typeof current === "number" ? current : 0
}

class RealtimeCallSession {
  private gatewaySocket?: WebSocket
  private model?: Experimental_RealtimeModel
  private streamSid?: string
  private sendQueue = Promise.resolve()
  private persistenceQueue = Promise.resolve()
  private inputBytes = 0
  private outputBytes = 0
  private inputAudioTokens = 0
  private outputAudioTokens = 0
  private billedProviderCostUsd = 0
  private usageQueue = Promise.resolve()
  private checkpointTimer?: ReturnType<typeof setInterval>
  private durationTimer?: ReturnType<typeof setTimeout>
  private pendingModelEvents: Experimental_RealtimeClientEvent[] = []
  private finalized = false

  constructor(
    private readonly input: {
      userId: string
      callId: string
      sendTwilio: SendTwilio
      repo: VoiceRepository
      billing: BillingService
      closeTwilio: (code?: number, reason?: string) => void
    }
  ) {}

  private persist(type: string, payload?: Record<string, unknown>) {
    this.persistenceQueue = this.persistenceQueue
      .then(() =>
        this.input.repo.addCallEvent(
          this.input.userId,
          this.input.callId,
          type,
          payload
        )
      )
      .then(() => undefined)
      .catch(() => undefined)
  }

  private sendModel(event: Experimental_RealtimeClientEvent) {
    if (this.gatewaySocket?.readyState !== WebSocket.OPEN) {
      this.pendingModelEvents.push(event)
      return
    }
    this.sendQueue = this.sendQueue.then(async () => {
      if (!this.model || this.gatewaySocket?.readyState !== WebSocket.OPEN)
        return
      const payload = await this.model.serializeClientEvent(event)
      if (payload != null) this.gatewaySocket.send(JSON.stringify(payload))
    })
  }

  private async connect() {
    const call = await this.input.repo.getCall(
      this.input.userId,
      this.input.callId
    )
    if (!call || call.voiceEngine !== "realtime" || !call.realtimeModel) {
      throw new VoiceServiceError(
        400,
        "REALTIME_CALL_INVALID",
        "Realtime call configuration is missing"
      )
    }
    const agent = call.agentId
      ? await this.input.repo.getAgent(this.input.userId, call.agentId)
      : null
    if (!agent?.model || !agent.voice) {
      throw new VoiceServiceError(
        400,
        "REALTIME_AGENT_INVALID",
        "Realtime agent configuration is missing"
      )
    }
    const factory = gateway.experimental_realtime
    this.model = factory(call.realtimeModel)
    const token = await factory.getToken({ model: call.realtimeModel })
    const config = this.model.getWebSocketConfig(token)
    const socket = new WebSocket(config.url, config.protocols)
    this.gatewaySocket = socket
    socket.onopen = () => {
      this.sendModel({
        type: "session-update",
        config: {
          instructions: agent.model?.systemPrompt,
          voice: agent.voice?.voiceId,
          outputModalities: ["audio"],
          inputAudioFormat: { type: "audio/pcmu" },
          outputAudioFormat: { type: "audio/pcmu" },
          turnDetection: { type: "server-vad" },
        },
      })
      if (agent.firstMessage) {
        this.sendModel({
          type: "response-create",
          options: {
            modalities: ["audio"],
            instructions: `Say exactly this greeting and nothing else: ${JSON.stringify(agent.firstMessage)}`,
          },
        })
      }
      const pending = this.pendingModelEvents.splice(0)
      for (const event of pending) this.sendModel(event)
      this.checkpointTimer = setInterval(
        () => this.queueUsageFlush("checkpoint"),
        60_000
      )
      this.durationTimer = setTimeout(
        () => {
          void this.close("realtime_session_limit").finally(() =>
            this.input.closeTwilio(1000, "Realtime session limit reached")
          )
        },
        (agent.maxDurationSeconds ?? 1440) * 1000
      )
      this.persist("realtime.gateway.connected", { model: call.realtimeModel })
    }
    socket.onmessage = (message) => void this.handleGatewayMessage(message.data)
    socket.onerror = () =>
      this.persist("realtime.gateway.error", {
        message: "Gateway WebSocket error",
      })
    socket.onclose = () => this.persist("realtime.gateway.closed")
    await this.input.repo.updateCall(this.input.userId, this.input.callId, {
      status: "in-progress",
      startedAt: new Date(),
      relaySessionId: undefined,
    })
  }

  async handleTwilioMessage(message: Record<string, unknown>) {
    const type = typeof message.event === "string" ? message.event : undefined
    if (type === "start") {
      const start = rawRecord(message.start)
      this.streamSid =
        typeof start?.streamSid === "string" ? start.streamSid : undefined
      await this.connect()
      this.persist("realtime.twilio.started", { streamSid: this.streamSid })
      return
    }
    if (type === "media") {
      const payload = rawRecord(message.media)?.payload
      if (typeof payload === "string") {
        this.inputBytes += Buffer.from(payload, "base64").byteLength
        this.sendModel({ type: "input-audio-append", audio: payload })
      }
      return
    }
    if (type === "dtmf") {
      this.persist("realtime.dtmf", rawRecord(message.dtmf))
      return
    }
    if (type === "stop") await this.close("twilio_stop")
  }

  private async handleGatewayMessage(data: unknown) {
    if (!this.model) return
    const text = typeof data === "string" ? data : String(data)
    const raw = JSON.parse(text) as unknown
    const health = this.model.getHealthCheckResponse?.(raw)
    if (health && this.gatewaySocket?.readyState === WebSocket.OPEN) {
      this.gatewaySocket.send(JSON.stringify(health))
    }
    const parsed = this.model.parseServerEvent(raw)
    const events = Array.isArray(parsed) ? parsed : [parsed]
    for (const event of events) this.handleGatewayEvent(event)
  }

  private handleGatewayEvent(event: Experimental_RealtimeServerEvent) {
    if (event.type === "audio-delta" && this.streamSid) {
      this.outputBytes += Buffer.from(event.delta, "base64").byteLength
      this.input.sendTwilio({
        event: "media",
        streamSid: this.streamSid,
        media: { payload: event.delta },
      })
    } else if (event.type === "audio-done" && this.streamSid) {
      this.input.sendTwilio({
        event: "mark",
        streamSid: this.streamSid,
        mark: { name: `${event.responseId}:${event.itemId}` },
      })
    } else if (event.type === "speech-started" && this.streamSid) {
      this.input.sendTwilio({ event: "clear", streamSid: this.streamSid })
      this.sendModel({ type: "response-cancel" })
      this.persist("realtime.interrupt", { itemId: event.itemId })
    } else if (event.type === "error") {
      this.persist("realtime.model.error", {
        code: event.code,
        message: event.message,
      })
    } else if (
      event.type === "audio-transcript-done" ||
      event.type === "input-transcription-completed"
    ) {
      this.persist("realtime.transcript.diagnostic", {
        role: event.type === "audio-transcript-done" ? "assistant" : "user",
        text:
          event.type === "audio-transcript-done"
            ? event.transcript
            : event.transcript,
      })
    } else if (event.type === "response-done") {
      const raw = event.raw
      this.inputAudioTokens += nestedNumber(
        raw,
        "response",
        "usage",
        "input_token_details",
        "audio_tokens"
      )
      this.outputAudioTokens += nestedNumber(
        raw,
        "response",
        "usage",
        "output_token_details",
        "audio_tokens"
      )
    }
  }

  private queueUsageFlush(source: "checkpoint" | "final") {
    this.usageQueue = this.usageQueue
      .then(() => this.flushUsage(source))
      .catch((error) => {
        this.persist("billing.usage.failed", {
          kind: "realtime_audio",
          message:
            error instanceof Error ? error.message : "Usage flush failed",
        })
      })
  }

  private async flushUsage(source: "checkpoint" | "final") {
    const call = await this.input.repo.getCall(
      this.input.userId,
      this.input.callId
    )
    const capability = realtimeModel(call?.realtimeModel)
    const inputSeconds = this.inputBytes / 8000
    const outputSeconds = this.outputBytes / 8000
    let totalProviderCostUsd = 0
    if (capability?.pricingUnit === "audio-minute") {
      totalProviderCostUsd = ((inputSeconds + outputSeconds) / 60) * 0.05
    } else if (capability?.pricingUnit === "audio-token") {
      const inputTokens = this.inputAudioTokens || inputSeconds * 10
      const outputTokens = this.outputAudioTokens || outputSeconds * 20
      totalProviderCostUsd =
        inputTokens * (capability.audioInputUsdPerToken ?? 0) +
        outputTokens * (capability.audioOutputUsdPerToken ?? 0)
    }
    const providerCostUsd = Math.max(
      0,
      totalProviderCostUsd - this.billedProviderCostUsd
    )
    if (providerCostUsd <= 0 || !call?.realtimeModel) return
    await this.input.billing.recordUsage({
      userId: this.input.userId,
      callId: this.input.callId,
      agentId: call.agentId,
      kind: "realtime_audio",
      model: call.realtimeModel,
      durationSeconds: Math.ceil(inputSeconds + outputSeconds),
      credits: providerCostUsd * 1.5 * 100,
      providerCostUsd,
      billableUsd: providerCostUsd * 1.5,
      raw: {
        source,
        inputSeconds,
        outputSeconds,
        inputAudioTokens: this.inputAudioTokens,
        outputAudioTokens: this.outputAudioTokens,
      },
    })
    this.billedProviderCostUsd = totalProviderCostUsd
  }

  async close(reason: string) {
    if (this.finalized) return
    this.finalized = true
    if (this.checkpointTimer) clearInterval(this.checkpointTimer)
    if (this.durationTimer) clearTimeout(this.durationTimer)
    this.gatewaySocket?.close()
    const call = await this.input.repo.getCall(
      this.input.userId,
      this.input.callId
    )
    const inputSeconds = this.inputBytes / 8000
    const outputSeconds = this.outputBytes / 8000
    this.queueUsageFlush("final")
    await this.usageQueue
    await this.input.repo.updateCall(this.input.userId, this.input.callId, {
      status: "ended",
      endedAt: call?.endedAt ? new Date(call.endedAt) : new Date(),
      terminalReason: reason,
    })
    this.persist("realtime.session.closed", {
      reason,
      inputSeconds,
      outputSeconds,
    })
    await this.persistenceQueue
  }
}

export function createRealtimeVoiceService(
  repo: VoiceRepository = createVoiceRepository(),
  billing: BillingService = getBillingService()
) {
  const sessions = new Map<string, RealtimeCallSession>()
  return {
    createSession(input: {
      userId: string
      callId: string
      sendTwilio: SendTwilio
      closeTwilio: (code?: number, reason?: string) => void
    }) {
      const session = new RealtimeCallSession({ ...input, repo, billing })
      sessions.set(input.callId, session)
      return session
    },
    async closeSession(callId: string, reason: string) {
      const session = sessions.get(callId)
      sessions.delete(callId)
      await session?.close(reason)
    },
  }
}

let realtimeVoiceService:
  | ReturnType<typeof createRealtimeVoiceService>
  | undefined

export function getRealtimeVoiceService() {
  realtimeVoiceService ??= createRealtimeVoiceService()
  return realtimeVoiceService
}
