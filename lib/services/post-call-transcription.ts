import { gateway } from "@ai-sdk/gateway"
import { transcribe } from "ai"
import { WaveFile } from "wavefile"
import { REALTIME_TRANSCRIPTION_MODEL } from "./realtime-models"

export type TranscriptSegment = {
  role: "user" | "assistant" | "system"
  text: string
  startSecond: number
  endSecond: number
}

function monoWav(sampleRate: number, samples: Float64Array) {
  const wav = new WaveFile()
  wav.fromScratch(1, sampleRate, "16", samples)
  return wav.toBuffer()
}

export function splitDualChannelWav(bytes: Uint8Array) {
  const wav = new WaveFile(bytes)
  const format = wav.fmt as { numChannels?: number; sampleRate?: number }
  const sampleRate = format.sampleRate ?? 8000
  if (format.numChannels !== 2) {
    return { degraded: true, channels: [bytes] }
  }
  const samples = wav.getSamples(false) as unknown as [
    Float64Array,
    Float64Array,
  ]
  return {
    degraded: false,
    channels: [
      monoWav(sampleRate, samples[0]),
      monoWav(sampleRate, samples[1]),
    ],
  }
}

export async function transcribeRealtimeRecording(input: {
  bytes: Uint8Array
  direction?: string
}) {
  const split = splitDualChannelWav(input.bytes)
  const roles: TranscriptSegment["role"][] =
    split.channels.length === 2
      ? input.direction === "outbound"
        ? ["assistant", "user"]
        : ["user", "assistant"]
      : ["system"]
  const results = await Promise.all(
    split.channels.map((audio) =>
      transcribe({
        model: gateway.transcriptionModel(REALTIME_TRANSCRIPTION_MODEL),
        audio,
        maxRetries: 2,
      })
    )
  )
  const segments = results
    .flatMap((result, index) => {
      const source = result.segments.length
        ? result.segments
        : [
            {
              text: result.text,
              startSecond: 0,
              endSecond: result.durationInSeconds ?? 0,
            },
          ]
      return source.map((segment) => ({ ...segment, role: roles[index] }))
    })
    .filter((segment) => segment.text.trim().length > 0)
    .sort((a, b) => a.startSecond - b.startSecond)
  return {
    model: REALTIME_TRANSCRIPTION_MODEL,
    degraded: split.degraded,
    durationSeconds: Math.max(
      0,
      ...results.map((result) => result.durationInSeconds ?? 0)
    ),
    segments,
    text: segments
      .map((segment) => `${segment.role}: ${segment.text}`)
      .join("\n"),
  }
}
