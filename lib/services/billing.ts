import crypto from "node:crypto"
import { and, desc, eq, gte, sum } from "drizzle-orm"
import { db } from "@/lib/db"
import { getPolarSdk } from "@/lib/polar"
import * as schema from "@/lib/schema"
import { VoiceServiceError } from "./voice-service"

export const VOICE_CREDIT_EVENT_NAME =
  process.env.VOICE_CREDIT_EVENT_NAME?.trim() || "voice_credit_usage"

export const VOICE_CREDIT_PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 29,
    includedCredits: 1000,
    productEnv: "POLAR_STARTER_PRODUCT_ID",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 99,
    includedCredits: 5000,
    productEnv: "POLAR_PRO_PRODUCT_ID",
  },
} as const

export type VoiceCreditPlanId = keyof typeof VOICE_CREDIT_PLANS

export type TokenUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type UsageKind =
  | "ai_tokens"
  | "call_runtime"
  | "post_call_analysis"
  | "success_evaluation"

export type CallCreditUsage = {
  status: "pending" | "ready" | "failed"
  runtimeCredits: number
  agentCredits: number
  postCallCredits: number
  totalCredits: number
  creditsRemaining: number
  estimatedOverageCredits: number
}

export type VoiceModelPricing = {
  model: string
  inputUsdPerToken: number
  outputUsdPerToken: number
  source: "ai-gateway"
}

// Billing conversion:
// 1 Voice AI credit = $0.01 billable usage.
// 100 credits = $1.00.
// AI credits = providerCostUsd * 1.5 markup * 100.
// Runtime credits = ceil(callDurationSeconds / 60) * 1 credit/minute.
export const VOICE_CREDIT_USD = 0.01
export const AI_USAGE_MARKUP = 1.5
export const RUNTIME_CREDITS_PER_STARTED_MINUTE = 1

export const VOICE_MODEL_PRICING: Record<string, VoiceModelPricing> = {
  "deepseek/deepseek-v4-flash": {
    model: "deepseek/deepseek-v4-flash",
    inputUsdPerToken: 0.00000014,
    outputUsdPerToken: 0.00000028,
    source: "ai-gateway",
  },
  "openai/gpt-4.1": {
    model: "openai/gpt-4.1",
    inputUsdPerToken: 0.000002,
    outputUsdPerToken: 0.000008,
    source: "ai-gateway",
  },
  "openai/gpt-4.1-mini": {
    model: "openai/gpt-4.1-mini",
    inputUsdPerToken: 0.0000004,
    outputUsdPerToken: 0.0000016,
    source: "ai-gateway",
  },
  "openai/gpt-4o": {
    model: "openai/gpt-4o",
    inputUsdPerToken: 0.0000025,
    outputUsdPerToken: 0.00001,
    source: "ai-gateway",
  },
  "openai/gpt-4o-mini": {
    model: "openai/gpt-4o-mini",
    inputUsdPerToken: 0.00000015,
    outputUsdPerToken: 0.0000006,
    source: "ai-gateway",
  },
  "openai/gpt-5": {
    model: "openai/gpt-5",
    inputUsdPerToken: 0.00000125,
    outputUsdPerToken: 0.00001,
    source: "ai-gateway",
  },
  "openai/gpt-5-mini": {
    model: "openai/gpt-5-mini",
    inputUsdPerToken: 0.00000025,
    outputUsdPerToken: 0.000002,
    source: "ai-gateway",
  },
  "openai/gpt-5.4": {
    model: "openai/gpt-5.4",
    inputUsdPerToken: 0.0000025,
    outputUsdPerToken: 0.000015,
    source: "ai-gateway",
  },
  "openai/gpt-5.4-mini": {
    model: "openai/gpt-5.4-mini",
    inputUsdPerToken: 0.00000075,
    outputUsdPerToken: 0.0000045,
    source: "ai-gateway",
  },
  "google/gemini-2.5-flash": {
    model: "google/gemini-2.5-flash",
    inputUsdPerToken: 0.0000003,
    outputUsdPerToken: 0.0000025,
    source: "ai-gateway",
  },
  "google/gemini-2.5-flash-lite": {
    model: "google/gemini-2.5-flash-lite",
    inputUsdPerToken: 0.0000001,
    outputUsdPerToken: 0.0000004,
    source: "ai-gateway",
  },
  "google/gemini-2.5-pro": {
    model: "google/gemini-2.5-pro",
    inputUsdPerToken: 0.00000125,
    outputUsdPerToken: 0.00001,
    source: "ai-gateway",
  },
  "google/gemini-3.1-flash-lite-preview": {
    model: "google/gemini-3.1-flash-lite-preview",
    inputUsdPerToken: 0.00000025,
    outputUsdPerToken: 0.0000015,
    source: "ai-gateway",
  },
  "google/gemini-3.1-pro-preview": {
    model: "google/gemini-3.1-pro-preview",
    inputUsdPerToken: 0.000002,
    outputUsdPerToken: 0.000012,
    source: "ai-gateway",
  },
  "moonshotai/kimi-k2.5": {
    model: "moonshotai/kimi-k2.5",
    inputUsdPerToken: 0.0000006,
    outputUsdPerToken: 0.000003,
    source: "ai-gateway",
  },
}

