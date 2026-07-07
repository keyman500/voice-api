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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  successEvaluationPrompt: string
  webhookUrl: string
  webhookTimeoutSeconds: string
  webhookSecret: string
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
  successEvaluationPrompt: "",
  webhookUrl: "",
  webhookTimeoutSeconds: "",
  webhookSecret: "",
  metadata: "",
  providerOptions: "",
}

type Option = {
  value: string
  label: string
  description?: string
}

const LIVEKIT_VOICE_PROVIDER_OPTIONS: Option[] = [
  {
    value: "cartesia",
    label: "Cartesia",
    description: "LiveKit TTS provider",
  },
  {
    value: "deepgram",
    label: "Deepgram",
    description: "LiveKit TTS provider",
  },
  {
    value: "elevenlabs",
    label: "ElevenLabs",
    description: "LiveKit TTS provider",
  },
]

const LIVEKIT_VOICE_ID_OPTIONS: Record<string, Option[]> = {
  cartesia: [
    {
      value: "f786b574-daa5-4673-aa0c-cbe3e8534c02",
      label: "Cartesia default voice",
      description: "Docs example voice ID",
    },
    {
      value: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      label: "Cartesia sample voice",
      description: "Docs descriptor example voice ID",
    },
  ],
  deepgram: [
    {
      value: "athena",
      label: "Athena",
      description: "Smooth, professional female",
    },
    {
      value: "apollo",
      label: "Apollo",
      description: "Comfortable, casual male",
    },
    {
      value: "odysseus",
      label: "Odysseus",
      description: "Calm, professional male",
    },
    {
      value: "theia",
      label: "Theia",
      description: "Expressive, polite female",
    },
  ],
  elevenlabs: [
    {
      value: "Xb7hH8MSUJpSbSDYk0k2",
      label: "ElevenLabs inference voice",
      description: "Docs string-descriptor example voice ID",
    },
    {
      value: "ODq5zmih8GrVes37Dizd",
      label: "ElevenLabs plugin voice",
      description: "Docs plugin example voice ID",
    },
    {
      value: "EXAVITQu4vr4xnSDxMaL",
      label: "ElevenLabs default voice",
      description: "Docs default voice ID",
    },
  ],
}

const LIVEKIT_MODEL_PROVIDER_OPTIONS: Option[] = [
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "deepseek-ai", label: "DeepSeek" },
  { value: "moonshotai", label: "Moonshot / Kimi" },
  { value: "qwen", label: "Qwen" },
  { value: "xai", label: "xAI" },
]

