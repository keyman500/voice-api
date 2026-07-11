export const REALTIME_MAX_DURATION_SECONDS = 24 * 60
export const REALTIME_TRANSCRIPTION_MODEL = "xai/grok-stt"
export const REALTIME_PRICING_VERIFIED_AT = "2026-07-10"

export const REALTIME_MODELS = [
  {
    model: "xai/grok-voice-think-fast-1.0",
    provider: "xai",
    name: "Grok Voice Think Fast",
    voices: ["ara", "rex", "sal", "eve", "leo"],
    estimatedProviderUsdPerMinute: 0.05,
    pricingUnit: "audio-minute",
    audioInputUsdPerToken: null,
    audioOutputUsdPerToken: null,
  },
  {
    model: "openai/gpt-realtime-mini",
    provider: "openai",
    name: "GPT Realtime Mini",
    voices: [
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar",
    ],
    estimatedProviderUsdPerMinute: null,
    pricingUnit: "audio-token",
    audioInputUsdPerToken: 0.00001,
    audioOutputUsdPerToken: 0.00002,
  },
  {
    model: "openai/gpt-realtime-1.5",
    provider: "openai",
    name: "GPT Realtime 1.5",
    voices: [
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar",
    ],
    estimatedProviderUsdPerMinute: null,
    pricingUnit: "audio-token",
    audioInputUsdPerToken: 0.000032,
    audioOutputUsdPerToken: 0.000064,
  },
  {
    model: "openai/gpt-realtime-2",
    provider: "openai",
    name: "GPT Realtime 2",
    voices: [
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar",
    ],
    estimatedProviderUsdPerMinute: null,
    pricingUnit: "audio-token",
    audioInputUsdPerToken: 0.000032,
    audioOutputUsdPerToken: 0.000064,
  },
] as const

export type VoiceEngine = "conversation-relay" | "realtime"

export function realtimeModel(model?: string) {
  return REALTIME_MODELS.find((item) => item.model === model)
}

export function realtimeModelsForApi() {
  return {
    pricingLastVerifiedAt: REALTIME_PRICING_VERIFIED_AT,
    maxDurationSeconds: REALTIME_MAX_DURATION_SECONDS,
    transcriptionModel: REALTIME_TRANSCRIPTION_MODEL,
    models: REALTIME_MODELS.map((item) => ({
      ...item,
      voices: [...item.voices],
      available: true,
      estimatedCreditsPerMinute:
        item.estimatedProviderUsdPerMinute == null
          ? null
          : item.estimatedProviderUsdPerMinute * 1.5 * 100 + 1,
      audioInputUsdPerToken: item.audioInputUsdPerToken,
      audioOutputUsdPerToken: item.audioOutputUsdPerToken,
    })),
  }
}
