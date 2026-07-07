export type ParsedTranscriptTurn = {
  role: "user" | "assistant" | "system" | "tool" | "unknown"
  text: string
}

const TURN_PATTERN = /^(user|assistant|system|tool):\s*(.+)$/i

function normalizeRole(value: string): ParsedTranscriptTurn["role"] {
  const role = value.toLowerCase()
  if (
    role === "user" ||
    role === "assistant" ||
    role === "system" ||
    role === "tool"
  ) {
    return role
  }
  return "unknown"
}

export function parseTranscript(raw?: string | null): ParsedTranscriptTurn[] {
  if (!raw?.trim()) return []

  const turns: ParsedTranscriptTurn[] = []

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(TURN_PATTERN)
    if (match) {
      turns.push({
        role: normalizeRole(match[1] ?? ""),
        text: match[2] ?? "",
      })
      continue
    }

    const lastTurn = turns.at(-1)
    if (lastTurn) {
      lastTurn.text = `${lastTurn.text}\n${trimmed}`
      continue
    }

    turns.push({ role: "unknown", text: trimmed })
  }

  return turns
}
