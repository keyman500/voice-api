"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  RiArrowLeftLine,
  RiDownloadLine,
  RiFileList3Line,
  RiPlayCircleLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/eden"
import {
  dashboardQueryKeys,
  formatDateTime,
  formatDuration,
  getApiErrorMessage,
} from "@/lib/dashboard"
import {
  DashboardPageIntro,
  DashboardPanel,
  InlineError,
  JsonPreview,
  KeyValue,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"
import type { JsonCall } from "@/lib/services/voice-types"

async function fetchCall(id: string) {
  const { data, error } = await api.v1.calls({ id }).get()
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load call detail"))
  }
  return data as JsonCall
}

export function CallLogDetail({ id }: { id: string }) {
  const callQuery = useQuery({
    queryKey: dashboardQueryKeys.call(id),
    queryFn: () => fetchCall(id),
  })

  const call = callQuery.data

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Call detail"
        title={call?.toNumber ?? "Call log"}
        description="Inspect the persisted call record, including embedded event history from the same v1 resource."
        action={
          <Button variant="outline" render={<Link href="/dashboard/logs" />}>
            <RiArrowLeftLine />
            Back to logs
          </Button>
        }
      />

      <InlineError message={callQuery.error?.message ?? null} />

      {call ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <DashboardPanel
            title="Session summary"
            description="Core identifiers and outcome details returned by the calls API."
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-border/70 bg-background/75 px-5 py-4">
                <div className="space-y-2">
                  <p className="font-mono text-xs text-muted-foreground">
                    {call.id}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={call.status} />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDuration(call.duration)}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <KeyValue label="To number" value={call.toNumber ?? "—"} />
                <KeyValue label="From number" value={call.fromNumber ?? "—"} />
                <KeyValue
                  label="Agent"
                  value={call.agentId ?? "Unassigned"}
                  mono
                />
                <KeyValue
                  label="Provider source"
                  value={call.providerSource ?? "—"}
                />
                <KeyValue label="Room name" value={call.roomName ?? "—"} mono />
                <KeyValue
                  label="SIP participant"
                  value={call.livekitSipParticipantId ?? "—"}
                  mono
                />
                <KeyValue
                  label="SIP call ID"
                  value={call.livekitSipCallId ?? "—"}
                  mono
                />
                <KeyValue
                  label="SIP trunk ID"
                  value={call.livekitSipTrunkId ?? "—"}
                  mono
                />
              </div>

              <Separator />

              <div className="grid gap-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Started:</span>{" "}
                  {formatDateTime(call.startedAt)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Ended:</span>{" "}
                  {formatDateTime(call.endedAt)}
                </p>
              </div>

              {call.recordingUrl ? (
                <Button
                  variant="outline"
                  render={<Link href={call.recordingUrl} target="_blank" />}
                >
                  <RiPlayCircleLine />
                  Open recording
                </Button>
              ) : null}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Transcript and analysis"
            description="Payloads stored with the call record."
          >
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Transcript
                </p>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/75 px-4 py-4 text-sm leading-7 text-foreground">
                  {call.transcript ?? "No transcript stored for this call."}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Analysis
                </p>
                <JsonPreview
                  value={call.analysis}
                  emptyLabel="No analysis stored for this call."
                />
              </div>
              <div>
                <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Metadata
                </p>
                <JsonPreview value={call.metadata} />
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Event timeline"
            description="Embedded call log events returned from GET /api/v1/calls/:id."
            className="xl:col-span-2"
          >
            <div className="space-y-3">
              {call.events?.length ? (
                call.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[1.5rem] border border-border/70 bg-background/75 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {event.type}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {event.id}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </div>
                    </div>
                    <div className="mt-4">
                      <JsonPreview
                        value={event.payload}
                        emptyLabel="No payload stored for this event."
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No event timeline stored for this call.
                </div>
              )}
            </div>
          </DashboardPanel>
        </div>
      ) : (
        <DashboardPanel title="Loading call detail">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-4 w-full animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        </DashboardPanel>
      )}
    </div>
  )
}
