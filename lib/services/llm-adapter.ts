import {
  generateText,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type ToolSet,
} from "ai"
import type { TokenUsage } from "./billing"
import type { JsonAgent, JsonTool } from "./voice-types"
import {
  buildAiToolDefinitions,
  executeToolCall,
  speakMessageFor,
  type ToolCallResult,
} from "./tool-executor"

export type LlmStreamResponse = {
  model: string
  textStream: AsyncIterable<string>
  usage: Promise<TokenUsage>
}

export type LlmToolCallEvent = {
  toolCallId: string
  name: string
  arguments: Record<string, unknown>
  result: ToolCallResult
  speak?: string
  phase?: "start" | "complete"
}

export type LlmStreamToolsContext = {
  tools: JsonTool[]
  call: {
    id: string
    agentId?: string
    toNumber?: string
    fromNumber?: string
    status?: string
    direction?: string
  }
  onToolEvent?: (event: LlmToolCallEvent) => void | Promise<void>
  fetchImpl?: typeof fetch
  resolveToolSecret?: (toolId: string) => Promise<string | null>
  maxSteps?: number
}

export type LlmAnalysisResponse = {
  model: string
  analysis: Record<string, unknown>
  usage?: TokenUsage
}

export type LlmSuccessEvaluationResponse = {
  model: string
  evaluation: { successful: boolean; reason: string }
  usage?: TokenUsage
}

export type LlmAdapter = {
  streamResponse(input: {
    agent: JsonAgent
    callId: string
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
    signal?: AbortSignal
    toolsContext?: LlmStreamToolsContext
  }): LlmStreamResponse
  analyzeCall(input: {
    callId: string
    transcript?: string
    events?: Array<{ type: string; payload?: Record<string, unknown> }>
  }): Promise<LlmAnalysisResponse>
  evaluateCallSuccess(input: {
    callId: string
    transcript?: string
    successEvaluationPrompt?: string
    analysis?: Record<string, unknown>
  }): Promise<LlmSuccessEvaluationResponse>
}

const DEFAULT_AI_GATEWAY_MODEL = "deepseek/deepseek-v4-flash"

function gatewayModelFor(agent: JsonAgent) {
  if (agent.model?.model) {
    if (agent.model.model.includes("/")) return agent.model.model
    if (agent.model.provider)
      return `${agent.model.provider}/${agent.model.model}`
  }
  return process.env.AI_GATEWAY_MODEL ?? DEFAULT_AI_GATEWAY_MODEL
}

function normalizeUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== "object") return {}
  const value = usage as Record<string, unknown>
  const inputTokens =
    typeof value.inputTokens === "number"
      ? value.inputTokens
      : typeof value.promptTokens === "number"
        ? value.promptTokens
        : undefined
  const outputTokens =
    typeof value.outputTokens === "number"
      ? value.outputTokens
      : typeof value.completionTokens === "number"
        ? value.completionTokens
        : undefined
  const totalTokens =
    typeof value.totalTokens === "number"
      ? value.totalTokens
      : inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined
  return { inputTokens, outputTokens, totalTokens }
}

async function buildToolSet(
  agent: JsonAgent,
  toolsContext: LlmStreamToolsContext,
  signal?: AbortSignal
): Promise<ToolSet> {
  const definitions = buildAiToolDefinitions(toolsContext.tools)
  const tools: ToolSet = {}

  for (const definition of definitions) {
    tools[definition.name] = tool({
      description: definition.description,
      inputSchema: jsonSchema<Record<string, unknown>>(definition.parameters),
      execute: async (args, options) => {
        const toolCallId = options.toolCallId
        const argumentsRecord =
          args && typeof args === "object"
            ? (args as Record<string, unknown>)
            : {}

        const startSpeak = speakMessageFor(definition.tool, "request-start")
        if (startSpeak) {
          await toolsContext.onToolEvent?.({
            toolCallId,
            name: definition.name,
            arguments: argumentsRecord,
            result: {
              toolCallId,
              name: definition.name,
              result: "",
              ok: true,
            },
            speak: startSpeak,
            phase: "start",
          })
        }

        const secret = toolsContext.resolveToolSecret
          ? await toolsContext.resolveToolSecret(definition.tool.id)
          : null

        const result = await executeToolCall({
          tool: {
            ...definition.tool,
            server: definition.tool.server
              ? {
                  ...definition.tool.server,
                  secret: secret ?? undefined,
                }
              : undefined,
          },
          call: toolsContext.call,
          agent: { id: agent.id, name: agent.name },
          toolCall: {
            id: toolCallId,
            name: definition.name,
            arguments: argumentsRecord,
          },
          signal,
          fetchImpl: toolsContext.fetchImpl,
        })

        const speak = speakMessageFor(
          definition.tool,
          result.ok ? "request-complete" : "request-failed"
        )
        await toolsContext.onToolEvent?.({
          toolCallId,
          name: definition.name,
          arguments: argumentsRecord,
          result,
          speak,
          phase: "complete",
        })

        return result.result
      },
    })
  }

  return tools
}

