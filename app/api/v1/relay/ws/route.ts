import {
  experimental_upgradeWebSocket,
  type WebSocketData,
} from "@vercel/functions"
import {
  verifyVoiceRelayToken,
  websocketSignatureUrl,
} from "@/lib/services/voice-relay-token"

function messageText(data: WebSocketData) {
  return typeof data === "string"
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data).toString("utf8")
      : Array.isArray(data)
        ? Buffer.concat(data).toString("utf8")
        : Buffer.from(data).toString("utf8")
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const callId = url.searchParams.get("callId")
  const token = url.searchParams.get("token")

  if (!callId || !token) {
    return new Response("Missing relay credentials", { status: 400 })
  }

  const relayToken = verifyVoiceRelayToken(token, { callId })
  if (!relayToken) {
    return new Response("Invalid relay credentials", { status: 403 })
  }

  return experimental_upgradeWebSocket((ws) => {
    const session = import("@/lib/services/voice-relay-service")
      .then(async ({ getVoiceRelayService }) => {
        const service = getVoiceRelayService()
        const relayCall = await service.resolveRelayCall(callId)
        if (!relayCall) {
          throw new Error("Relay call ownership validation failed")
        }
        const signatureValid = await service.validateTwilioWebhook({
          userId: relayCall.userId,
          url: websocketSignatureUrl(request.url),
          params: {},
          signature: request.headers.get("x-twilio-signature"),
        })
        if (!signatureValid) {
          throw new Error("Twilio WebSocket signature validation failed")
        }
        return { service, userId: relayCall.userId }
      })
      .catch((error) => {
        ws.close(1008, "Relay authentication failed")
        throw error
      })

    // Observe authentication failures even if Twilio disconnects before sending
    // its setup frame. Message processing remains blocked on this promise.
    void session.catch(() => undefined)

    ws.on("message", (data: WebSocketData) => {
      void session
        .then(async ({ service, userId }) => {
          try {
            const message = JSON.parse(messageText(data)) as Record<
              string,
              unknown
            >
            await service.handleRelayMessage({
              userId,
              callId,
              message,
              send: (payload) => ws.send(JSON.stringify(payload)),
            })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Relay message failed"
            await service.handleRelayError({ userId, callId, message })
            ws.close(1011, "Relay message failed")
          }
        })
        .catch(() => undefined)
    })

    ws.on("close", (code?: number, reason?: Buffer | string) => {
      void session
        .then(({ service, userId }) =>
          service.handleRelayClosed({
            userId,
            callId,
            code,
            reason: Buffer.isBuffer(reason) ? reason.toString("utf8") : reason,
          })
        )
        .catch(() => undefined)
    })

    ws.on("error", (error: Error) => {
      void session
        .then(({ service, userId }) =>
          service.handleRelayError({
            userId,
            callId,
            message: error.message,
          })
        )
        .catch(() => undefined)
    })
  })
}
