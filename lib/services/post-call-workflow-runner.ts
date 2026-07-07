import { start } from "workflow/api"
import {
  postCallRecordingWorkflow,
  type PostCallRecordingWorkflowInput,
} from "@/workflows/post-call-recording"
import { getVoiceRelayService } from "./voice-relay-service"

export type PostCallWorkflowStarter = (
  input: PostCallRecordingWorkflowInput
) => Promise<{ runId: string }>

const workflowStarter: PostCallWorkflowStarter = async (input) => {
  const run = await start(postCallRecordingWorkflow, [input])
  await getVoiceRelayService().markPostCallWorkflowStarted({
    ...input,
    runId: run.runId,
  })
  return { runId: run.runId }
}

let activeStarter: PostCallWorkflowStarter | undefined

export function getPostCallWorkflowStarter() {
  activeStarter ??= workflowStarter
  return activeStarter
}

export function setPostCallWorkflowStarterForTests(
  starter: PostCallWorkflowStarter | undefined
) {
  activeStarter = starter
}