export const llmAdapter: LlmAdapter = {
  streamResponse({ agent, callId, messages, signal, toolsContext }) {
    const model = gatewayModelFor(agent)
    let resolveUsage!: (usage: TokenUsage) => void
    const usage = new Promise<TokenUsage>((resolve) => {
      resolveUsage = resolve
    })

    async function* generate() {
      try {
        const tools =
          toolsContext && toolsContext.tools.length > 0
            ? await buildToolSet(agent, toolsContext, signal)
            : undefined

        const result = streamText({
          model,
          system:
            agent.model?.systemPrompt ??
            "You are a concise, helpful voice assistant. Keep replies natural and brief for a phone call.",
          messages,
          tools,
          stopWhen: tools
            ? stepCountIs(toolsContext?.maxSteps ?? 5)
            : undefined,
          maxRetries: Number(process.env.AI_GATEWAY_MAX_RETRIES ?? 0),
          abortSignal: signal,
          providerOptions: {
            gateway: {
              user: callId,
              tags: ["feature:voice-relay"],
            },
          },
        })

        void Promise.resolve(result.usage)
          .then(normalizeUsage)
          .then(resolveUsage)
          .catch(() => resolveUsage({}))

        for await (const token of result.textStream) {
          yield token
        }
      } catch (error) {
        resolveUsage({})
        throw error
      }
    }

    return {
      model,
      textStream: generate(),
      usage,
    }
  },

  async analyzeCall({ callId, transcript, events }) {
    const model =
      process.env.AI_GATEWAY_ANALYSIS_MODEL ??
      process.env.AI_GATEWAY_MODEL ??
      DEFAULT_AI_GATEWAY_MODEL
    const result = await generateText({
      model,
      system:
        "You analyze phone call transcripts for an operator dashboard. Return only compact JSON.",
      prompt: JSON.stringify({
        task: "Analyze this voice call. Return JSON with summary (string), outcome (string), sentiment (string), actionItems (string[]), keyMoments ({text: string, timestamp: string}[] where timestamp is mm:ss from call start when known), and transcriptQualityNotes (string).",
        transcript: transcript ?? "",
        events: events?.slice(-40) ?? [],
      }),
      maxRetries: Number(process.env.AI_GATEWAY_MAX_RETRIES ?? 0),
      providerOptions: {
        gateway: {
          user: callId,
          tags: ["feature:voice-post-call-analysis"],
        },
      },
    })
    const text = result.text.trim()
    try {
      return {
        model,
        analysis: JSON.parse(text) as Record<string, unknown>,
        usage: normalizeUsage(result.usage),
      }
    } catch {
      return {
        model,
        analysis: {
          summary: text,
          outcome: "unknown",
          sentiment: "unknown",
          actionItems: [],
          keyMoments: [],
          transcriptQualityNotes: "Model returned non-JSON analysis.",
        },
        usage: normalizeUsage(result.usage),
      }
    }
  },

  async evaluateCallSuccess({
    callId,
    transcript,
    successEvaluationPrompt,
    analysis,
  }) {
    const model =
      process.env.AI_GATEWAY_ANALYSIS_MODEL ??
      process.env.AI_GATEWAY_MODEL ??
      DEFAULT_AI_GATEWAY_MODEL
    const result = await generateText({
      model,
      system:
        "You judge whether a phone call was successful. Return only JSON.",
      prompt: JSON.stringify({
        task: "Return strict JSON with keys successful:boolean and reason:string.",
        criteria:
          successEvaluationPrompt ??
          "A successful call means the assistant adequately helped the caller, reached a clear outcome, or collected the needed information without major unresolved issues.",
        transcript: transcript ?? "",
        analysis: analysis ?? {},
      }),
      maxRetries: Number(process.env.AI_GATEWAY_MAX_RETRIES ?? 0),
      providerOptions: {
        gateway: {
          user: callId,
          tags: ["feature:voice-success-evaluation"],
        },
      },
    })
    const text = result.text.trim()
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (typeof parsed.successful !== "boolean") {
      throw new Error("Success evaluation did not return a boolean")
    }
    return {
      model,
      evaluation: {
        successful: parsed.successful,
        reason:
          typeof parsed.reason === "string"
            ? parsed.reason
            : parsed.successful
              ? "The call was evaluated as successful."
              : "The call was evaluated as unsuccessful.",
      },
      usage: normalizeUsage(result.usage),
    }
  },
}

let activeLlmAdapter: LlmAdapter | undefined

export function getLlmAdapter() {
  activeLlmAdapter ??= llmAdapter
  return activeLlmAdapter
}

export function setLlmAdapterForTests(adapter: LlmAdapter | undefined) {
  activeLlmAdapter = adapter
}
