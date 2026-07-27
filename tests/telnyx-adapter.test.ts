import { describe, expect, it } from "@jest/globals"
import crypto from "node:crypto"
import { telnyxAdapter } from "@/lib/services/telnyx-adapter"

describe("telnyxAdapter", () => {
  it("builds TeXML Stream markup with parameters", () => {
    const xml = telnyxAdapter.streamTeXML({
      websocketUrl: "wss://example.com/api/v1/realtime/ws/call/token",
      welcomeGreeting: "Hello",
      recordingStatusCallbackUrl:
        "https://example.com/api/v1/telnyx/recording?callId=call-1",
      customParameters: {
        callId: "call-1",
        agentId: "agent-1",
      },
    })

    expect(xml).toContain("<Say>Hello</Say>")
    expect(xml).toContain(
      'url="wss://example.com/api/v1/realtime/ws/call/token"'
    )
    expect(xml).toContain('track="both_tracks"')
    expect(xml).toContain('name="callId" value="call-1"')
    expect(xml).toContain(
      'recordingStatusCallback="https://example.com/api/v1/telnyx/recording?callId=call-1"'
    )
  })

  it("builds Say TeXML responses", () => {
    expect(telnyxAdapter.sayTeXML('Try "again" later')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Try &quot;again&quot; later</Say></Response>'
    )
  })

  it("verifies ed25519 webhook signatures without network calls", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519")
    const publicKeyDer = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64")
    const timestamp = String(Math.floor(Date.now() / 1000))
    const rawBody = '{"data":{"event_type":"call.initiated"}}'
    const signature = crypto
      .sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey)
      .toString("base64")

    expect(
      telnyxAdapter.validateSignature({
        publicKey: publicKeyDer,
        rawBody,
        signature,
        timestamp,
      })
    ).toBe(true)

    expect(
      telnyxAdapter.validateSignature({
        publicKey: publicKeyDer,
        rawBody,
        signature: "bad-signature",
        timestamp,
      })
    ).toBe(false)
  })

  it("rejects stale webhook timestamps", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519")
    const publicKeyDer = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64")
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600)
    const rawBody = "CallSid=v3%3A1"
    const signature = crypto
      .sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey)
      .toString("base64")

    expect(
      telnyxAdapter.validateSignature({
        publicKey: publicKeyDer,
        rawBody,
        signature,
        timestamp,
        toleranceSeconds: 300,
      })
    ).toBe(false)
  })
})
