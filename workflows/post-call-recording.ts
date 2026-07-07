import { sleep } from "workflow"
import { getVoiceRelayService } from "@/lib/services/voice-relay-service"

export type PostCallRecordingWorkflowInput = {
  userId: string
  callId: string
}

export async function postCallRecordingWorkflow(
  input: PostCallRecordingWorkflowInput
) {
  "use workflow"

  const maxAttempts = 10
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await processPostCallRecording({
        ...input,
        failOnNotReady: attempt === maxAttempts,
      })
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined
      const message = error instanceof Error ? error.message : ""
      const notReady =
        code === "RECORDING_NOT_READY" ||
        message.startsWith("Twilio recording is ")
      if (!notReady || attempt === maxAttempts) {
        throw error
      }
      await sleep("15s")
    }
  }

  return processPostCallRecording({ ...input, failOnNotReady: true })
}

export async function processPostCallRecording(
  input: PostCallRecordingWorkflowInput & { failOnNotReady?: boolean }
) {
  "use step"

  return getVoiceRelayService().processPostCall(input)
}
