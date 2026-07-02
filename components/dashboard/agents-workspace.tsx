"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiPencilLine,
  RiRefreshLine,
  RiRobot2Line,
} from "@remixicon/react"

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
  getApiErrorMessage,
  parseJsonRecordInput,
  parseListInput,
  stringifyJson,
} from "@/lib/dashboard"
import {
  DashboardPageIntro,
  DashboardPanel,
  InlineError,
  JsonPreview,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"
import type { AgentListResponse } from "@/lib/dashboard"
import type { JsonAgent } from "@/lib/services/voice-types"

type AgentFormValues = {
  name: string
  voiceId: string
  voiceProvider: string
  modelProvider: string
  modelName: string
  systemPrompt: string
  knowledgeBaseIds: string
  firstMessage: string
  maxDurationSeconds: string
  backgroundSound: string
  voicemailMessage: string
  webhookUrl: string
  webhookTimeoutSeconds: string
  metadata: string
  providerOptions: string
}

const defaultValues: AgentFormValues = {
  name: "",
  voiceId: "",
  voiceProvider: "",
  modelProvider: "",
  modelName: "",
  systemPrompt: "",
  knowledgeBaseIds: "",
  firstMessage: "",
  maxDurationSeconds: "",
  backgroundSound: "",
  voicemailMessage: "",
  webhookUrl: "",
  webhookTimeoutSeconds: "",
  metadata: "",
  providerOptions: "",
}

function valuesFromAgent(agent?: JsonAgent | null): AgentFormValues {
  if (!agent) return defaultValues

  return {
    name: agent.name ?? "",
    voiceId: agent.voice?.voiceId ?? "",
    voiceProvider: agent.voice?.provider ?? "",
    modelProvider: agent.model?.provider ?? "",
    modelName: agent.model?.model ?? "",
    systemPrompt: agent.model?.systemPrompt ?? "",
    knowledgeBaseIds: agent.model?.knowledgeBaseIds?.join("\n") ?? "",
    firstMessage: agent.firstMessage ?? "",
    maxDurationSeconds:
      typeof agent.raw === "object" &&
      agent.raw &&
      "maxDurationSeconds" in agent.raw
        ? String(
            (agent.raw as Record<string, unknown>).maxDurationSeconds ?? ""
          )
        : "",
    backgroundSound:
      typeof agent.raw === "object" &&
      agent.raw &&
      "backgroundSound" in agent.raw
        ? String((agent.raw as Record<string, unknown>).backgroundSound ?? "")
        : "",
    voicemailMessage:
      typeof agent.raw === "object" &&
      agent.raw &&
      "voicemailMessage" in agent.raw
        ? String((agent.raw as Record<string, unknown>).voicemailMessage ?? "")
        : "",
    webhookUrl: "",
    webhookTimeoutSeconds: "",
    metadata: stringifyJson(agent.metadata),
    providerOptions: stringifyJson(agent.providerOptions),
  }
}

async function fetchAgents() {
  const { data, error } = await api.v1.agents.get({ query: { limit: 100 } })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load agents"))
  }

  return data as AgentListResponse
}

