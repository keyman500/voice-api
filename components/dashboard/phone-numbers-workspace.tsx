"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiDeleteBin6Line,
  RiDownloadCloud2Line,
  RiRefreshLine,
  RiSaveLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/eden"
import {
  dashboardQueryKeys,
  formatDateTime,
  getApiErrorMessage,
} from "@/lib/dashboard"
import {
  DashboardPageIntro,
  DashboardPanel,
  InlineError,
  KeyValue,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"
import type {
  AgentListResponse,
  PhoneNumberListResponse,
} from "@/lib/dashboard"
import type { JsonPhoneNumber } from "@/lib/services/voice-types"

type NumberFormState = Record<
  string,
  {
    name: string
    inboundAgentId: string
  }
>

async function fetchPhoneNumbers() {
  const { data, error } = await api.v1["phone-numbers"].get({
    query: { limit: 100 },
  })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load phone numbers"))
  }
  return data as PhoneNumberListResponse
}

async function fetchAgents() {
  const { data, error } = await api.v1.agents.get({ query: { limit: 100 } })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load agents"))
  }
  return data as AgentListResponse
}

function webhookState(phone: JsonPhoneNumber) {
  const raw = phone.raw
  const rawWebhook =
    raw && typeof raw === "object" && "webhook" in raw
      ? (raw.webhook as Record<string, unknown>)
      : undefined
  const providerWebhook =
    phone.providerOptions?.webhook &&
    typeof phone.providerOptions.webhook === "object"
      ? (phone.providerOptions.webhook as Record<string, unknown>)
      : undefined
  const webhook = rawWebhook ?? providerWebhook
  const status =
    typeof webhook?.status === "string" ? webhook.status : undefined
  const error = typeof webhook?.error === "string" ? webhook.error : undefined
  return {
    status,
    error,
    voiceUrl:
      typeof webhook?.voiceUrl === "string" ? webhook.voiceUrl : phone.webhookUrl,
  }
}

function agentLabel(agents: AgentListResponse | undefined, id?: string) {
  if (!id) return "Unassigned"
  return agents?.items.find((agent) => agent.id === id)?.name ?? id
}

