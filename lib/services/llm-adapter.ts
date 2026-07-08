import { generateText, streamText } from "ai"
import type { TokenUsage } from "./billing"
import type { JsonAgent } from "./voice-types"

export type LlmStreamResponse = {
  model: string
  textStream: AsyncIterable<string>
  usage: Promise<TokenUsage>
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

function gatewayModelFor(agent: JsonAgent) {
  if (agent.model?.model) {
    if (agent.model.model.includes("/")) return agent.model.model
    if (agent.model.provider)
      return `${agent.model.provider}/${agent.model.model}`
  }
  return process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.5"
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

export const llmAdapter: LlmAdapter = {
  streamResponse({ agent, callId, messages, signal }) {
    const model = gatewayModelFor(agent)
    const result = streamText({
      model,
      system:
        agent.model?.systemPrompt ??
        "You are a concise, helpful voice assistant. Keep replies natural and brief for a phone call.",
      messages,
      maxRetries: Number(process.env.AI_GATEWAY_MAX_RETRIES ?? 0),
      abortSignal: signal,
      providerOptions: {
        gateway: {
          user: callId,
          tags: ["feature:voice-relay"],
        },
      },
    })
    return {
      model,
      textStream: result.textStream,
      usage: Promise.resolve(result.usage).then(normalizeUsage),
    }
  },

  async analyzeCall({ callId, transcript, events }) {
    const model =
      process.env.AI_GATEWAY_ANALYSIS_MODEL ??
      process.env.AI_GATEWAY_MODEL ??
      "openai/gpt-5.5"
    const result = await generateText({
      model,
      system:
        "You analyze phone call transcripts for an operator dashboard. Return only compact JSON.",
      prompt: JSON.stringify({
        task: "Analyze this voice call. Return JSON with summary, outcome, sentiment, actionItems, keyMoments, and transcriptQualityNotes.",
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
      "openai/gpt-5.5"
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
