import {
  experimental_upgradeWebSocket,
  type WebSocketData,
} from "@vercel/functions"
import { getRealtimeVoiceService } from "@/lib/services/realtime-voice-service"
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
  if (!callId || !token)
    return new Response("Missing realtime credentials", { status: 400 })
  if (!verifyVoiceRelayToken(token, { callId })) {
    return new Response("Invalid realtime credentials", { status: 403 })
  }

  return experimental_upgradeWebSocket((ws) => {
    const authenticated = import("@/lib/services/voice-relay-service").then(
      async ({ getVoiceRelayService }) => {
        const voice = getVoiceRelayService()
        const call = await voice.resolveRelayCall(callId)
        if (!call || call.call.voiceEngine !== "realtime") {
          throw new Error("Realtime call validation failed")
        }
        const valid = await voice.validateTwilioWebhook({
          userId: call.userId,
          url: websocketSignatureUrl(request.url),
          params: {},
          signature: request.headers.get("x-twilio-signature"),
        })
        if (!valid)
          throw new Error("Twilio WebSocket signature validation failed")
        const session = getRealtimeVoiceService().createSession({
          userId: call.userId,
          callId,
          sendTwilio: (payload) => ws.send(JSON.stringify(payload)),
          closeTwilio: (code, reason) => ws.close(code, reason),
        })
        return { session }
      }
    )

    void authenticated.catch(() =>
      ws.close(1008, "Realtime authentication failed")
    )
    ws.on("message", (data: WebSocketData) => {
      void authenticated
        .then(({ session }) =>
          session.handleTwilioMessage(
            JSON.parse(messageText(data)) as Record<string, unknown>
          )
        )
        .catch(() => ws.close(1011, "Realtime message failed"))
    })
    ws.on("close", () => {
      void getRealtimeVoiceService().closeSession(
        callId,
        "twilio_socket_closed"
      )
    })
    ws.on("error", () => {
      void getRealtimeVoiceService().closeSession(callId, "twilio_socket_error")
    })
  })
}