export function creditsForTokenUsage(model: string, usage: TokenUsage) {
  const pricing = VOICE_MODEL_PRICING[model]
  if (!pricing) {
    return {
      credits: 0,
      providerCostUsd: 0,
      billableUsd: 0,
      priced: false,
    }
  }
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const providerCostUsd =
    inputTokens * pricing.inputUsdPerToken +
    outputTokens * pricing.outputUsdPerToken
  const billableUsd = providerCostUsd * AI_USAGE_MARKUP
  return {
    credits: billableUsd / VOICE_CREDIT_USD,
    providerCostUsd,
    billableUsd,
    priced: true,
  }
}

export function creditsForRuntime(durationSeconds: number | undefined | null) {
  const seconds = Math.max(0, Math.ceil(durationSeconds ?? 0))
  if (seconds <= 0) return 0
  return Math.ceil(seconds / 60) * RUNTIME_CREDITS_PER_STARTED_MINUTE
}

export function reconcileCreditBalance(input: {
  credited: number
  polarConsumed: number
  localConsumed: number
}) {
  // Polar event ingestion is eventually consistent. The local ledger is written
  // first, so use whichever consumed total is newer to avoid showing spent
  // credits as available immediately after a call.
  const used = Math.max(input.polarConsumed, input.localConsumed)
  return {
    used,
    credited: input.credited,
    balance: Math.max(0, input.credited - used),
    estimatedOverageCredits: Math.max(0, used - input.credited),
  }
}

export function modelPricingForApi() {
  return Object.values(VOICE_MODEL_PRICING).map((item) => ({
    ...item,
    inputCreditsPer1kTokens:
      (item.inputUsdPerToken * 1000 * AI_USAGE_MARKUP) / VOICE_CREDIT_USD,
    outputCreditsPer1kTokens:
      (item.outputUsdPerToken * 1000 * AI_USAGE_MARKUP) / VOICE_CREDIT_USD,
  }))
}

function configuredProductId(plan: VoiceCreditPlanId) {
  return process.env[VOICE_CREDIT_PLANS[plan].productEnv]?.trim()
}

function planForProduct(productId?: string | null) {
  if (!productId) return null
  return (Object.keys(VOICE_CREDIT_PLANS) as VoiceCreditPlanId[]).find(
    (plan) => configuredProductId(plan) === productId
  )
}

function polarUnavailable(): never {
  throw new VoiceServiceError(
    402,
    "BILLING_UNAVAILABLE",
    "Polar billing is not configured"
  )
}

function activeSubscriptionFromState(state: {
  activeSubscriptions?: Array<{
    productId?: string
    status?: string
    currentPeriodStart?: Date | string
    currentPeriodEnd?: Date | string
    cancelAtPeriodEnd?: boolean
  }>
}) {
  return state.activeSubscriptions?.find(
    (subscription) =>
      (subscription.status === "active" ||
        subscription.status === "trialing") &&
      Boolean(planForProduct(subscription.productId))
  )
}

async function recentUsage(userId: string, limit = 20) {
  return db
    .select()
    .from(schema.usageLedger)
    .where(eq(schema.usageLedger.userId, userId))
    .orderBy(desc(schema.usageLedger.createdAt))
    .limit(limit)
}

async function creditsUsedSince(userId: string, since?: Date) {
  const filters = [eq(schema.usageLedger.userId, userId)]
  if (since) filters.push(gte(schema.usageLedger.createdAt, since))
  const [result] = await db
    .select({ credits: sum(schema.usageLedger.credits) })
    .from(schema.usageLedger)
    .where(and(...filters))
  return Number(result?.credits ?? 0)
}

