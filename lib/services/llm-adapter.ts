import { generateText, streamText } from "ai"
import type { JsonAgent } from "./voice-types"

export type LlmAdapter = {
  streamResponse(input: {
    agent: JsonAgent
    callId: string
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
    signal?: AbortSignal
  }): AsyncIterable<string>
  analyzeCall(input: {
    callId: string
    transcript?: string
    events?: Array<{ type: string; payload?: Record<string, unknown> }>
  }): Promise<Record<string, unknown>>
  evaluateCallSuccess(input: {
    callId: string
    transcript?: string
    successEvaluationPrompt?: string
    analysis?: Record<string, unknown>
  }): Promise<{ successful: boolean; reason: string }>
}

function gatewayModelFor(agent: JsonAgent) {
  if (agent.model?.model) {
    if (agent.model.model.includes("/")) return agent.model.model
    if (agent.model.provider) return `${agent.model.provider}/${agent.model.model}`
  }
  return process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.5"
}

export const llmAdapter: LlmAdapter = {
  streamResponse({ agent, callId, messages, signal }) {
    const result = streamText({
      model: gatewayModelFor(agent),
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
    return result.textStream
  },

  async analyzeCall({ callId, transcript, events }) {
    const result = await generateText({
      model: process.env.AI_GATEWAY_ANALYSIS_MODEL ?? process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.5",
      system:
        "You analyze phone call transcripts for an operator dashboard. Return only compact JSON.",
      prompt: JSON.stringify({
        task:
          "Analyze this voice call. Return JSON with summary, outcome, sentiment, actionItems, keyMoments, and transcriptQualityNotes.",
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
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return {
        summary: text,
        outcome: "unknown",
        sentiment: "unknown",
        actionItems: [],
        keyMoments: [],
        transcriptQualityNotes: "Model returned non-JSON analysis.",
      }
    }
  },

  async evaluateCallSuccess({
    callId,
    transcript,
    successEvaluationPrompt,
    analysis,
  }) {
    const result = await generateText({
      model:
        process.env.AI_GATEWAY_ANALYSIS_MODEL ??
        process.env.AI_GATEWAY_MODEL ??
        "openai/gpt-5.5",
      system:
        "You judge whether a phone call was successful. Return only JSON.",
      prompt: JSON.stringify({
        task:
          "Return strict JSON with keys successful:boolean and reason:string.",
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
      successful: parsed.successful,
      reason:
        typeof parsed.reason === "string"
          ? parsed.reason
          : parsed.successful
            ? "The call was evaluated as successful."
            : "The call was evaluated as unsuccessful.",
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
