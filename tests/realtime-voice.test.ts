import { describe, expect, it } from "@jest/globals"
import { WaveFile } from "wavefile"
import {
  REALTIME_MAX_DURATION_SECONDS,
  realtimeModel,
  realtimeModelsForApi,
} from "@/lib/services/realtime-models"
import {
  mergeTranscriptSegments,
  splitDualChannelWav,
} from "@/lib/services/post-call-transcription"
import { twilioAdapter } from "@/lib/services/twilio-adapter"

describe("realtime voice engine", () => {
  it("publishes the supported Gateway realtime model catalog", () => {
    const catalog = realtimeModelsForApi()
    expect(catalog.maxDurationSeconds).toBe(REALTIME_MAX_DURATION_SECONDS)
    expect(catalog.transcriptionModel).toBe("xai/grok-stt")
    expect(catalog.models.map((item) => item.model)).toEqual([
      "xai/grok-voice-think-fast-1.0",
      "openai/gpt-realtime-mini",
      "openai/gpt-realtime-1.5",
      "openai/gpt-realtime-2",
    ])
    expect(realtimeModel("xai/grok-voice-think-fast-1.0")?.voices).toContain(
      "eve"
    )
  })

  it("creates recording bidirectional Media Stream TwiML", () => {
    const twiml = twilioAdapter.mediaStreamTwiML({
      websocketUrl:
        "wss://voice.example.com/api/v1/realtime/ws/call-1/signed-token",
      recordingStatusCallbackUrl:
        "https://voice.example.com/api/v1/twilio/recording?callId=call-1",
      customParameters: { callId: "call-1", model: "xai/grok" },
    })
    expect(twiml).toContain('<Recording channels="dual" track="both"')
    expect(twiml).toContain("<Connect><Stream")
    expect(twiml).toContain(
      'url="wss://voice.example.com/api/v1/realtime/ws/call-1/signed-token"'
    )
    expect(twiml).not.toContain("realtime/ws?")
    expect(twiml).toContain('<Parameter name="callId" value="call-1" />')
    expect(twiml).not.toContain("ConversationRelay")
  })

  it("splits dual-channel WAV recordings and degrades mono safely", () => {
    const stereo = new WaveFile()
    stereo.fromScratch(2, 8000, "16", [
      new Float64Array([0, 100, 200]),
      new Float64Array([0, -100, -200]),
    ])
    const split = splitDualChannelWav(stereo.toBuffer())
    expect(split.degraded).toBe(false)
    expect(split.channels).toHaveLength(2)

    const mono = new WaveFile()
    mono.fromScratch(1, 8000, "16", new Float64Array([0, 100, 200]))
    expect(splitDualChannelWav(mono.toBuffer())).toMatchObject({
      degraded: true,
      channels: [expect.any(Uint8Array)],
    })
  })

  it("groups word-level transcription segments into speaker turns", () => {
    expect(
      mergeTranscriptSegments([
        { role: "user", text: "Hi,", startSecond: 0, endSecond: 0.2 },
        { role: "user", text: "how", startSecond: 0.25, endSecond: 0.4 },
        { role: "user", text: "are you?", startSecond: 0.45, endSecond: 0.8 },
        {
          role: "assistant",
          text: "I'm good.",
          startSecond: 1,
          endSecond: 1.5,
        },
        { role: "user", text: "Great.", startSecond: 4, endSecond: 4.4 },
      ])
    ).toEqual([
      {
        role: "user",
        text: "Hi, how are you?",
        startSecond: 0,
        endSecond: 0.8,
      },
      {
        role: "assistant",
        text: "I'm good.",
        startSecond: 1,
        endSecond: 1.5,
      },
      { role: "user", text: "Great.", startSecond: 4, endSecond: 4.4 },
    ])
  })
})
