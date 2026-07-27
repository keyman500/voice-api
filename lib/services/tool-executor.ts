import crypto from "node:crypto"
import type { JsonTool } from "./voice-types"

export type ToolCallRequest = {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ToolCallResult = {
  toolCallId: string
  name: string
  result: string
  ok: boolean
  status?: number
  error?: string
}

export type ToolSpeakMessage = {
  type: "request-start" | "request-complete" | "request-failed" | "request-response-delayed"
  content: string
}

export type ExecutableTool = Omit<JsonTool, "server"> & {
  server?: JsonTool["server"] & { secret?: string }
}

export type ExecuteToolCallInput = {
  tool: ExecutableTool
  call: {
    id: string
    agentId?: string
    toNumber?: string
    fromNumber?: string
    status?: string
    direction?: string
  }
  agent?: {
    id: string
    name?: string
  }
  toolCall: ToolCallRequest
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

function timeoutMs(tool: JsonTool) {
  const seconds = tool.server?.timeoutSeconds
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
    return Math.min(Math.floor(seconds * 1000), 60_000)
  }
  return 10_000
}

function toolFunctionName(tool: JsonTool) {
  return tool.function?.name ?? tool.name ?? "unnamed_tool"
}

function stringifyResult(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractResultFromBody(body: unknown, toolCallId: string): string {
  if (!body || typeof body !== "object") return stringifyResult(body)
  const record = body as Record<string, unknown>

  if (Array.isArray(record.results)) {
    const match = record.results.find(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).toolCallId === toolCallId
    ) as Record<string, unknown> | undefined
    if (match && "result" in match) return stringifyResult(match.result)
    const first = record.results[0]
    if (first && typeof first === "object" && "result" in first) {
      return stringifyResult((first as Record<string, unknown>).result)
    }
  }

  if ("result" in record) return stringifyResult(record.result)
  return stringifyResult(body)
}

export function speakMessageFor(
  tool: JsonTool,
  type: ToolSpeakMessage["type"]
): string | undefined {
  const messages = tool.messages ?? []
  for (const message of messages) {
    if (!message || typeof message !== "object") continue
    const record = message as Record<string, unknown>
    const messageType =
      typeof record.type === "string"
        ? record.type
        : typeof record.role === "string"
          ? record.role
          : undefined
    const content =
      typeof record.content === "string"
        ? record.content
        : typeof record.message === "string"
          ? record.message
          : undefined
    if (!content) continue
    if (
      messageType === type ||
      messageType === type.replace("request-", "") ||
      (type === "request-start" &&
        (messageType === "request-start" || messageType === "start"))
    ) {
      return content
    }
  }
  return undefined
}

/**
 * Execute a Vapi-compatible function tool by POSTing to `tool.server.url`.
 *
 * Request body mirrors Vapi `tool-calls` server messages. Response may be:
 * - `{ results: [{ toolCallId, result }] }` (preferred)
 * - `{ result: ... }`
 * - any JSON / text body (stringified as the tool result)
 */
export async function executeToolCall(
  input: ExecuteToolCallInput
): Promise<ToolCallResult> {
  const fetchImpl = input.fetchImpl ?? fetch
  const url = input.tool.server?.url
  const name = toolFunctionName(input.tool)

  if (!url) {
    return {
      toolCallId: input.toolCall.id,
      name,
      result: `Error: tool "${name}" has no server.url configured`,
      ok: false,
      error: "TOOL_SERVER_URL_MISSING",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs(input.tool))
  const onAbort = () => controller.abort()
  input.signal?.addEventListener("abort", onAbort)

  const payload = {
    message: {
      timestamp: Date.now(),
      type: "tool-calls",
      toolCallList: [
        {
          id: input.toolCall.id,
          name,
          arguments: input.toolCall.arguments,
        },
      ],
      toolWithToolCallList: [
        {
          type: input.tool.type || "function",
          name,
          description: input.tool.function?.description ?? input.tool.description,
          parameters: input.tool.function?.parameters ?? {
            type: "object",
            properties: {},
          },
          server: { url },
          messages: input.tool.messages ?? [],
          toolCall: {
            id: input.toolCall.id,
            type: "function",
            function: {
              name,
              parameters: input.toolCall.arguments,
            },
          },
        },
      ],
      assistant: input.agent
        ? {
            id: input.agent.id,
            name: input.agent.name,
          }
        : undefined,
      call: {
        id: input.call.id,
        agentId: input.call.agentId,
        toNumber: input.call.toNumber,
        fromNumber: input.call.fromNumber,
        status: input.call.status,
        direction: input.call.direction,
      },
    },
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/plain;q=0.9,*/*;q=0.8",
    "user-agent": "voice-api-tools/1.0",
    "x-voice-api-tool-call-id": input.toolCall.id,
    "x-voice-api-call-id": input.call.id,
  }

  if (input.tool.server?.headers) {
    for (const [key, value] of Object.entries(input.tool.server.headers)) {
      if (typeof value === "string") headers[key.toLowerCase()] = value
    }
  }

  const body = JSON.stringify(payload)
  if (input.tool.server?.secret) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = crypto
      .createHmac("sha256", input.tool.server.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex")
    headers["x-voice-api-timestamp"] = timestamp
    headers["x-voice-api-signature"] = `sha256=${signature}`
  }

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })
    const contentType = response.headers.get("content-type") ?? ""
    const rawText = await response.text()
    let parsed: unknown = rawText
    if (contentType.includes("application/json") || rawText.trim().startsWith("{")) {
      try {
        parsed = JSON.parse(rawText)
      } catch {
        parsed = rawText
      }
    }

    if (!response.ok) {
      return {
        toolCallId: input.toolCall.id,
        name,
        result: `Error: tool server returned HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        ok: false,
        status: response.status,
        error: `HTTP_${response.status}`,
      }
    }

    return {
      toolCallId: input.toolCall.id,
      name,
      result: extractResultFromBody(parsed, input.toolCall.id),
      ok: true,
      status: response.status,
    }
  } catch (error) {
    const aborted = controller.signal.aborted
    const message =
      error instanceof Error ? error.message : "Tool server request failed"
    return {
      toolCallId: input.toolCall.id,
      name,
      result: aborted
        ? `Error: tool server timed out or was aborted (${message})`
        : `Error: ${message}`,
      ok: false,
      error: aborted ? "TOOL_TIMEOUT" : "TOOL_REQUEST_FAILED",
    }
  } finally {
    clearTimeout(timeout)
    input.signal?.removeEventListener("abort", onAbort)
  }
}

export function buildAiToolDefinitions(tools: JsonTool[]) {
  return tools
    .filter((tool) => tool.type === "function" || !tool.type)
    .map((tool) => {
      const name = toolFunctionName(tool)
      const parameters = tool.function?.parameters ?? {
        type: "object",
        properties: {},
      }
      return {
        tool,
        name,
        description:
          tool.function?.description ??
          tool.description ??
          `Custom tool ${name}`,
        parameters:
          parameters && typeof parameters === "object"
            ? (parameters as Record<string, unknown>)
            : { type: "object", properties: {} },
      }
    })
}
