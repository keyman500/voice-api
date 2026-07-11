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
  accountSid: string
  authToken: string
  defaultFromNumber: string
  defaultWebhookBaseUrl: string
  deleteTwilioRecordingAfterBlobUpload: boolean
}

async function fetchConfig() {
  const { data, error } = await api.v1["twilio-config"].get()
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load Twilio config"))
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
      accountSid: "",
      authToken: "",
      defaultFromNumber: "",
      defaultWebhookBaseUrl: "",
      deleteTwilioRecordingAfterBlobUpload: false,
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: LiveKitFormValues) => {
      const { data, error } = await api.v1["twilio-config"].put({
        accountSid: values.accountSid.trim(),
        authToken: values.authToken.trim(),
        defaultFromNumber: values.defaultFromNumber.trim() || undefined,
        defaultWebhookBaseUrl:
          values.defaultWebhookBaseUrl.trim() || undefined,
        deleteTwilioRecordingAfterBlobUpload:
          values.deleteTwilioRecordingAfterBlobUpload,
      })
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to save Twilio config")
        )
      }
      return data
    },
    onSuccess: async () => {
      form.reset({
        accountSid: "",
        authToken: "",
        defaultFromNumber: "",
        defaultWebhookBaseUrl: "",
        deleteTwilioRecordingAfterBlobUpload:
          configQuery.data?.deleteTwilioRecordingAfterBlobUpload ?? false,
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.livekit(),
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.v1["twilio-config"].test.post()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to test Twilio config")
        )
      }
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await api.v1["twilio-config"].delete()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to delete Twilio config")
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
        eyebrow="Twilio"
        title="Store, test, and rotate your calling credentials."
        description="Secrets are never returned from the API. This screen only renders redacted status while the form writes new encrypted credentials back through the relay endpoints."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          title="Current status"
          description="Redacted view from GET /api/v1/twilio-config."
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
              label="Account SID prefix"
              value={configQuery.data?.accountSidPrefix ?? "—"}
              mono
            />
            <KeyValue
              label="Default from number"
              value={configQuery.data?.defaultFromNumber ?? "—"}
              mono
            />
            <KeyValue
              label="Webhook base URL"
              value={configQuery.data?.defaultWebhookBaseUrl ?? "—"}
              mono
            />
            <KeyValue
              label="Twilio recording copy"
              value={
                configQuery.data?.deleteTwilioRecordingAfterBlobUpload
                  ? "Delete after Blob upload"
                  : "Keep in Twilio"
              }
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
          description="RHF-backed form wired to PUT /api/v1/twilio-config."
        >
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutate(values)
            )}
          >
            <InlineError message={saveMutation.error?.message ?? null} />

            <div className="space-y-2">
              <Label htmlFor="twilio-account">Account SID</Label>
              <Controller
                name="accountSid"
                control={form.control}
                rules={{ required: "Account SID is required" }}
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="twilio-account"
                      placeholder="AC..."
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
                  name="authToken"
                  control={form.control}
                  rules={{ required: "Auth token is required" }}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="livekit-key"
                        type="password"
                        placeholder="Twilio auth token"
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
                <Label htmlFor="default-from">Default from number</Label>
                <Controller
                  name="defaultFromNumber"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="default-from"
                        placeholder="+15555550123"
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
              <Label htmlFor="webhook-base">Default webhook base URL</Label>
              <Input
                id="webhook-base"
                placeholder="https://your-app.example.com"
                {...form.register("defaultWebhookBaseUrl")}
              />
            </div>
            <label
              htmlFor="delete-twilio-recording"
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/75 p-4 text-sm"
            >
              <input
                id="delete-twilio-recording"
                type="checkbox"
                className="mt-1 h-4 w-4 accent-teal-600"
                {...form.register("deleteTwilioRecordingAfterBlobUpload")}
              />
              <span>
                <span className="block font-medium text-foreground">
                  Delete Twilio recording after Blob upload
                </span>
                <span className="mt-1 block text-muted-foreground">
                  The workflow verifies the private Blob copy before removing
                  Twilio media.
                </span>
              </span>
            </label>

            <Button type="submit" disabled={saveMutation.isPending}>
              <RiSaveLine />
              {saveMutation.isPending ? "Saving…" : "Save Twilio config"}
            </Button>
          </form>
        </DashboardPanel>
      </div>
    </div>
  )
}