export function PhoneNumbersWorkspace() {
  const queryClient = useQueryClient()
  const [forms, setForms] = useState<NumberFormState>({})
  const numbersQuery = useQuery({
    queryKey: dashboardQueryKeys.phoneNumbers(),
    queryFn: fetchPhoneNumbers,
  })
  const agentsQuery = useQuery({
    queryKey: dashboardQueryKeys.agents(),
    queryFn: fetchAgents,
  })

  const numbers = useMemo(
    () => numbersQuery.data?.items ?? [],
    [numbersQuery.data?.items]
  )
  const formValues = useMemo(() => {
    const next: NumberFormState = {}
    for (const phone of numbers) {
      next[phone.id] = {
        name: forms[phone.id]?.name ?? phone.name ?? "",
        inboundAgentId:
          forms[phone.id]?.inboundAgentId ?? phone.inboundAgentId ?? "",
      }
    }
    return next
  }, [forms, numbers])

  const importMutation = useMutation({
    mutationFn: async (telephonyProvider: "twilio" | "telnyx" = "twilio") => {
      const { data, error } = await api.v1["phone-numbers"].import.post({
        telephonyProvider,
      })
      if (error) {
        throw new Error(
          getApiErrorMessage(
            error,
            telephonyProvider === "telnyx"
              ? "Failed to import Telnyx numbers"
              : "Failed to import Twilio numbers"
          )
        )
      }
      return data
    },
    onSuccess: async () => {
      setForms({})
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.phoneNumbersRoot(),
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.phoneNumbers(),
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (phone: JsonPhoneNumber) => {
      const values = formValues[phone.id]
      const { data, error } = await api.v1["phone-numbers"]({ id: phone.id }).patch({
        name: values?.name.trim() || undefined,
        inboundAgentId: values?.inboundAgentId || undefined,
        number: phone.number,
        providerOptions: phone.providerOptions,
      })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to update number"))
      }
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.phoneNumbers(),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.v1["phone-numbers"]({ id }).delete()
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to unlink number"))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.phoneNumbers(),
      })
    },
  })

  function setFormValue(
    id: string,
    key: keyof NumberFormState[string],
    value: string
  ) {
    setForms((current) => ({
      ...current,
      [id]: {
        name: current[id]?.name ?? "",
        inboundAgentId: current[id]?.inboundAgentId ?? "",
        [key]: value,
      },
    }))
  }

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Numbers"
        title="Import Twilio or Telnyx numbers and route inbound calls."
        description="Sync owned Twilio or Telnyx numbers, attach an inbound agent, and use those numbers as caller IDs for outbound calls."
        action={
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => importMutation.mutate("twilio")}
              disabled={importMutation.isPending}
            >
              <RiDownloadCloud2Line />
              {importMutation.isPending &&
              importMutation.variables === "twilio"
                ? "Importing..."
                : "Import from Twilio"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => importMutation.mutate("telnyx")}
              disabled={importMutation.isPending}
            >
              <RiDownloadCloud2Line />
              {importMutation.isPending &&
              importMutation.variables === "telnyx"
                ? "Importing..."
                : "Import from Telnyx"}
            </Button>
          </div>
        }
      />

      <DashboardPanel
        title="Imported numbers"
        description="Voice webhooks are configured automatically during import."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void numbersQuery.refetch()}
            disabled={numbersQuery.isFetching}
          >
            <RiRefreshLine />
            Refresh
          </Button>
        }
      >
        <div className="space-y-5">
          <InlineError
            message={
              numbersQuery.error?.message ??
              agentsQuery.error?.message ??
              importMutation.error?.message ??
              updateMutation.error?.message ??
              deleteMutation.error?.message ??
              null
            }
          />

          {numbersQuery.isPending ? (
            <div className="rounded-2xl border border-border/70 bg-background/75 p-4 text-sm text-muted-foreground">
              Loading phone numbers...
            </div>
          ) : numbers.length ? (
            <div className="grid gap-4">
              {numbers.map((phone) => {
                const webhook = webhookState(phone)
                const values = formValues[phone.id]
                return (
                  <div
                    key={phone.id}
                    className="grid gap-5 rounded-[1.5rem] border border-border/70 bg-background/75 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-medium text-foreground">
                            {phone.number ?? "Unknown number"}
                          </p>
                          <StatusBadge
                            status={
                              webhook.status === "configured"
                                ? "successful"
                                : webhook.status === "failed"
                                  ? "error"
                                  : "unknown"
                            }
                            label={webhook.status ?? "unknown"}
                          />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Inbound agent:{" "}
                          {agentLabel(agentsQuery.data, phone.inboundAgentId)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(phone.id)}
                      >
                        <RiDeleteBin6Line />
                        Unlink
                      </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`number-name-${phone.id}`}>Name</Label>
                        <Input
                          id={`number-name-${phone.id}`}
                          value={values?.name ?? ""}
                          onChange={(event) =>
                            setFormValue(phone.id, "name", event.target.value)
                          }
                          placeholder="Support line"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`inbound-agent-${phone.id}`}>
                          Inbound agent
                        </Label>
                        <Select
                          value={values?.inboundAgentId || "none"}
                          onValueChange={(value) => {
                            const next = value ?? "none"
                            setFormValue(
                              phone.id,
                              "inboundAgentId",
                              next === "none" ? "" : next
                            )
                          }}
                        >
                          <SelectTrigger
                            id={`inbound-agent-${phone.id}`}
                            className="w-full"
                          >
                            <SelectValue placeholder="Select agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No inbound agent</SelectItem>
                            {(agentsQuery.data?.items ?? []).map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name ?? agent.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          disabled={updateMutation.isPending}
                          onClick={() => updateMutation.mutate(phone)}
                        >
                          <RiSaveLine />
                          Save
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <KeyValue
                        label="Twilio SID"
                        value={phone.twilioPhoneNumberSid ?? "—"}
                        mono
                      />
                      <KeyValue
                        label="Voice webhook"
                        value={webhook.voiceUrl ?? "—"}
                        mono
                      />
                      <KeyValue
                        label="Imported"
                        value={formatDateTime(
                          typeof phone.providerOptions?.importedFromTwilioAt ===
                            "string"
                            ? phone.providerOptions.importedFromTwilioAt
                            : undefined
                        )}
                      />
                    </div>
                    {webhook.error ? (
                      <InlineError message={webhook.error} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No numbers imported yet. Save Twilio credentials, then import
              your owned Twilio numbers.
            </div>
          )}
        </div>
      </DashboardPanel>
    </div>
  )
}
