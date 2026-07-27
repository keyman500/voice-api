"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/eden"
import {
  getApiErrorMessage,
  parseJsonRecordInput,
} from "@/lib/dashboard"
import type { JsonTool } from "@/lib/services/voice-types"

type ToolListResponse = {
  items: JsonTool[]
  hasMore: boolean
  nextCursor?: string
}

type ToolFormValues = {
  name: string
  description: string
  functionName: string
  parametersJson: string
  serverUrl: string
  timeoutSeconds: string
  messagesJson: string
  testArgumentsJson: string
}

const defaultValues: ToolFormValues = {
  name: "",
  description: "",
  functionName: "",
  parametersJson: `{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Lookup query" }
  },
  "required": ["query"]
}`,
  serverUrl: "",
  timeoutSeconds: "10",
  messagesJson: `[
  { "type": "request-start", "content": "One moment while I look that up." }
]`,
  testArgumentsJson: `{
  "query": "demo"
}`,
}

function InlineError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}

async function fetchTools() {
  const { data, error } = await api.v1.tools.get({ query: { limit: 100 } })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load tools"))
  }
  return data as ToolListResponse
}

function valuesFromTool(tool?: JsonTool | null): ToolFormValues {
  if (!tool) return defaultValues
  return {
    name: tool.name ?? "",
    description: tool.description ?? "",
    functionName: tool.function?.name ?? tool.name ?? "",
    parametersJson: JSON.stringify(
      tool.function?.parameters ?? {
        type: "object",
        properties: {},
      },
      null,
      2
    ),
    serverUrl: tool.server?.url ?? "",
    timeoutSeconds:
      tool.server?.timeoutSeconds != null
        ? String(tool.server.timeoutSeconds)
        : "10",
    messagesJson: JSON.stringify(tool.messages ?? [], null, 2),
    testArgumentsJson: defaultValues.testArgumentsJson,
  }
}

