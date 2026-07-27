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
  type TelnyxConfigResponse,
} from "@/lib/dashboard"
import {
  DashboardPageIntro,
  DashboardPanel,
  InlineError,
  KeyValue,
} from "@/components/dashboard/control-room-ui"

type TelnyxFormValues = {
  apiKey: string
  publicKey: string
  accountSid: string
  applicationSid: string
  defaultFromNumber: string
  deleteTelnyxRecordingAfterBlobUpload: boolean
}

async function fetchConfig() {
  const { data, error } = await api.v1["telnyx-config"].get()
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load Telnyx config"))
  }
  return data as TelnyxConfigResponse
}

export function TelnyxSettings() {
  const queryClient = useQueryClient()
  const configQuery = useQuery({
    queryKey: dashboardQueryKeys.telnyx(),
    queryFn: fetchConfig,
  })

  const form = useForm<TelnyxFormValues>({
    defaultValues: {
      apiKey: "",
      publicKey: "",
      accountSid: "",
      applicationSid: "",
      defaultFromNumber: "",
      deleteTelnyxRecordingAfterBlobUpload: false,
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: TelnyxFormValues) => {
      const { data, error } = await api.v1["telnyx-config"].put({
        apiKey: values.apiKey.trim(),
        publicKey: values.publicKey.trim() || undefined,
        accountSid: values.accountSid.trim(),
        applicationSid: values.applicationSid.trim(),
        defaultFromNumber: values.defaultFromNumber.trim() || undefined,
        deleteTelnyxRecordingAfterBlobUpload:
          values.deleteTelnyxRecordingAfterBlobUpload,
      })
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to save Telnyx config")
        )
      }
      return data
    },
    onSuccess: async () => {
      form.reset({
        apiKey: "",
        publicKey: "",
        accountSid: "",
        applicationSid: "",
        defaultFromNumber: "",
        deleteTelnyxRecordingAfterBlobUpload:
          configQuery.data?.deleteTelnyxRecordingAfterBlobUpload ?? false,
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.telnyx(),
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.v1["telnyx-config"].test.post()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to test Telnyx config")
        )
      }
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await api.v1["telnyx-config"].delete()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to delete Telnyx config")
        )
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.telnyx(),
      })
    },
  })

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Telnyx"
        title="Bring your own Telnyx credentials alongside Twilio."
        description="Store an API key, TeXML application, and optional public key for webhook verification. Secrets are never returned from the API."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          title="Current status"
          description="Redacted view from GET /api/v1/telnyx-config."
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
              label="Application SID prefix"
              value={configQuery.data?.applicationSidPrefix ?? "—"}
              mono
            />
            <KeyValue
              label="API key prefix"
              value={configQuery.data?.apiKeyPrefix ?? "—"}
              mono
            />
            <KeyValue
              label="Public key"
              value={
                configQuery.data?.publicKeyConfigured
                  ? "Configured"
                  : "Not set"
              }
            />
            <KeyValue
              label="Default from number"
              value={configQuery.data?.defaultFromNumber ?? "—"}
              mono
            />
            <KeyValue
              label="Telnyx recording copy"
              value={
                configQuery.data?.deleteTelnyxRecordingAfterBlobUpload
                  ? "Delete after Blob upload"
                  : "Keep in Telnyx"
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
          description="RHF-backed form wired to PUT /api/v1/telnyx-config."
        >
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutate(values)
            )}
          >
            <InlineError message={saveMutation.error?.message ?? null} />

            <div className="space-y-2">
              <Label htmlFor="telnyx-api-key">API Key</Label>
              <Controller
                name="apiKey"
                control={form.control}
                rules={{ required: "API key is required" }}
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="telnyx-api-key"
                      type="password"
                      placeholder="KEY..."
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
                <Label htmlFor="telnyx-account">Account SID</Label>
                <Controller
                  name="accountSid"
                  control={form.control}
                  rules={{ required: "Account SID is required" }}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="telnyx-account"
                        placeholder="Telnyx account SID"
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
                <Label htmlFor="telnyx-application">Application SID</Label>
                <Controller
                  name="applicationSid"
                  control={form.control}
                  rules={{ required: "TeXML Application SID is required" }}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="telnyx-application"
                        placeholder="TeXML application / connection ID"
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

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telnyx-public-key">
                  Public key (optional)
                </Label>
                <Controller
                  name="publicKey"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="telnyx-public-key"
                        placeholder="Base64 or PEM public key"
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
                <Label htmlFor="telnyx-default-from">Default from number</Label>
                <Controller
                  name="defaultFromNumber"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="telnyx-default-from"
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

            <label
              htmlFor="delete-telnyx-recording"
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/75 p-4 text-sm"
            >
              <input
                id="delete-telnyx-recording"
                type="checkbox"
                className="mt-1 h-4 w-4 accent-teal-600"
                {...form.register("deleteTelnyxRecordingAfterBlobUpload")}
              />
              <span>
                <span className="block font-medium text-foreground">
                  Delete Telnyx recording after Blob upload
                </span>
                <span className="mt-1 block text-muted-foreground">
                  The workflow verifies the private Blob copy before removing
                  Telnyx media.
                </span>
              </span>
            </label>

            <Button type="submit" disabled={saveMutation.isPending}>
              <RiSaveLine />
              {saveMutation.isPending ? "Saving…" : "Save Telnyx config"}
            </Button>
          </form>
        </DashboardPanel>
      </div>
    </div>
  )
}
