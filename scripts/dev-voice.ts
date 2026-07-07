import { createServer } from "node:http"
import { parse } from "node:url"
import { loadEnvConfig } from "@next/env"
import next from "next"
import { WebSocketServer } from "ws"
import { getVoiceRelayService } from "../lib/services/voice-relay-service"

loadEnvConfig(process.cwd())

const port = Number(process.env.PORT ?? 3000)
const hostname = process.env.HOSTNAME ?? "localhost"
const app = next({ dev: true, hostname, port })
const handle = app.getRequestHandler()
const wss = new WebSocketServer({ noServer: true })

await app.prepare()

const server = createServer((request, response) => {
  const parsedUrl = parse(request.url ?? "/", true)
  void handle(request, response, parsedUrl)
})

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`)

  if (url.pathname !== "/api/v1/relay/ws") {
    socket.destroy()
    return
  }

  const callId = url.searchParams.get("callId")
  if (!callId) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\nMissing callId")
    socket.destroy()
    return
  }

  const relayCall = await getVoiceRelayService().resolveRelayCall(callId)
  if (!relayCall) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\nCall not found")
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString()) as Record<string, unknown>
        await getVoiceRelayService().handleRelayMessage({
          userId: relayCall.userId,
          callId,
          message,
          send: (payload) => ws.send(JSON.stringify(payload)),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Relay error"
        ws.send(JSON.stringify({ type: "error", message }))
      }
    })
  })
})

server.listen(port, () => {
  console.log(`Voice dev server ready on http://${hostname}:${port}`)
  console.log("ConversationRelay WebSocket upgrades enabled at /api/v1/relay/ws")
})
