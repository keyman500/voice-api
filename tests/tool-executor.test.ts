import { describe, expect, it, jest } from "@jest/globals"
import { VOICE_API_PROVIDER_ID } from "@/lib/voice-constants"
import {
  buildAiToolDefinitions,
  executeToolCall,
  speakMessageFor,
} from "@/lib/services/tool-executor"
import type { JsonTool } from "@/lib/services/voice-types"

function sampleTool(overrides: Partial<JsonTool> = {}): JsonTool {
  return {
    id: "tool-1",
    provider: VOICE_API_PROVIDER_ID,
    type: "function",
    name: "get_weather",
    description: "Weather lookup",
    function: {
      name: "get_weather",
      description: "Get weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
    server: {
      url: "https://tools.example.com/weather",
      timeoutSeconds: 5,
    },
    messages: [
      { type: "request-start", content: "Checking the weather." },
      { type: "request-complete", content: "Got it." },
    ],
    async: false,
    raw: {},
    ...overrides,
  }
}

describe("tool-executor", () => {
  it("builds AI tool definitions from function tools", () => {
    const definitions = buildAiToolDefinitions([sampleTool()])
    expect(definitions).toEqual([
      expect.objectContaining({
        name: "get_weather",
        description: "Get weather for a location",
      }),
    ])
  })

  it("reads spoken request-start messages", () => {
    expect(speakMessageFor(sampleTool(), "request-start")).toBe(
      "Checking the weather."
    )
  })

  it("POSTs a Vapi-compatible tool-calls payload and parses results", async () => {
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        message: {
          type: string
          toolCallList: Array<{ name: string; arguments: Record<string, unknown> }>
        }
      }
      expect(body.message.type).toBe("tool-calls")
      expect(body.message.toolCallList[0]).toMatchObject({
        name: "get_weather",
        arguments: { location: "San Francisco" },
      })
      return new Response(
        JSON.stringify({
          results: [
            {
              toolCallId: "call_123",
              result: "62F and sunny",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    }) as unknown as typeof fetch

    const result = await executeToolCall({
      tool: sampleTool(),
      call: { id: "call-1", status: "in-progress" },
      agent: { id: "agent-1", name: "Weather" },
      toolCall: {
        id: "call_123",
        name: "get_weather",
        arguments: { location: "San Francisco" },
      },
      fetchImpl,
    })

    expect(result).toMatchObject({
      ok: true,
      toolCallId: "call_123",
      name: "get_weather",
      result: "62F and sunny",
      status: 200,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://tools.example.com/weather",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("returns a clear error when server.url is missing", async () => {
    const result = await executeToolCall({
      tool: sampleTool({ server: undefined }),
      call: { id: "call-1" },
      toolCall: {
        id: "call_123",
        name: "get_weather",
        arguments: {},
      },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe("TOOL_SERVER_URL_MISSING")
  })

  it("surfaces non-2xx tool server responses", async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response("upstream failed", {
          status: 502,
          headers: { "content-type": "text/plain" },
        })
    ) as unknown as typeof fetch

    const result = await executeToolCall({
      tool: sampleTool(),
      call: { id: "call-1" },
      toolCall: {
        id: "call_err",
        name: "get_weather",
        arguments: { location: "x" },
      },
      fetchImpl,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(502)
    expect(result.result).toContain("HTTP 502")
  })
})