function validDate(value: Date | string | undefined) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

export function createBillingService() {
  const polar = getPolarSdk()

  async function billingStatus(userId: string) {
    const usage = await recentUsage(userId)
    if (!polar) {
      const localCreditsUsed = await creditsUsedSince(userId)
      return {
        configured: false,
        active: false,
        plan: null,
        plans: VOICE_CREDIT_PLANS,
        credits: {
          used: localCreditsUsed,
          credited: 0,
          balance: 0,
          estimatedOverageCredits: 0,
        },
        recentUsage: usage,
      }
    }
    const state = await polar.customers.getStateExternal({
      externalId: userId,
    })
    const subscription = activeSubscriptionFromState(state)
    const planId = planForProduct(subscription?.productId) ?? null
    const meter =
      state.activeMeters?.find((item) => item.creditedUnits > 0) ??
      state.activeMeters?.[0]
    const credited =
      meter?.creditedUnits ??
      (planId ? VOICE_CREDIT_PLANS[planId].includedCredits : 0)
    const localCreditsUsed = await creditsUsedSince(
      userId,
      validDate(subscription?.currentPeriodStart)
    )
    const credits = reconcileCreditBalance({
      credited,
      polarConsumed: meter?.consumedUnits ?? 0,
      localConsumed: localCreditsUsed,
    })
    return {
      configured: true,
      active: Boolean(subscription),
      plan: planId
        ? {
            ...VOICE_CREDIT_PLANS[planId],
            subscriptionStatus: subscription?.status,
            currentPeriodStart: subscription?.currentPeriodStart,
            currentPeriodEnd: subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
          }
        : null,
      plans: VOICE_CREDIT_PLANS,
      credits,
      recentUsage: usage,
    }
  }

  return {
    plans: VOICE_CREDIT_PLANS,

    modelPricing() {
      return {
        eventName: VOICE_CREDIT_EVENT_NAME,
        creditUsd: VOICE_CREDIT_USD,
        aiMarkup: AI_USAGE_MARKUP,
        runtimeCreditsPerStartedMinute: RUNTIME_CREDITS_PER_STARTED_MINUTE,
        models: modelPricingForApi(),
      }
    },

    status: billingStatus,

    async callUsage(userId: string, callId: string): Promise<CallCreditUsage> {
      const rows = await db
        .select()
        .from(schema.usageLedger)
        .where(
          and(
            eq(schema.usageLedger.userId, userId),
            eq(schema.usageLedger.callId, callId)
          )
        )
      const runtimeCredits = rows
        .filter((row) => row.kind === "call_runtime")
        .reduce((total, row) => total + row.credits, 0)
      const agentCredits = rows
        .filter((row) => row.kind === "ai_tokens")
        .reduce((total, row) => total + row.credits, 0)
      const postCallCredits = rows
        .filter(
          (row) =>
            row.kind === "post_call_analysis" ||
            row.kind === "success_evaluation"
        )
        .reduce((total, row) => total + row.credits, 0)
      let creditsRemaining = 0
      let estimatedOverageCredits = 0
      let balanceFailed = false
      try {
        const account = await billingStatus(userId)
        creditsRemaining = account.credits.balance
        estimatedOverageCredits = account.credits.estimatedOverageCredits
      } catch {
        balanceFailed = true
      }
      return {
        status:
          balanceFailed ||
          rows.some((row) => row.polarIngestStatus === "failed")
            ? "failed"
            : rows.some((row) => row.polarIngestStatus === "pending")
              ? "pending"
              : "ready",
        runtimeCredits,
        agentCredits,
        postCallCredits,
        totalCredits: runtimeCredits + agentCredits + postCallCredits,
        creditsRemaining,
        estimatedOverageCredits,
      }
    },

    async assertCanStartCall(userId: string) {
      if (!polar) polarUnavailable()
      const state = await polar.customers.getStateExternal({
        externalId: userId,
      })
      if (!activeSubscriptionFromState(state)) {
        throw new VoiceServiceError(
          402,
          "BILLING_SUBSCRIPTION_REQUIRED",
          "An active subscription is required to start calls"
        )
      }
      return true as const
    },

    async checkout(userId: string, plan: VoiceCreditPlanId) {
      if (!polar) polarUnavailable()
      const productId = configuredProductId(plan)
      if (!productId) {
        throw new VoiceServiceError(
          500,
          "BILLING_PRODUCT_NOT_CONFIGURED",
          `${VOICE_CREDIT_PLANS[plan].productEnv} is not configured`
        )
      }
      const checkout = await polar.checkouts.create({
        products: [productId],
        externalCustomerId: userId,
        successUrl: process.env.POLAR_CHECKOUT_SUCCESS_URL,
        returnUrl: process.env.POLAR_CHECKOUT_RETURN_URL,
        metadata: { plan },
      })
      return { url: checkout.url, checkoutId: checkout.id, plan }
    },

    async portal(userId: string) {
      if (!polar) polarUnavailable()
      const session = await polar.customerSessions.create({
        externalCustomerId: userId,
        returnUrl: process.env.POLAR_CHECKOUT_RETURN_URL,
      })
      return { url: session.customerPortalUrl }
    },

    async recordUsage(input: {
      userId: string
      callId?: string
      agentId?: string
      kind: UsageKind
      model?: string
      usage?: TokenUsage
      durationSeconds?: number
      credits: number
      providerCostUsd?: number
      billableUsd?: number
      raw?: Record<string, unknown>
    }) {
      if (!Number.isFinite(input.credits) || input.credits <= 0) return null
      if (input.kind === "call_runtime" && input.callId) {
        const [existing] = await db
          .select()
          .from(schema.usageLedger)
          .where(
            and(
              eq(schema.usageLedger.userId, input.userId),
              eq(schema.usageLedger.callId, input.callId),
              eq(schema.usageLedger.kind, input.kind)
            )
          )
          .limit(1)
        if (existing) return existing
      }
      const id = crypto.randomUUID()
      const raw = input.raw ?? {}
      const [row] = await db
        .insert(schema.usageLedger)
        .values({
          id,
          userId: input.userId,
          callId: input.callId,
          agentId: input.agentId,
          kind: input.kind,
          eventName: VOICE_CREDIT_EVENT_NAME,
          model: input.model,
          inputTokens: input.usage?.inputTokens,
          outputTokens: input.usage?.outputTokens,
          totalTokens: input.usage?.totalTokens,
          durationSeconds: input.durationSeconds,
          credits: input.credits,
          providerCostUsd: input.providerCostUsd,
          billableUsd: input.billableUsd,
          markup: input.providerCostUsd ? AI_USAGE_MARKUP : undefined,
          polarIngestStatus: polar ? "pending" : "skipped",
          raw,
        })
        .returning()

      if (!polar) return row

      try {
        const response = await polar.events.ingest({
          events: [
            {
              name: VOICE_CREDIT_EVENT_NAME,
              externalCustomerId: input.userId,
              externalId: id,
              timestamp: new Date(),
              metadata: {
                credits: input.credits,
                kind: input.kind,
                callId: input.callId ?? "",
                agentId: input.agentId ?? "",
                model: input.model ?? "",
                inputTokens: input.usage?.inputTokens ?? 0,
                outputTokens: input.usage?.outputTokens ?? 0,
                totalTokens: input.usage?.totalTokens ?? 0,
                durationSeconds: input.durationSeconds ?? 0,
                providerCostUsd: input.providerCostUsd ?? 0,
                billableUsd:
                  input.billableUsd ?? input.credits * VOICE_CREDIT_USD,
                markup: input.providerCostUsd ? AI_USAGE_MARKUP : 0,
              },
            },
          ],
        })
        const inserted =
          typeof response.inserted === "number" ? response.inserted : undefined
        const [updated] = await db
          .update(schema.usageLedger)
          .set({
            polarEventId: inserted ? id : undefined,
            polarIngestStatus: "ingested",
            updatedAt: new Date(),
          })
          .where(eq(schema.usageLedger.id, id))
          .returning()
        return updated
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Polar usage ingestion failed"
        const [updated] = await db
          .update(schema.usageLedger)
          .set({
            polarIngestStatus: "failed",
            polarIngestError: message,
            updatedAt: new Date(),
          })
          .where(eq(schema.usageLedger.id, id))
          .returning()
        return updated
      }
    },
  }
}

export type BillingService = ReturnType<typeof createBillingService>

let billingService: BillingService | undefined

export function getBillingService() {
  billingService ??= createBillingService()
  return billingService
}

export function setBillingServiceForTests(service: BillingService | undefined) {
  billingService = service
}