const LIVEKIT_MODEL_NAME_OPTIONS: Record<string, Option[]> = {
  openai: [
    { value: "openai/gpt-4.1", label: "GPT-4.1" },
    { value: "openai/gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
    { value: "openai/gpt-5", label: "GPT-5" },
    { value: "openai/gpt-5-mini", label: "GPT-5 mini" },
    { value: "openai/gpt-5.4", label: "GPT-5.4" },
    { value: "openai/gpt-5.4-mini", label: "GPT-5.4 mini" },
  ],
  google: [
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
    {
      value: "google/gemini-3.1-flash-lite-preview",
      label: "Gemini 3.1 Flash Lite",
    },
    { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  ],
  "deepseek-ai": [{ value: "deepseek-ai/deepseek-v3", label: "DeepSeek V3" }],
  moonshotai: [{ value: "moonshotai/kimi-k2.5", label: "Kimi K2.5" }],
  qwen: [
    {
      value: "qwen/qwen3-235b-a22b-instruct",
      label: "Qwen3 235B-A22B Instruct",
    },
  ],
  xai: [
    { value: "xai/grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast" },
    {
      value: "xai/grok-4-1-fast-reasoning",
      label: "Grok 4.1 Fast Reasoning",
    },
    { value: "xai/grok-4.20-0309-non-reasoning", label: "Grok 4.20" },
  ],
}

function withCurrentValue(options: Option[], currentValue: string) {
  if (!currentValue.trim()) return options
  if (options.some((option) => option.value === currentValue)) return options

  return [
    ...options,
    {
      value: currentValue,
      label: `${currentValue} (saved custom value)`,
      description: "Previously saved on this agent",
    },
  ]
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
    successEvaluationPrompt: agent.successEvaluationPrompt ?? "",
    webhookUrl: agent.webhookUrl ?? "",
    webhookTimeoutSeconds: agent.webhookTimeoutSeconds
      ? String(agent.webhookTimeoutSeconds)
      : "",
    webhookSecret: "",
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
    successEvaluationPrompt:
      values.successEvaluationPrompt.trim() || undefined,
    webhookUrl: values.webhookUrl.trim() || undefined,
    webhookTimeoutSeconds: values.webhookTimeoutSeconds
      ? Number(values.webhookTimeoutSeconds)
      : undefined,
    webhookSecret: values.webhookSecret.trim() || undefined,
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
  const selectedVoiceProvider = form.watch("voiceProvider")
  const selectedVoiceId = form.watch("voiceId")
  const selectedModelProvider = form.watch("modelProvider")
  const selectedModelName = form.watch("modelName")
  const voiceOptions = withCurrentValue(
    LIVEKIT_VOICE_ID_OPTIONS[selectedVoiceProvider] ?? [],
    selectedVoiceId
  )
  const modelOptions = withCurrentValue(
    LIVEKIT_MODEL_NAME_OPTIONS[selectedModelProvider] ?? [],
    selectedModelName
  )

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
          <Label htmlFor="voice-provider">Voice provider</Label>
          <Controller
            name="voiceProvider"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(value) => {
                  const nextValue = value === "none" || !value ? "" : value
                  field.onChange(nextValue)
                  if (
                    nextValue &&
                    !LIVEKIT_VOICE_ID_OPTIONS[nextValue]?.some(
                      (option) => option.value === form.getValues("voiceId")
                    )
                  ) {
                    form.setValue("voiceId", "")
                  }
                }}
              >
                <SelectTrigger id="voice-provider" className="w-full">
                  <SelectValue placeholder="Select a LiveKit TTS provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset provider</SelectItem>
                  {LIVEKIT_VOICE_PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="voice-id">Voice ID</Label>
          <Controller
            name="voiceId"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(value) =>
                  field.onChange(value === "none" || !value ? "" : value)
                }
              >
                <SelectTrigger id="voice-id" className="w-full">
                  <SelectValue
                    placeholder={
                      selectedVoiceProvider
                        ? "Select a documented voice"
                        : "Choose a provider first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset voice ID</SelectItem>
                  {voiceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Uses official LiveKit-documented sample voice IDs or voice names for
            the selected provider.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-provider">Model provider</Label>
          <Controller
            name="modelProvider"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(value) => {
                  const nextValue = value === "none" || !value ? "" : value
                  field.onChange(nextValue)
                  if (
                    nextValue &&
                    !LIVEKIT_MODEL_NAME_OPTIONS[nextValue]?.some(
                      (option) => option.value === form.getValues("modelName")
                    )
                  ) {
                    form.setValue("modelName", "")
                  }
                }}
              >
                <SelectTrigger id="model-provider" className="w-full">
                  <SelectValue placeholder="Select a LiveKit LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset provider</SelectItem>
                  {LIVEKIT_MODEL_PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-name">Model name</Label>
          <Controller
            name="modelName"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || "none"}
                onValueChange={(value) =>
                  field.onChange(value === "none" || !value ? "" : value)
                }
              >
                <SelectTrigger id="model-name" className="w-full">
                  <SelectValue
                    placeholder={
                      selectedModelProvider
                        ? "Select a LiveKit model"
                        : "Choose a model provider first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset model</SelectItem>
                  {modelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Models are sourced from current LiveKit Inference LLM docs and
            exclude retired entries.
          </p>
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
                <Label htmlFor="success-evaluation">
                  Success evaluation prompt
                </Label>
                <Textarea
                  id="success-evaluation"
                  placeholder="Describe exactly what should make this call count as successful."
                  {...form.register("successEvaluationPrompt")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">
                  Webhook signing secret
                </Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  placeholder={
                    selectedAgent?.webhookSecretConfigured
                      ? "Configured. Enter a new value to rotate."
                      : "Required for signed finished-call webhooks"
                  }
                  {...form.register("webhookSecret")}
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