function toPayload(values: AgentFormValues) {
  const metadata = parseJsonRecordInput(values.metadata, "Metadata")
  const providerOptions = parseJsonRecordInput(
    values.providerOptions,
    "Provider options"
  )
  const knowledgeBaseIds = parseListInput(values.knowledgeBaseIds)

  return {
    name: values.name.trim() || undefined,
    voice: values.voiceId.trim()
      ? {
          voiceId: values.voiceId.trim(),
          provider: values.voiceProvider.trim() || undefined,
        }
      : undefined,
    model:
      values.modelProvider.trim() && values.modelName.trim()
        ? {
            provider: values.modelProvider.trim(),
            model: values.modelName.trim(),
            systemPrompt: values.systemPrompt.trim() || undefined,
            knowledgeBaseIds,
          }
        : undefined,
    firstMessage: values.firstMessage.trim() || undefined,
    maxDurationSeconds: values.maxDurationSeconds
      ? Number(values.maxDurationSeconds)
      : undefined,
    backgroundSound: values.backgroundSound.trim() || undefined,
    voicemailMessage: values.voicemailMessage.trim() || undefined,
    webhookUrl: values.webhookUrl.trim() || undefined,
    webhookTimeoutSeconds: values.webhookTimeoutSeconds
      ? Number(values.webhookTimeoutSeconds)
      : undefined,
    metadata,
    providerOptions,
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function AgentForm({
  selectedAgent,
  onClear,
}: {
  selectedAgent: JsonAgent | null
  onClear: () => void
}) {
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<AgentFormValues>({
    defaultValues: valuesFromAgent(selectedAgent),
  })

  const isEditing = Boolean(selectedAgent)

  useEffect(() => {
    form.reset(valuesFromAgent(selectedAgent))
  }, [form, selectedAgent])

  const createMutation = useMutation({
    mutationFn: async (values: AgentFormValues) => {
      const payload = toPayload(values)
      const { data, error } = await api.v1.agents.post(payload)
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to create agent"))
      }
      return data
    },
    onSuccess: async () => {
      setSubmitError(null)
      form.reset(defaultValues)
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.agentsRoot(),
      })
    },
    onError: (error) => setSubmitError(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: async (values: AgentFormValues) => {
      if (!selectedAgent) throw new Error("No agent selected")
      const payload = toPayload(values)
      const { data, error } = await api.v1
        .agents({ id: selectedAgent.id })
        .patch(payload)
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to update agent"))
      }
      return data
    },
    onSuccess: async () => {
      setSubmitError(null)
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.agentsRoot(),
      })
    },
    onError: (error) => setSubmitError(error.message),
  })

  function onSubmit(values: AgentFormValues) {
    setSubmitError(null)
    if (isEditing) {
      updateMutation.mutate(values)
      return
    }
    createMutation.mutate(values)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <InlineError message={submitError} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Agent name</Label>
          <Input
            id="agent-name"
            placeholder="Support concierge"
            {...form.register("name")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-first-message">First message</Label>
          <Input
            id="agent-first-message"
            placeholder="Hey there, thanks for calling."
            {...form.register("firstMessage")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="voice-id">Voice ID</Label>
          <Input
            id="voice-id"
            placeholder="alloy"
            {...form.register("voiceId")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="voice-provider">Voice provider</Label>
          <Input
            id="voice-provider"
            placeholder="openai"
            {...form.register("voiceProvider")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-provider">Model provider</Label>
          <Input
            id="model-provider"
            placeholder="openai"
            {...form.register("modelProvider")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-name">Model name</Label>
          <Input
            id="model-name"
            placeholder="gpt-4.1-mini"
            {...form.register("modelName")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">System prompt</Label>
        <Textarea
          id="system-prompt"
          placeholder="Describe how the agent should behave."
          {...form.register("systemPrompt")}
        />
      </div>

      <Accordion>
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced runtime settings</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max-duration">Max duration (seconds)</Label>
                  <Input
                    id="max-duration"
                    type="number"
                    {...form.register("maxDurationSeconds")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="background-sound">Background sound</Label>
                  <Input
                    id="background-sound"
                    placeholder="office"
                    {...form.register("backgroundSound")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://example.com/webhooks/voice"
                    {...form.register("webhookUrl")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-timeout">
                    Webhook timeout (seconds)
                  </Label>
                  <Input
                    id="webhook-timeout"
                    type="number"
                    {...form.register("webhookTimeoutSeconds")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voicemail-message">Voicemail message</Label>
                <Textarea
                  id="voicemail-message"
                  {...form.register("voicemailMessage")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="knowledge-base">Knowledge base IDs</Label>
                <Textarea
                  id="knowledge-base"
                  placeholder="One ID per line"
                  {...form.register("knowledgeBaseIds")}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="metadata">Metadata JSON</Label>
                  <Controller
                    name="metadata"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Textarea
                          id="metadata"
                          placeholder='{"team":"ops"}'
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                        <FieldError message={fieldState.error?.message} />
                      </>
                    )}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-options">
                    Provider options JSON
                  </Label>
                  <Controller
                    name="providerOptions"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Textarea
                          id="provider-options"
                          placeholder='{"transferTarget":"sip-trunk"}'
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                        <FieldError message={fieldState.error?.message} />
                      </>
                    )}
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
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isEditing ? "Save changes" : "Create agent"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => {
            onClear()
            form.reset(defaultValues)
            setSubmitError(null)
          }}
        >
          {isEditing ? "Stop editing" : "Reset form"}
        </Button>
      </div>
    </form>
  )
}

function AgentList({
  agents,
  selectedId,
  onEdit,
}: {
  agents: JsonAgent[]
  selectedId: string | null
  onEdit: (agent: JsonAgent) => void
}) {
  const queryClient = useQueryClient()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.v1.agents({ id }).delete()
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to delete agent"))
      }
    },
    onSuccess: async () => {
      setDeleteError(null)
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.agentsRoot(),
      })
    },
    onError: (error) => setDeleteError(error.message),
  })

  return (
    <div className="space-y-4">
      <InlineError message={deleteError} />
      {agents.length ? (
        agents.map((agent) => (
          <div
            key={agent.id}
            className={`rounded-[1.5rem] border px-4 py-4 transition-colors ${
              selectedId === agent.id
                ? "border-teal-500/50 bg-teal-500/8"
                : "border-border/70 bg-background/75"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {agent.name ?? "Untitled agent"}
                  </p>
                  <StatusBadge
                    status={agent.model?.provider ? "ready" : "draft"}
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {agent.id}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>Voice: {agent.voice?.voiceId ?? "—"}</span>
                  <span>Model: {agent.model?.model ?? "—"}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(agent)}
                >
                  <RiPencilLine />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(agent.id)}
                >
                  <RiDeleteBin6Line />
                  Delete
                </Button>
              </div>
            </div>
            {agent.metadata || agent.providerOptions ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Metadata
                  </p>
                  <JsonPreview value={agent.metadata} />
                </div>
                <div>
                  <p className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Provider options
                  </p>
                  <JsonPreview value={agent.providerOptions} />
                </div>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No agents yet. Use the form to publish the first agent definition.
        </div>
      )}
    </div>
  )
}

export function AgentsWorkspace() {
  const [selectedAgent, setSelectedAgent] = useState<JsonAgent | null>(null)
  const agentsQuery = useQuery({
    queryKey: dashboardQueryKeys.agents(),
    queryFn: fetchAgents,
  })

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Agents"
        title="Design and iterate on the voices behind every call."
        description="Create agent records against the existing v1 routes, keep the common settings up front, and tuck structured metadata into an advanced lane when you need extra control."
        action={
          <Button
            variant="outline"
            onClick={() => {
              setSelectedAgent(null)
              void agentsQuery.refetch()
            }}
          >
            <RiRefreshLine />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel
          title={selectedAgent ? "Edit agent" : "Create agent"}
          description="Forms are backed by React Hook Form and send directly through Eden + TanStack Query mutations."
        >
          <AgentForm
            selectedAgent={selectedAgent}
            onClear={() => setSelectedAgent(null)}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Agent roster"
          description="Existing agent definitions fetched from /api/v1/agents."
          action={
            <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              {agentsQuery.data?.items.length ?? 0} total
            </div>
          }
        >
          <InlineError message={agentsQuery.error?.message} />
          {agentsQuery.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.5rem] border border-border/70 px-4 py-5"
                >
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <AgentList
              agents={agentsQuery.data?.items ?? []}
              selectedId={selectedAgent?.id ?? null}
              onEdit={setSelectedAgent}
            />
          )}
        </DashboardPanel>
      </div>
    </div>
  )
}