export function ToolsWorkspace() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [testResult, setTestResult] = React.useState<string | null>(null)

  const toolsQuery = useQuery({
    queryKey: ["dashboard", "tools"],
    queryFn: fetchTools,
  })

  const selectedTool =
    toolsQuery.data?.items.find((tool) => tool.id === selectedId) ?? null

  const form = useForm<ToolFormValues>({
    defaultValues,
    values: valuesFromTool(selectedTool),
  })

  const createMutation = useMutation({
    mutationFn: async (values: ToolFormValues) => {
      const parameters = parseJsonRecordInput(
        values.parametersJson,
        "Parameters"
      )
      const messagesRaw = values.messagesJson.trim()
        ? JSON.parse(values.messagesJson)
        : []
      if (!Array.isArray(messagesRaw)) {
        throw new Error("Messages must be a JSON array")
      }
      const { data, error } = await api.v1.tools.post({
        type: "function",
        name: values.name.trim() || values.functionName.trim(),
        description: values.description.trim() || undefined,
        function: {
          name: values.functionName.trim(),
          description: values.description.trim() || undefined,
          parameters: parameters ?? { type: "object", properties: {} },
        },
        server: values.serverUrl.trim()
          ? {
              url: values.serverUrl.trim(),
              timeoutSeconds: values.timeoutSeconds
                ? Number(values.timeoutSeconds)
                : undefined,
            }
          : undefined,
        messages: messagesRaw as Array<Record<string, unknown>>,
      })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to create tool"))
      }
      return data as JsonTool
    },
    onSuccess: async (tool) => {
      setFormError(null)
      setSelectedId(tool.id)
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "tools"] })
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Create failed")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: ToolFormValues) => {
      if (!selectedId) throw new Error("No tool selected")
      const parameters = parseJsonRecordInput(
        values.parametersJson,
        "Parameters"
      )
      const messagesRaw = values.messagesJson.trim()
        ? JSON.parse(values.messagesJson)
        : []
      if (!Array.isArray(messagesRaw)) {
        throw new Error("Messages must be a JSON array")
      }
      const { data, error } = await api.v1.tools({ id: selectedId }).patch({
        name: values.name.trim() || values.functionName.trim(),
        description: values.description.trim() || undefined,
        function: {
          name: values.functionName.trim(),
          description: values.description.trim() || undefined,
          parameters: parameters ?? { type: "object", properties: {} },
        },
        ...(values.serverUrl.trim()
          ? {
              server: {
                url: values.serverUrl.trim(),
                timeoutSeconds: values.timeoutSeconds
                  ? Number(values.timeoutSeconds)
                  : undefined,
              },
            }
          : {}),
        messages: messagesRaw as Array<Record<string, unknown>>,
      })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to update tool"))
      }
      return data as JsonTool
    },
    onSuccess: async () => {
      setFormError(null)
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "tools"] })
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Update failed")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("No tool selected")
      const { error } = await api.v1.tools({ id: selectedId }).delete()
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to delete tool"))
      }
    },
    onSuccess: async () => {
      setSelectedId(null)
      form.reset(defaultValues)
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "tools"] })
    },
  })

  const testMutation = useMutation({
    mutationFn: async (values: ToolFormValues) => {
      if (!selectedId) throw new Error("Save the tool before testing")
      const args = parseJsonRecordInput(
        values.testArgumentsJson,
        "Test arguments"
      )
      const { data, error } = await api.v1
        .tools({ id: selectedId })
        .test.post({
          arguments: args ?? {},
        })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Tool test failed"))
      }
      return data
    },
    onSuccess: (result) => {
      setTestResult(JSON.stringify(result, null, 2))
      setFormError(null)
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Test failed")
    },
  })

  function onSubmit(values: ToolFormValues) {
    if (selectedId) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Define Vapi-style function tools with a server URL. Attach tool IDs on
          an agent, and ConversationRelay will POST tool-calls payloads to your
          endpoint when the model invokes them.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Saved tools</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedId(null)
                form.reset(defaultValues)
                setTestResult(null)
                setFormError(null)
              }}
            >
              New
            </Button>
          </div>
          {toolsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : toolsQuery.data?.items.length ? (
            <ul className="space-y-1">
              {toolsQuery.data.items.map((tool) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === tool.id
                        ? "bg-muted font-medium"
                        : "hover:bg-muted/60"
                    }`}
                    onClick={() => {
                      setSelectedId(tool.id)
                      setTestResult(null)
                      setFormError(null)
                    }}
                  >
                    <div>{tool.name ?? tool.function?.name ?? tool.id}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {tool.server?.url ?? "No server URL"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tools yet. Create one to let agents call your APIs mid-call.
            </p>
          )}
        </aside>

        <section className="space-y-5">
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <InlineError message={formError ?? undefined} />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tool-name">Display name</Label>
                <Input
                  id="tool-name"
                  placeholder="Account lookup"
                  {...form.register("name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="function-name">Function name</Label>
                <Input
                  id="function-name"
                  placeholder="lookup_account"
                  {...form.register("functionName", { required: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-description">Description</Label>
              <Textarea
                id="tool-description"
                placeholder="Look up a customer account by email or ID."
                {...form.register("description")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                placeholder="https://example.com/tools/lookup"
                {...form.register("serverUrl")}
              />
              <p className="text-xs text-muted-foreground">
                Voice API POSTs a Vapi-compatible{" "}
                <code className="text-xs">tool-calls</code> body here. Respond
                with{" "}
                <code className="text-xs">
                  {`{ "results": [{ "toolCallId", "result" }] }`}
                </code>
                .
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout-seconds">Timeout (seconds)</Label>
              <Input
                id="timeout-seconds"
                type="number"
                {...form.register("timeoutSeconds")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parameters-json">Parameters JSON schema</Label>
              <Textarea
                id="parameters-json"
                className="min-h-40 font-mono text-xs"
                {...form.register("parametersJson")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="messages-json">Spoken messages JSON</Label>
              <Textarea
                id="messages-json"
                className="min-h-28 font-mono text-xs"
                {...form.register("messagesJson")}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {selectedId ? "Save tool" : "Create tool"}
              </Button>
              {selectedId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </form>

          {selectedId ? (
            <div className="space-y-3 border-t pt-5">
              <h3 className="text-sm font-medium">Test without a phone call</h3>
              <div className="space-y-2">
                <Label htmlFor="test-arguments">Arguments JSON</Label>
                <Textarea
                  id="test-arguments"
                  className="min-h-28 font-mono text-xs"
                  {...form.register("testArgumentsJson")}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate(form.getValues())}
              >
                Run tool test
              </Button>
              {testResult ? (
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {testResult}
                </pre>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Tool ID for agent attachment:{" "}
                <code className="text-xs">{selectedId}</code>
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
