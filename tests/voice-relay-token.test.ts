import { describe, expect, it } from "@jest/globals"
import {
  createVoiceRelayToken,
  verifyVoiceRelayToken,
  websocketSignatureUrl,
} from "@/lib/services/voice-relay-token"

describe("voice relay tokens", () => {
  it("authenticates the call before the WebSocket upgrade path loads services", () => {
    const token = createVoiceRelayToken({
      callId: "call-1",
      expiresInSeconds: 60,
      now: 1_000_000,
    })

    expect(
      verifyVoiceRelayToken(token, { callId: "call-1", now: 1_030_000 })
    ).toEqual({
      version: 1,
      callId: "call-1",
      expiresAt: 1060,
    })
  })

  it("rejects tampered, mismatched, and expired tokens", () => {
    const token = createVoiceRelayToken({
      callId: "call-1",
      expiresInSeconds: 60,
      now: 1_000_000,
    })

    expect(
      verifyVoiceRelayToken(`${token}x`, {
        callId: "call-1",
        now: 1_030_000,
      })
    ).toBeNull()
    expect(
      verifyVoiceRelayToken(token, {
        callId: "call-2",
        now: 1_030_000,
      })
    ).toBeNull()
    expect(
      verifyVoiceRelayToken(token, {
        callId: "call-1",
        now: 1_061_000,
      })
    ).toBeNull()
  })

  it("validates WebSocket signatures against the ws or wss URL", () => {
    expect(
      websocketSignatureUrl(
        "https://voice.example.com/api/v1/relay/ws?callId=call-1"
      )
    ).toBe("wss://voice.example.com/api/v1/relay/ws?callId=call-1")
    expect(
      websocketSignatureUrl(
        "http://localhost:3000/api/v1/relay/ws?callId=call-1"
      )
    ).toBe("ws://localhost:3000/api/v1/relay/ws?callId=call-1")
  })
})
