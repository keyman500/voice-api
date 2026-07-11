"use client"

import type { ReactNode } from "react"

import {
  JsonPreview,
  KeyValue,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"
import type { JsonCall } from "@/lib/services/voice-types"

const KNOWN_KEYS = [
  "summary",
  "outcome",
  "sentiment",
  "actionItems",
  "keyMoments",
  "transcriptQualityNotes",
] as const

type CallAnalysisPanelProps = {
  analysis?: Record<string, unknown> | null
  analysisStatus?: JsonCall["analysisStatus"]
  analysisError?: string | null
}

type AnalysisListItem = {
  text: string
  timestamp?: string
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return null
}

function asTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Seconds into the call (common LLM shape) vs epoch ms
    if (value >= 0 && value < 86_400) {
      const total = Math.floor(value)
      const mins = Math.floor(total / 60)
      const secs = total % 60
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }
    return new Date(value).toLocaleString()
  }

  const raw = asString(value)
  if (!raw) return null

  const asNumber = Number(raw)
  if (raw !== "" && Number.isFinite(asNumber) && !raw.includes(":")) {
    return asTimestamp(asNumber)
  }

  return raw
}

function asListItems(value: unknown): AnalysisListItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): AnalysisListItem | null => {
      if (typeof item === "string") {
        const text = item.trim()
        return text ? { text } : null
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>
        const text =
          asString(record.text) ??
          asString(record.description) ??
          asString(record.summary) ??
          asString(record.title) ??
          asString(record.moment) ??
          null
        if (!text) return null

        const timestamp =
          asTimestamp(record.timestamp) ??
          asTimestamp(record.time) ??
          asTimestamp(record.at) ??
          asTimestamp(record.offset) ??
          asTimestamp(record.t) ??
          undefined

        return { text, timestamp }
      }

      const text = asString(item)
      return text ? { text } : null
    })
    .filter((item): item is AnalysisListItem => Boolean(item))
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatScalar(value: unknown): ReactNode {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value === null || value === undefined) return "—"
  return null
}

function AnalysisList({
  label,
  items,
}: {
  label: string
  items: AnalysisListItem[]
}) {
  if (!items.length) return null

  return (
    <div className="space-y-2">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <ul className="space-y-3 text-sm text-foreground">
        {items.map((item, index) => (
          <li
            key={`${label}-${index}`}
            className="flex gap-2 leading-6"
          >
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-500/80"
            />
            <div className="min-w-0 space-y-1">
              {item.timestamp ? (
                <p
                  className="font-mono text-xs text-muted-foreground"
                  style={{
                    fontFamily:
                      "var(--font-dashboard-mono), ui-monospace, monospace",
                  }}
                >
                  {item.timestamp}
                </p>
              ) : null}
              <p className="text-pretty wrap-break-word">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProseField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-sm leading-6 text-pretty wrap-break-word text-foreground">
        {value}
      </p>
    </div>
  )
}

export function CallAnalysisPanel({
  analysis,
  analysisStatus,
  analysisError,
}: CallAnalysisPanelProps) {
  const isProcessing =
    analysisStatus === "processing" || analysisStatus === "pending"
  const isFailed = analysisStatus === "failed"
  const hasAnalysis =
    analysis !== null &&
    analysis !== undefined &&
    typeof analysis === "object" &&
    Object.keys(analysis).length > 0

  if (!hasAnalysis) {
    const emptyLabel = isProcessing
      ? "Analysis is processing."
      : isFailed
        ? (analysisError ?? "Analysis failed.")
        : "No analysis stored for this call."

    return (
      <div className="space-y-3 overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/75 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Post-call analysis</p>
          <StatusBadge status={analysisStatus ?? "unknown"} />
        </div>
        {isFailed && analysisError ? (
          <p className="text-sm text-destructive">{analysisError}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </div>
    )
  }

  const summary = asString(analysis.summary)
  const outcome = asString(analysis.outcome)
  const sentiment = asString(analysis.sentiment)
  const actionItems = asListItems(analysis.actionItems)
  const keyMoments = asListItems(analysis.keyMoments)
  const qualityNotes = asString(analysis.transcriptQualityNotes)

  const knownKeySet = new Set<string>(KNOWN_KEYS)
  const extraEntries = Object.entries(analysis).filter(
    ([key]) => !knownKeySet.has(key)
  )

  return (
    <div className="space-y-5 overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/75 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Post-call analysis</p>
        <StatusBadge status={analysisStatus ?? "ready"} />
      </div>

      {summary ? (
        <div className="min-w-0 space-y-2">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Summary
          </p>
          <p className="max-w-[70ch] text-sm leading-6 text-pretty wrap-break-word text-foreground">
            {summary}
          </p>
        </div>
      ) : null}

      {outcome || sentiment ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {outcome ? <ProseField label="Outcome" value={outcome} /> : null}
          {sentiment ? <ProseField label="Sentiment" value={sentiment} /> : null}
        </div>
      ) : null}

      <AnalysisList label="Action items" items={actionItems} />
      <AnalysisList label="Key moments" items={keyMoments} />

      {qualityNotes ? (
        <div className="min-w-0 space-y-2">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Transcript quality
          </p>
          <p className="max-w-[70ch] text-sm leading-6 text-pretty wrap-break-word text-muted-foreground">
            {qualityNotes}
          </p>
        </div>
      ) : null}

      {extraEntries.length ? (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Additional fields
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {extraEntries.map(([key, value]) => {
              const scalar = formatScalar(value)
              if (scalar !== null) {
                return (
                  <div key={key} className="min-w-0">
                    <KeyValue label={humanizeKey(key)} value={scalar} />
                  </div>
                )
              }

              return (
                <div key={key} className="min-w-0 space-y-2 sm:col-span-2">
                  <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    {humanizeKey(key)}
                  </p>
                  <JsonPreview value={value} />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
