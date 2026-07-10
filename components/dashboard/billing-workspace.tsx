"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  RiBankCardLine,
  RiExternalLinkLine,
  RiPulseLine,
  RiRefreshLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
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
  MetricCard,
  PanelSkeleton,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"

type BillingPlan = {
  id: "starter" | "pro"
  name: string
  priceUsd: number
  includedCredits: number
  subscriptionStatus?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
}

type UsageLedgerRow = {
  id: string
  kind: string
  model?: string | null
  credits: number
  providerCostUsd?: number | null
  durationSeconds?: number | null
  polarIngestStatus?: string | null
  createdAt?: string | Date | null
}

type BillingStatus = {
  configured: boolean
  active: boolean
  plan: BillingPlan | null
  plans: Record<"starter" | "pro", BillingPlan>
  credits: {
    used: number
    credited: number
    balance: number
    estimatedOverageCredits: number
  }
  recentUsage: UsageLedgerRow[]
}

async function fetchBillingStatus() {
  const { data, error } = await api.v1.billing.status.get()
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load billing"))
  }
  return data as BillingStatus
}

function formatCredits(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function formatUsd(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

export function BillingWorkspace() {
  const billingQuery = useQuery({
    queryKey: dashboardQueryKeys.billing(),
    queryFn: fetchBillingStatus,
  })

  const checkoutMutation = useMutation({
    mutationFn: async (plan: "starter" | "pro") => {
      const { data, error } = await api.v1.billing.checkout.post({ plan })
      if (error) {
        throw new Error(getApiErrorMessage(error, "Failed to create checkout"))
      }
      return data as { url: string }
    },
    onSuccess: (data) => {
      window.location.href = data.url
    },
  })

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.v1.billing.portal.post()
      if (error) {
        throw new Error(
          getApiErrorMessage(error, "Failed to open billing portal")
        )
      }
      return data as { url: string }
    },
    onSuccess: (data) => {
      window.location.href = data.url
    },
  })

  const status = billingQuery.data
  const errorMessage =
    billingQuery.error?.message ??
    checkoutMutation.error?.message ??
    portalMutation.error?.message

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Billing"
        title="Plans, credits, and usage"
        description="Manage subscription access, included Voice AI credits, and metered overage."
        action={
          <Button
            variant="outline"
            disabled={!status?.active || portalMutation.isPending}
            onClick={() => portalMutation.mutate()}
          >
            Manage or cancel plan
            <RiExternalLinkLine />
          </Button>
        }
      />

      {billingQuery.isPending ? <PanelSkeleton /> : null}
      <InlineError message={errorMessage ?? null} />

      {status ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Subscription"
              value={
                status.active ? (status.plan?.name ?? "Active") : "Inactive"
              }
              caption={
                status.configured
                  ? status.active
                    ? status.plan?.cancelAtPeriodEnd
                      ? `Cancels ${formatDateTime(status.plan.currentPeriodEnd)}`
                      : `Status: ${status.plan?.subscriptionStatus ?? "active"}`
                    : "Choose a plan before starting calls"
                  : "Polar env vars are not configured"
              }
            />
            <MetricCard
              label="Included credits"
              value={formatCredits(status.credits.credited)}
              caption={
                status.plan
                  ? `${status.plan.name} monthly allowance`
                  : "No active credit allowance"
              }
            />
            <MetricCard
              label="Credits used"
              value={formatCredits(status.credits.used)}
              caption={`Remaining included: ${formatCredits(status.credits.balance)}`}
            />
            <MetricCard
              label="Estimated overage"
              value={formatUsd(status.credits.estimatedOverageCredits * 0.01)}
              caption="$0.01 per additional credit"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <DashboardPanel
              title="Available plans"
              description="Active subscribers can keep calls running; credits are metered after the included amount."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                {(["starter", "pro"] as const).map((planId) => {
                  const plan = status.plans[planId]
                  const current = status.plan?.id === planId
                  return (
                    <div
                      key={planId}
                      className="rounded-[1.4rem] border border-border/70 bg-background/70 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCredits(plan.includedCredits)} included
                            credits / month
                          </p>
                        </div>
                        <StatusBadge
                          status={
                            current && status.plan?.cancelAtPeriodEnd
                              ? "ending"
                              : current
                                ? "active"
                                : "outline"
                          }
                        />
                      </div>
                      <p className="mt-4 text-3xl font-semibold">
                        {formatUsd(plan.priceUsd)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}
                          / month
                        </span>
                      </p>
                      <Button
                        className="mt-5 w-full"
                        variant={current ? "outline" : "default"}
                        disabled={
                          (current && !status.plan?.cancelAtPeriodEnd) ||
                          checkoutMutation.isPending ||
                          portalMutation.isPending
                        }
                        onClick={() =>
                          current
                            ? portalMutation.mutate()
                            : checkoutMutation.mutate(planId)
                        }
                      >
                        {current
                          ? status.plan?.cancelAtPeriodEnd
                            ? "Manage cancellation"
                            : "Current plan"
                          : `Choose ${plan.name}`}
                        {!current || status.plan?.cancelAtPeriodEnd ? (
                          <RiExternalLinkLine />
                        ) : null}
                      </Button>
                      {current ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Plan changes and cancellation are handled in the Polar
                          customer portal.
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 rounded-[1.4rem] border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                <p>Call runtime: 1 credit per started minute.</p>
                <p>
                  AI usage: charged in Voice AI credits based on the selected
                  model token rates.
                </p>
              </div>
            </DashboardPanel>

            <DashboardPanel
              title="Recent usage"
              description="Local ledger rows are written before usage is ingested into Polar."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => billingQuery.refetch()}
                >
                  <RiRefreshLine />
                </Button>
              }
            >
              <div className="space-y-3">
                {status.recentUsage.length ? (
                  status.recentUsage.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {row.kind.replace(/_/g, " ")}
                          </span>
                          <StatusBadge
                            status={row.polarIngestStatus ?? "pending"}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.model ?? "Runtime"} ·{" "}
                          {formatDateTime(String(row.createdAt ?? ""))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {row.durationSeconds ? (
                          <RiPulseLine className="size-4 text-muted-foreground" />
                        ) : (
                          <RiBankCardLine className="size-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          {formatCredits(row.credits)} credits
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.4rem] border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No usage has been metered yet.
                  </p>
                )}
              </div>
            </DashboardPanel>
          </div>
        </>
      ) : null}
    </div>
  )
}
