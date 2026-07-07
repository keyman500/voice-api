import type {
  PaginatedList,
  JsonAgent,
  JsonCall,
  RedactedTwilioConfig,
} from "@/lib/services/voice-types"

export const dashboardQueryKeys = {
  agentsRoot: () => ["agents"] as const,
  livekit: () => ["twilio-config"] as const,
  agents: (limit = 100) => ["agents", limit] as const,
  callsRoot: () => ["calls"] as const,
  calls: (filters: Record<string, unknown> = {}) => ["calls", filters] as const,
  call: (id: string) => ["call", id] as const,
}

export type AgentListResponse = PaginatedList<JsonAgent>
export type CallListResponse = PaginatedList<JsonCall>
export type LiveKitConfigResponse = RedactedTwilioConfig

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message

  if (isRecord(error)) {
    const value = error.value
    if (isRecord(value)) {
      const nestedError = value.error
      if (isRecord(nestedError) && typeof nestedError.message === "string") {
        return nestedError.message
      }

      if (typeof value.message === "string") {
        return value.message
      }
    }
  }

  return fallback
}

export function parseJsonRecordInput(
  input: string,
  fieldLabel: string
): Record<string, unknown> | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object`)
  }

  return parsed
}

export function parseListInput(input: string): string[] | undefined {
  const values = input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)

  return values.length ? values : undefined
}

export function stringifyJson(value: unknown) {
  if (!value) return ""
  return JSON.stringify(value, null, 2)
}

export function formatDateTime(value?: string) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function formatDuration(seconds?: number) {
  if (seconds === undefined || seconds === null) return "—"
  if (seconds < 60) return `${seconds}s`

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`

  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`
}

export function statusTone(status?: string) {
  switch (status) {
    case "in-progress":
    case "ringing":
    case "successful":
      return "default"
    case "ended":
      return "secondary"
    case "unsuccessful":
    case "error":
      return "destructive"
    default:
      return "outline"
  }
}
