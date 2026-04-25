/**
 * Provider id returned on every resource — aligned with `voice-ai-sdk` `Agent.provider` / `Call.provider`.
 * Voice API is a single first-party provider (LiveKit-backed implementation will plug in under services).
 */
export const VOICE_API_PROVIDER_ID = "voice-api" as const
