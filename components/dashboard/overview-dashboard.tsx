"use client"

import Link from "next/link"
import {
  RiArrowRightUpLine,
  RiBroadcastLine,
  RiPulseLine,
  RiSettings3Line,
} from "@remixicon/react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
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
  MetricCard,
  PanelSkeleton,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"
import type {
  AgentListResponse,
  CallListResponse,
  LiveKitConfigResponse,
} from "@/lib/dashboard"

async function fetchOverviewLiveKit() {
  const { data, error } = await api.v1["livekit-config"].get()
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load LiveKit config"))
  }
  return data as LiveKitConfigResponse
}

async function fetchOverviewAgents() {
  const { data, error } = await api.v1.agents.get({ query: { limit: 5 } })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load agents"))
  }
  return data as AgentListResponse
}

async function fetchOverviewCalls() {
  const { data, error } = await api.v1.calls.get({ query: { limit: 5 } })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load recent calls"))
  }
  return data as CallListResponse
}

export function OverviewDashboard() {
  const livekitQuery = useQuery({
    queryKey: dashboardQueryKeys.livekit(),
    queryFn: fetchOverviewLiveKit,
  })

  const agentsQuery = useQuery({
    queryKey: dashboardQueryKeys.agents(5),
    queryFn: fetchOverviewAgents,
  })

  const callsQuery = useQuery({
    queryKey: dashboardQueryKeys.calls({ limit: 5 }),
    queryFn: fetchOverviewCalls,
  })

  const errorMessage =
    livekitQuery.error?.message ??
    agentsQuery.error?.message ??
    callsQuery.error?.message

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Control room"
        title="Operational visibility across your voice stack."
        description="Track readiness, launch outbound calls, inspect recent sessions, and jump into the exact surfaces that map to the LiveKit-backed API."
        action={
          <div className="flex flex-wrap gap-3">
            <Button render={<Link href="/dashboard/calls" />}>
              Launch outbound call
              <RiArrowRightUpLine />
            </Button>
            <Button
              variant="outline"
              render={<Link href="/dashboard/settings" />}
            >
              LiveKit settings
              <RiSettings3Line />
            </Button>
          </div>
        }
      />

      {livekitQuery.isPending ||
      agentsQuery.isPending ||
      callsQuery.isPending ? (
        <PanelSkeleton />
      ) : null}

      <InlineError message={errorMessage ?? null} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="LiveKit"
          value={livekitQuery.data?.configured ? "Ready" : "Offline"}
          caption={
            livekitQuery.data?.configured
              ? `${livekitQuery.data.providerSource} credentials configured`
              : "Set credentials before launching outbound SIP"
          }
        />
        <MetricCard
          label="Agents"
          value={agentsQuery.data?.items.length ?? 0}
          caption="Active agent definitions available to calls and logs"
        />
        <MetricCard
          label="Recent calls"
          value={callsQuery.data?.items.length ?? 0}
          caption="Latest outbound sessions loaded into the operator feed"
        />
        <MetricCard
          label="Last config update"
          value={
            livekitQuery.data?.updatedAt
              ? formatDateTime(livekitQuery.data.updatedAt)
              : "—"
          }
          caption="Redacted config status from /api/v1/livekit-config"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel
          title="Recent sessions"
          description="A compact look at the newest call records before you head to the logs table."
          action={
            <Button variant="outline" render={<Link href="/dashboard/logs" />}>
              Open logs
            </Button>
          }
        >
          <div className="space-y-3">
            {callsQuery.data?.items.length ? (
              callsQuery.data.items.map((call) => (
                <Link
                  key={call.id}
                  href={`/dashboard/logs/${call.id}`}
                  className="flex flex-col gap-3 rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4 transition-colors hover:bg-background"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {call.toNumber ?? "Unknown destination"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {call.id}
                      </p>
                    </div>
                    <StatusBadge status={call.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Agent: {call.agentId ?? "Unassigned"}</span>
                    <span>Started: {formatDateTime(call.startedAt)}</span>
                    <span>Duration: {formatDuration(call.duration)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-[1.4rem] border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                No calls yet. Use the outbound dialer to create the first
                session.
              </p>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Readiness board"
          description="What an operator needs before traffic goes live."
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4">
              <div className="rounded-2xl bg-teal-500/10 p-2 text-teal-600 dark:text-teal-300">
                <RiBroadcastLine className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  LiveKit credentials
                </p>
                <p className="text-sm text-muted-foreground">
                  {livekitQuery.data?.configured
                    ? `Connected to ${livekitQuery.data.livekitUrl ?? "configured project"}`
                    : "Missing. Save credentials and optional SIP trunk under Settings."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4">
              <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-600 dark:text-cyan-300">
                <RiPulseLine className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Agent inventory
                </p>
                <p className="text-sm text-muted-foreground">
                  {agentsQuery.data?.items.length
                    ? `${agentsQuery.data.items.length} agent records ready for outbound routing.`
                    : "Create at least one agent so the dialer can target a known workflow."}
                </p>
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              API docs remain available at{" "}
              <Link
                href="/docs"
                className="font-medium text-foreground underline underline-offset-4"
              >
                /docs
              </Link>{" "}
              for endpoint-level verification.
            </div>
          </div>
        </DashboardPanel>
      </div>
    </div>
  )
}
