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
      const result = await processPostCallRecording({
        ...input,
        failOnNotReady: attempt === maxAttempts,
      })
      const maxWebhookAttempts = 3
      for (
        let webhookAttempt = 1;
        webhookAttempt <= maxWebhookAttempts;
        webhookAttempt += 1
      ) {
        try {
          await deliverFinishedCallWebhook({ ...input, attempt: webhookAttempt })
          break
        } catch (error) {
          if (webhookAttempt === maxWebhookAttempts) throw error
          await sleep("10s")
        }
      }
      return result
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

  const result = await processPostCallRecording({
    ...input,
    failOnNotReady: true,
  })
  await deliverFinishedCallWebhook({ ...input, attempt: 1 })
  return result
}

export async function processPostCallRecording(
  input: PostCallRecordingWorkflowInput & { failOnNotReady?: boolean }
) {
  "use step"

  return getVoiceRelayService().processPostCall(input)
}

export async function deliverFinishedCallWebhook(
  input: PostCallRecordingWorkflowInput & { attempt: number }
) {
  "use step"

  return getVoiceRelayService().deliverFinishedCallWebhook(input)
}
