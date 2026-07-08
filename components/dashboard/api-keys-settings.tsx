"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiDeleteBin6Line,
  RiFileCopyLine,
  RiKey2Line,
  RiRefreshLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { authClient } from "@/lib/auth-client"
import {
  dashboardQueryKeys,
  formatDateTime,
  getApiErrorMessage,
} from "@/lib/dashboard"
import {
  DashboardPanel,
  InlineError,
  KeyValue,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"

type AuthClientApiKey = {
  create(input: {
    name: string
    expiresIn?: number
  }): Promise<{ data?: CreatedApiKey | null; error?: unknown }>
  list(input?: {
    query?: { limit?: number; offset?: number; sortBy?: string; sortDirection?: "asc" | "desc" }
  }): Promise<{ data?: ApiKeyListResponse | null; error?: unknown }>
  delete(input: {
    keyId: string
  }): Promise<{ data?: unknown; error?: unknown }>
  update(input: {
    keyId: string
    enabled?: boolean
  }): Promise<{ data?: unknown; error?: unknown }>
}

type ApiKeyItem = {
  id: string
  name?: string | null
  start?: string | null
  prefix?: string | null
  enabled?: boolean | null
  lastRequest?: string | Date | null
  expiresAt?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

type ApiKeyListResponse =
  | {
      apiKeys?: ApiKeyItem[]
      total?: number
    }
  | ApiKeyItem[]

type CreatedApiKey = ApiKeyItem & {
  key?: string
}

function apiKeyClient() {
  return authClient.apiKey as unknown as AuthClientApiKey
}

function formatKeyDate(value?: string | Date | null) {
  if (value instanceof Date) return formatDateTime(value.toISOString())
  return formatDateTime(value ?? undefined)
}

function apiKeyLabel(key: ApiKeyItem) {
  const visible = [key.prefix, key.start].filter(Boolean).join("")
  return visible || key.id
}

function apiKeyItems(data?: ApiKeyListResponse | null) {
  if (!data) return []
  return Array.isArray(data) ? data : (data.apiKeys ?? [])
}

export function ApiKeysSettings() {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const keysQuery = useQuery({
    queryKey: dashboardQueryKeys.apiKeys(),
    queryFn: async () => {
      const { data, error } = await apiKeyClient().list({
        query: { limit: 50, offset: 0, sortBy: "createdAt", sortDirection: "desc" },
      })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to load API keys"))
      }
      return data ?? { apiKeys: [], total: 0 }
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error("API key name is required")
      const days = Number(expiresInDays)
      const expiresIn =
        Number.isFinite(days) && days > 0
          ? Math.round(days * 24 * 60 * 60)
          : undefined
      const { data, error } = await apiKeyClient().create({
        name: trimmedName,
        expiresIn,
      })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to create API key"))
      }
      if (!data?.key) {
        throw new Error("API key was created, but the secret was not returned")
      }
      return data
    },
    onSuccess: async (data) => {
      setName("")
      setExpiresInDays("")
      setCreatedKey(data.key ?? null)
      setCopyMessage(null)
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.apiKeys() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await apiKeyClient().delete({ keyId })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to revoke API key"))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.apiKeys() })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (input: { keyId: string; enabled: boolean }) => {
      const { error } = await apiKeyClient().update(input)
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to update API key"))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.apiKeys() })
    },
  })

  async function copyCreatedKey() {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey)
      setCopyMessage("Copied")
    } catch {
      setCopyMessage("Copy failed")
    }
  }

  const keys = apiKeyItems(keysQuery.data)

  return (
    <DashboardPanel
      title="API keys"
      description="Create keys for server-side access to the Voice API. Keys can authenticate with Authorization: Bearer or x-api-key."
    >
      <div className="space-y-6">
        <InlineError
          message={
            keysQuery.error?.message ??
            createMutation.error?.message ??
            deleteMutation.error?.message ??
            toggleMutation.error?.message ??
            null
          }
        />

        {createdKey ? (
          <div className="space-y-3 rounded-2xl border border-teal-500/30 bg-teal-500/8 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-teal-800 dark:text-teal-100">
                  API key created
                </p>
                <p className="mt-1 text-sm text-teal-800/80 dark:text-teal-100/80">
                  Copy it now. Voice API will only show this secret once.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={copyCreatedKey}>
                <RiFileCopyLine />
                {copyMessage ?? "Copy key"}
              </Button>
            </div>
            <code className="block overflow-x-auto rounded-xl border border-teal-500/20 bg-background/80 px-3 py-2 text-xs">
              {createdKey}
            </code>
          </div>
        ) : null}

        <form
          className="grid gap-4 lg:grid-cols-[1fr_220px_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="api-key-name">Key name</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production backend"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key-expiration">Expires in days</Label>
            <Input
              id="api-key-expiration"
              type="number"
              min="1"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              placeholder="Never"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createMutation.isPending}>
              <RiKey2Line />
              {createMutation.isPending ? "Creating…" : "Create key"}
            </Button>
          </div>
        </form>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {keys.length} key{keys.length === 1 ? "" : "s"} loaded
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void keysQuery.refetch()}
            disabled={keysQuery.isFetching}
          >
            <RiRefreshLine />
            Refresh
          </Button>
        </div>

        <div className="space-y-3">
          {keysQuery.isPending ? (
            <div className="rounded-2xl border border-border/70 bg-background/75 p-4 text-sm text-muted-foreground">
              Loading API keys…
            </div>
          ) : keys.length ? (
            keys.map((key) => {
              const enabled = key.enabled !== false
              return (
                <div
                  key={key.id}
                  className="grid gap-4 rounded-2xl border border-border/70 bg-background/75 p-4 lg:grid-cols-[1fr_auto]"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {key.name || "Untitled key"}
                      </p>
                      <StatusBadge
                        status={enabled ? "successful" : "unknown"}
                        label={enabled ? "enabled" : "disabled"}
                      />
                      <Badge variant="outline" className="font-mono">
                        {apiKeyLabel(key)}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <KeyValue label="Created" value={formatKeyDate(key.createdAt)} />
                      <KeyValue label="Expires" value={formatKeyDate(key.expiresAt)} />
                      <KeyValue label="Last used" value={formatKeyDate(key.lastRequest)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={toggleMutation.isPending}
                      onClick={() =>
                        toggleMutation.mutate({ keyId: key.id, enabled: !enabled })
                      }
                    >
                      {enabled ? <RiCloseCircleLine /> : <RiCheckboxCircleLine />}
                      {enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(key.id)}
                    >
                      <RiDeleteBin6Line />
                      Revoke
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/75 p-4 text-sm text-muted-foreground">
              No API keys yet.
            </div>
          )}
        </div>
      </div>
    </DashboardPanel>
  )
}
