"use client"

import { Controller, useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiDeleteBin6Line, RiFlaskLine, RiSaveLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "@/components/dashboard/control-room-ui"
import type { LiveKitConfigResponse } from "@/lib/dashboard"

type LiveKitFormValues = {
  livekitUrl: string
  apiKey: string
  apiSecret: string
  defaultSipOutboundTrunkId: string
}

async function fetchConfig() {
  const { data, error } = await api.v1["livekit-config"].get()
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load LiveKit config"))
  }
  return data as LiveKitConfigResponse
}

export function LiveKitSettings() {
  const queryClient = useQueryClient()
  const configQuery = useQuery({
    queryKey: dashboardQueryKeys.livekit(),
    queryFn: fetchConfig,
  })

  const form = useForm<LiveKitFormValues>({
    defaultValues: {
      livekitUrl: "",
      apiKey: "",
      apiSecret: "",
      defaultSipOutboundTrunkId: "",
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: LiveKitFormValues) => {
      const { data, error } = await api.v1["livekit-config"].put({
        livekitUrl: values.livekitUrl.trim(),
        apiKey: values.apiKey.trim(),
        apiSecret: values.apiSecret.trim(),
        defaultSipOutboundTrunkId:
          values.defaultSipOutboundTrunkId.trim() || undefined,
      })
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to save LiveKit config")
        )
      }
      return data
    },
    onSuccess: async () => {
      form.reset({
        livekitUrl: "",
        apiKey: "",
        apiSecret: "",
        defaultSipOutboundTrunkId: "",
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.livekit(),
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.v1["livekit-config"].test.post()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to test LiveKit config")
        )
      }
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await api.v1["livekit-config"].delete()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to delete LiveKit config")
        )
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.livekit(),
      })
    },
  })

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="LiveKit"
        title="Store, test, and rotate your calling credentials."
        description="Secrets are never returned from the API. This screen only renders redacted status while the form writes new encrypted credentials back through the existing endpoints."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          title="Current status"
          description="Redacted view from GET /api/v1/livekit-config."
        >
          <InlineError message={configQuery.error?.message ?? null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <KeyValue
              label="Configured"
              value={configQuery.data?.configured ? "Yes" : "No"}
            />
            <KeyValue
              label="Provider source"
              value={configQuery.data?.providerSource ?? "none"}
            />
            <KeyValue
              label="LiveKit URL"
              value={configQuery.data?.livekitUrl ?? "—"}
              mono
            />
            <KeyValue
              label="API key prefix"
              value={configQuery.data?.apiKeyPrefix ?? "—"}
              mono
            />
            <KeyValue
              label="Default SIP trunk"
              value={configQuery.data?.defaultSipOutboundTrunkId ?? "—"}
              mono
            />
            <KeyValue
              label="Updated"
              value={formatDateTime(configQuery.data?.updatedAt)}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              <RiFlaskLine />
              {testMutation.isPending ? "Testing…" : "Test config"}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <RiDeleteBin6Line />
              Delete config
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <InlineError
              message={
                testMutation.error?.message ??
                deleteMutation.error?.message ??
                null
              }
            />
            {testMutation.data && "providerSource" in testMutation.data ? (
              <div className="rounded-2xl border border-teal-500/30 bg-teal-500/8 px-4 py-3 text-sm text-teal-700 dark:text-teal-200">
                Configuration test passed using{" "}
                {testMutation.data.providerSource} credentials.
              </div>
            ) : null}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Save new credentials"
          description="RHF-backed form wired to PUT /api/v1/livekit-config."
        >
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutate(values)
            )}
          >
            <InlineError message={saveMutation.error?.message ?? null} />

            <div className="space-y-2">
              <Label htmlFor="livekit-url">LiveKit URL</Label>
              <Controller
                name="livekitUrl"
                control={form.control}
                rules={{ required: "LiveKit URL is required" }}
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="livekit-url"
                      placeholder="https://your-project.livekit.cloud"
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
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="livekit-key">API key</Label>
                <Controller
                  name="apiKey"
                  control={form.control}
                  rules={{ required: "API key is required" }}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="livekit-key"
                        placeholder="lk_api_..."
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
                <Label htmlFor="livekit-secret">API secret</Label>
                <Controller
                  name="apiSecret"
                  control={form.control}
                  rules={{ required: "API secret is required" }}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="livekit-secret"
                        type="password"
                        placeholder="Secret"
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
            <div className="space-y-2">
              <Label htmlFor="sip-trunk">Default outbound SIP trunk ID</Label>
              <Input
                id="sip-trunk"
                placeholder="trunk-1"
                {...form.register("defaultSipOutboundTrunkId")}
              />
            </div>

            <Button type="submit" disabled={saveMutation.isPending}>
              <RiSaveLine />
              {saveMutation.isPending ? "Saving…" : "Save LiveKit config"}
            </Button>
          </form>
        </DashboardPanel>
      </div>
    </div>
  )
}
