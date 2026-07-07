import {
  experimental_upgradeWebSocket,
  type WebSocketData,
} from "@vercel/functions"
import { getVoiceRelayService } from "@/lib/services/voice-relay-service"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const callId = url.searchParams.get("callId")

  if (!callId) {
    return new Response("Missing callId", { status: 400 })
  }

  const relayCall = await getVoiceRelayService().resolveRelayCall(callId)
  if (!relayCall) {
    return new Response("Call not found", { status: 404 })
  }

  return experimental_upgradeWebSocket((ws) => {
    ws.on("message", async (data: WebSocketData) => {
      const text =
        typeof data === "string"
          ? data
          : data instanceof ArrayBuffer
            ? Buffer.from(data).toString("utf8")
            : Array.isArray(data)
              ? Buffer.concat(data).toString("utf8")
              : Buffer.from(data).toString("utf8")
      const message = JSON.parse(text) as Record<string, unknown>
      await getVoiceRelayService().handleRelayMessage({
        userId: relayCall.userId,
        callId,
        message,
        send: (payload) => ws.send(JSON.stringify(payload)),
      })
    })
  })
}
