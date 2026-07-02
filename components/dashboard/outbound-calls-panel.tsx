"use client"

import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiPhoneLine, RiRadarLine } from "@remixicon/react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/eden"
import {
  dashboardQueryKeys,
  formatDateTime,
  getApiErrorMessage,
  parseJsonRecordInput,
  stringifyJson,
} from "@/lib/dashboard"
import {
  DashboardPageIntro,
  DashboardPanel,
  InlineError,
  JsonPreview,
  KeyValue,
  TimestampLine,
} from "@/components/dashboard/control-room-ui"
import type { AgentListResponse } from "@/lib/dashboard"
import type { JsonCall } from "@/lib/services/voice-types"

type CallFormValues = {
  toNumber: string
  fromNumber: string
  agentId: string
  metadata: string
  providerOptions: string
}

async function fetchAgentsForDialer() {
  const { data, error } = await api.v1.agents.get({ query: { limit: 100 } })
  if (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to load agents for the dialer")
    )
  }
  return data as AgentListResponse
}

export function OutboundCallsPanel() {
  const queryClient = useQueryClient()
  const [lastCall, setLastCall] = useState<JsonCall | null>(null)
  const form = useForm<CallFormValues>({
    defaultValues: {
      toNumber: "",
      fromNumber: "",
      agentId: "",
      metadata: "",
      providerOptions: "",
    },
  })

  const agentsQuery = useQuery({
    queryKey: dashboardQueryKeys.agents(),
    queryFn: fetchAgentsForDialer,
  })

  const callMutation = useMutation({
    mutationFn: async (values: CallFormValues) => {
      const { data, error } = await api.v1.calls.post({
        toNumber: values.toNumber.trim(),
        fromNumber: values.fromNumber.trim() || undefined,
        agentId: values.agentId.trim() || undefined,
        metadata: parseJsonRecordInput(values.metadata, "Metadata"),
        providerOptions: parseJsonRecordInput(
          values.providerOptions,
          "Provider options"
        ),
      })
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to create outbound call")
        )
      }
      return data as JsonCall
    },
    onSuccess: async (data) => {
      setLastCall(data)
      form.reset()
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.callsRoot(),
      })
    },
  })

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Calls"
        title="Launch outbound traffic without leaving the control room."
        description="This page is intentionally focused on origination only. Compose a call, choose an agent if needed, and send directly into the LiveKit-backed calls API."
        action={
          <Button variant="outline" render={<Link href="/dashboard/logs" />}>
            Open logs
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardPanel
          title="Outbound dialer"
          description="Uses React Hook Form for capture and a TanStack mutation through Eden for submission."
        >
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              callMutation.mutate(values)
            )}
          >
            <InlineError message={callMutation.error?.message ?? null} />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="to-number">To number</Label>
                <Input
                  id="to-number"
                  placeholder="+15551234567"
                  {...form.register("toNumber", {
                    required: "Destination number is required",
                  })}
                />
                {form.formState.errors.toNumber ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.toNumber.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-number">From number</Label>
                <Input
                  id="from-number"
                  placeholder="+15557654321"
                  {...form.register("fromNumber")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-id">Agent ID</Label>
              <Input
                id="agent-id"
                list="agent-id-options"
                placeholder="Optional agent id"
                {...form.register("agentId")}
              />
              <datalist id="agent-id-options">
                {(agentsQuery.data?.items ?? []).map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name ?? agent.id}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Leave blank to place a raw outbound call without an attached
                agent record.
              </p>
            </div>

            <Accordion>
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced payload</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="call-metadata">Metadata JSON</Label>
                      <Controller
                        name="metadata"
                        control={form.control}
                        rules={{
                          validate: (value) => {
                            try {
                              parseJsonRecordInput(value, "Metadata")
                              return true
                            } catch (error) {
                              return error instanceof Error
                                ? error.message
                                : "Invalid metadata"
                            }
                          },
                        }}
                        render={({ field, fieldState }) => (
                          <>
                            <Textarea
                              id="call-metadata"
                              placeholder='{"campaign":"beta"}'
                              {...field}
                            />
                            {fieldState.error ? (
                              <p className="text-xs text-destructive">
                                {fieldState.error.message}
                              </p>
                            ) : null}
                          </>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="call-provider-options">
                        Provider options JSON
                      </Label>
                      <Controller
                        name="providerOptions"
                        control={form.control}
                        rules={{
                          validate: (value) => {
                            try {
                              parseJsonRecordInput(value, "Provider options")
                              return true
                            } catch (error) {
                              return error instanceof Error
                                ? error.message
                                : "Invalid provider options"
                            }
                          },
                        }}
                        render={({ field, fieldState }) => (
                          <>
                            <Textarea
                              id="call-provider-options"
                              placeholder='{"sipTrunkId":"trunk-1"}'
                              {...field}
                            />
                            {fieldState.error ? (
                              <p className="text-xs text-destructive">
                                {fieldState.error.message}
                              </p>
                            ) : null}
                          </>
                        )}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button type="submit" disabled={callMutation.isPending}>
              <RiPhoneLine />
              {callMutation.isPending
                ? "Placing call…"
                : "Create outbound call"}
            </Button>
          </form>
        </DashboardPanel>

        <DashboardPanel
          title="Last submission"
          description="Immediate feedback from the most recent outbound call request."
        >
          {lastCall ? (
            <div className="space-y-5">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/75 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium text-foreground">
                      {lastCall.toNumber ?? "Unknown destination"}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {lastCall.id}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-teal-500/10 p-2 text-teal-600 dark:text-teal-300">
                    <RiRadarLine className="size-5" />
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <KeyValue label="Status" value={lastCall.status} />
                  <KeyValue
                    label="Provider source"
                    value={lastCall.providerSource ?? "—"}
                  />
                  <KeyValue
                    label="Room name"
                    value={lastCall.roomName ?? "—"}
                    mono
                  />
                  <KeyValue
                    label="SIP call ID"
                    value={lastCall.livekitSipCallId ?? "—"}
                    mono
                  />
                </div>
              </div>

              <div className="space-y-2">
                <TimestampLine label="Started" value={lastCall.startedAt} />
                <TimestampLine label="Ended" value={lastCall.endedAt} />
                <p className="text-sm text-muted-foreground">
                  Created at{" "}
                  {formatDateTime(lastCall.startedAt ?? lastCall.endedAt)}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Metadata
                  </p>
                  <JsonPreview value={lastCall.metadata} />
                </div>
                <div>
                  <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Provider options
                  </p>
                  <JsonPreview value={lastCall.providerOptions} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              Submit an outbound call to see its returned LiveKit identifiers
              and payload snapshot here.
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  )
}
