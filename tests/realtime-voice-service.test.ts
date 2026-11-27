import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@ai-sdk/gateway", () => {
  const model = {
    getWebSocketConfig: jest.fn((options: { url: string }) => ({
      url: options.url,
      protocols: ["ai-gateway-realtime.v1"],
    })),
    serializeClientEvent: jest.fn(async (event: unknown) => event),
    parseServerEvent: jest.fn((raw: unknown) => raw),
  }
  const factory = Object.assign(jest.fn(() => model), {
    getToken: jest.fn(async () => ({
      token: "vcst_test",
      url: "wss://gateway.example/realtime",
    })),
  })
  return { gateway: { experimental_realtime: factory } }
})

/* eslint-disable @typescript-eslint/no-require-imports */
const { gateway } = require("@ai-sdk/gateway") as {
  gateway: {
    experimental_realtime: jest.Mock & {
      getToken: jest.Mock
    }
  }
}
const {
  createRealtimeVoiceService,
} = require("@/lib/services/realtime-voice-service") as {
  createRealtimeVoiceService: (
    repo: unknown,
    billing: unknown
  ) => {
    createSession: (input: {
      userId: string
      callId: string
      sendTwilio: (payload: Record<string, unknown>) => void
      closeTwilio: (code?: number, reason?: string) => void
    }) => {
      handleTwilioMessage: (message: Record<string, unknown>) => Promise<void>
    }
    closeSession: (callId: string, reason: string) => Promise<void>
  }
}
const { realtimeModel } = require("@/lib/services/realtime-models") as {
  realtimeModel: (model?: string) => {
    estimatedProviderUsdPerMinute: number | null
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []

  constructor(
    public url: string,
    public protocols?: string[]
  ) {
    sockets.push(this)
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN
      this.onopen?.()
    })
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

const sockets: FakeWebSocket[] = []
const originalWebSocket = globalThis.WebSocket

function audioPayload(bytes: number) {
  return Buffer.alloc(bytes, 1).toString("base64")
}

describe("realtime voice service", () => {
  beforeEach(() => {
    sockets.length = 0
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
    jest.useFakeTimers()
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    jest.useRealTimers()
  })

  it("connects a retired model through Grok Voice 3.0 and bills session audio at the catalog rate", async () => {
    const call = {
      id: "call-1",
      userId: "user-1",
      agentId: "agent-1",
      voiceEngine: "realtime",
      realtimeModel: "xai/grok-voice-think-fast-1.0",
    }
    const repo = {
      getCall: jest.fn(async () => call),
      getAgent: jest.fn(async () => ({
        id: "agent-1",
        model: {
          provider: "xai",
          model: "xai/grok-voice-think-fast-1.0",
          systemPrompt: "Be brief.",
        },
        voice: { voiceId: "eve", provider: "xai" },
      })),
      updateCall: jest.fn(async () => call),
      addCallEvent: jest.fn(async () => ({ id: "event-1" })),
    }
    const billing = {
      recordUsage: jest.fn(async (input: unknown) => input),
    }
    const service = createRealtimeVoiceService(repo, billing)
    const session = service.createSession({
      userId: "user-1",
      callId: "call-1",
      sendTwilio: () => undefined,
      closeTwilio: () => undefined,
    })

    await session.handleTwilioMessage({
      event: "start",
      start: { streamSid: "MZ1" },
    })
    await Promise.resolve()

    expect(gateway.experimental_realtime).toHaveBeenCalledWith(
      "spacexai/grok-voice-3.0"
    )
    expect(gateway.experimental_realtime.getToken).toHaveBeenCalledWith({
      model: "spacexai/grok-voice-3.0",
    })
    expect(sockets[0]?.url).toBe("wss://gateway.example/realtime")
    expect(repo.updateCall).toHaveBeenCalledWith("user-1", "call-1", {
      status: "in-progress",
      realtimeModel: "spacexai/grok-voice-3.0",
      startedAt: expect.any(Date),
      relaySessionId: undefined,
    })

    const rate =
      realtimeModel("spacexai/grok-voice-3.0")?.estimatedProviderUsdPerMinute ??
      0
    await session.handleTwilioMessage({
      event: "media",
      media: { payload: audioPayload(8000) },
    })
    await jest.advanceTimersByTimeAsync(60_000)

    const checkpointCost = (1 / 60) * rate
    expect(billing.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "realtime_audio",
        model: "spacexai/grok-voice-3.0",
        providerCostUsd: checkpointCost,
        credits: checkpointCost * 1.5 * 100,
        billableUsd: checkpointCost * 1.5,
        durationSeconds: 1,
        raw: expect.objectContaining({
          source: "checkpoint",
          inputSeconds: 1,
          outputSeconds: 0,
        }),
      })
    )

    await session.handleTwilioMessage({
      event: "media",
      media: { payload: audioPayload(8000) },
    })
    await service.closeSession("call-1", "twilio_stop")

    const finalDelta = (2 / 60) * rate - checkpointCost
    expect(billing.recordUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "realtime_audio",
        model: "spacexai/grok-voice-3.0",
        providerCostUsd: finalDelta,
        credits: finalDelta * 1.5 * 100,
        billableUsd: finalDelta * 1.5,
        durationSeconds: 2,
        raw: expect.objectContaining({
          source: "final",
          inputSeconds: 2,
          outputSeconds: 0,
        }),
      })
    )
  })
})
