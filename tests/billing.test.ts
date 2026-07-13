import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

jest.mock("@/lib/polar", () => ({
  getPolarSdk: jest.fn(() => null),
}))

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}))

type BillingModule = typeof import("@/lib/services/billing")

function loadBilling() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/services/billing") as BillingModule
}

function loadDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/db") as {
    db: { select: jest.Mock; insert: jest.Mock }
  }
}

function loadPolar() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/polar") as { getPolarSdk: jest.Mock }
}

function mockSelectSequence(
  db: { select: jest.Mock },
  calls: Array<{ kind: "list" | "sum"; value: unknown }>
) {
  let index = 0
  db.select.mockImplementation(() => ({
    from: () => ({
      where: () => {
        const call = calls[index++]
        if (!call) {
          throw new Error(`Unexpected db.select call #${index}`)
        }
        if (call.kind === "list") {
          return {
            orderBy: () => ({
              limit: async () => call.value,
            }),
          }
        }
        return Promise.resolve(call.value)
      },
    }),
  }))
}

describe("voice credit accounting", () => {
  it("uses newer local usage while Polar meter ingestion is catching up", () => {
    const { reconcileCreditBalance } = loadBilling()
    expect(
      reconcileCreditBalance({
        credited: 1000,
        polarConsumed: 12,
        localConsumed: 18.5,
      })
    ).toEqual({
      used: 18.5,
      credited: 1000,
      balance: 981.5,
      estimatedOverageCredits: 0,
    })
  })

  it("reports overage without exposing a negative remaining balance", () => {
    const { reconcileCreditBalance } = loadBilling()
    expect(
      reconcileCreditBalance({
        credited: 1000,
        polarConsumed: 1025,
        localConsumed: 1010,
      })
    ).toEqual({
      used: 1025,
      credited: 1000,
      balance: 0,
      estimatedOverageCredits: 25,
    })
  })

  it("charges one runtime credit for every started minute", () => {
    const { creditsForRuntime } = loadBilling()
    expect(creditsForRuntime(1)).toBe(1)
    expect(creditsForRuntime(60)).toBe(1)
    expect(creditsForRuntime(61)).toBe(2)
  })

  it("prices agent tokens using the configured credit conversion", () => {
    const { creditsForTokenUsage } = loadBilling()
    const result = creditsForTokenUsage("openai/gpt-4o-mini", {
      inputTokens: 1000,
      outputTokens: 1000,
    })
    expect(result.priced).toBe(true)
    expect(result.credits).toBeCloseTo(0.1125)
  })

  it("prices the default DeepSeek model instead of treating it as free", () => {
    const { creditsForTokenUsage } = loadBilling()
    const result = creditsForTokenUsage("deepseek/deepseek-v4-flash", {
      inputTokens: 1000,
      outputTokens: 1000,
    })
    expect(result.priced).toBe(true)
    expect(result.providerCostUsd).toBeCloseTo(0.00042)
    expect(result.credits).toBeCloseTo(0.063)
  })

  it("omits empty optional metadata from runtime events sent to Polar", () => {
    const { polarUsageMetadata } = loadBilling()
    expect(
      polarUsageMetadata({
        kind: "call_runtime",
        callId: "call-1",
        durationSeconds: 40,
        credits: 1,
      })
    ).toEqual({
      credits: 1,
      voice_credit_usage: 1,
      kind: "call_runtime",
      callId: "call-1",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationSeconds: 40,
      providerCostUsd: 0,
      billableUsd: 0.01,
      markup: 0,
    })
  })
})

describe("signup bonus credits", () => {
  const originalBonus = process.env.SIGNUP_BONUS_CREDITS
  const originalStarter = process.env.POLAR_STARTER_PRODUCT_ID
  const onConflictDoNothing = jest.fn()
  const values = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    const { getPolarSdk } = loadPolar()
    getPolarSdk.mockReturnValue(null)
    onConflictDoNothing.mockImplementation(() => ({
      returning: async () => [],
    }))
    values.mockImplementation(() => ({
      onConflictDoNothing,
    }))
    const { db } = loadDb()
    db.insert.mockImplementation(() => ({
      values,
    }))
  })

  afterEach(() => {
    if (originalBonus === undefined) {
      delete process.env.SIGNUP_BONUS_CREDITS
    } else {
      process.env.SIGNUP_BONUS_CREDITS = originalBonus
    }
    if (originalStarter === undefined) {
      delete process.env.POLAR_STARTER_PRODUCT_ID
    } else {
      process.env.POLAR_STARTER_PRODUCT_ID = originalStarter
    }
  })

  it("reads SIGNUP_BONUS_CREDITS and treats unset/invalid as zero", () => {
    const { signupBonusCredits } = loadBilling()
    delete process.env.SIGNUP_BONUS_CREDITS
    expect(signupBonusCredits()).toBe(0)
    process.env.SIGNUP_BONUS_CREDITS = "0"
    expect(signupBonusCredits()).toBe(0)
    process.env.SIGNUP_BONUS_CREDITS = "-5"
    expect(signupBonusCredits()).toBe(0)
    process.env.SIGNUP_BONUS_CREDITS = "200"
    expect(signupBonusCredits()).toBe(200)
  })

  it("does not insert a grant when the bonus is disabled", async () => {
    const { grantSignupBonus } = loadBilling()
    const { db } = loadDb()
    process.env.SIGNUP_BONUS_CREDITS = "0"
    await expect(grantSignupBonus("user-1")).resolves.toBeNull()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("inserts an idempotent signup grant when enabled", async () => {
    const { grantSignupBonus } = loadBilling()
    process.env.SIGNUP_BONUS_CREDITS = "200"
    const grant = {
      id: "grant-1",
      userId: "user-1",
      credits: 200,
      reason: "signup_bonus",
      createdAt: new Date(),
    }
    onConflictDoNothing.mockImplementationOnce(() => ({
      returning: async () => [grant],
    }))

    await expect(grantSignupBonus("user-1")).resolves.toEqual(grant)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        credits: 200,
        reason: "signup_bonus",
      })
    )
    expect(onConflictDoNothing).toHaveBeenCalled()
  })

  it("returns null when the unique grant already exists", async () => {
    const { grantSignupBonus } = loadBilling()
    process.env.SIGNUP_BONUS_CREDITS = "200"
    onConflictDoNothing.mockImplementationOnce(() => ({
      returning: async () => [],
    }))
    await expect(grantSignupBonus("user-1")).resolves.toBeNull()
  })

  it("includes local grants in billing status when Polar is off", async () => {
    const { db } = loadDb()
    const { createBillingService } = loadBilling()
    mockSelectSequence(db, [
      { kind: "list", value: [] },
      { kind: "sum", value: [{ credits: "200" }] },
      { kind: "sum", value: [{ credits: "25" }] },
    ])

    const status = await createBillingService().status("user-1")

    expect(status.configured).toBe(false)
    expect(status.active).toBe(false)
    expect(status.credits).toEqual({
      used: 25,
      credited: 200,
      balance: 175,
      estimatedOverageCredits: 0,
    })
  })

  it("allows calls with remaining local credits and blocks at zero", async () => {
    const { db } = loadDb()
    const { createBillingService } = loadBilling()
    mockSelectSequence(db, [
      { kind: "list", value: [] },
      { kind: "sum", value: [{ credits: "200" }] },
      { kind: "sum", value: [{ credits: "50" }] },
      { kind: "list", value: [] },
      { kind: "sum", value: [{ credits: "200" }] },
      { kind: "sum", value: [{ credits: "200" }] },
    ])

    const billing = createBillingService()
    await expect(billing.assertCanStartCall("user-1")).resolves.toBe(true)
    await expect(billing.assertCanStartCall("user-1")).rejects.toMatchObject({
      status: 402,
      code: "BILLING_INSUFFICIENT_CREDITS",
    })
  })

  it("allows subscribed users even when local balance is zero", async () => {
    process.env.POLAR_STARTER_PRODUCT_ID = "prod_starter"
    const { getPolarSdk } = loadPolar()
    getPolarSdk.mockReturnValue({
      customers: {
        getStateExternal: jest.fn(async () => ({
          activeSubscriptions: [
            {
              productId: "prod_starter",
              status: "active",
              currentPeriodStart: new Date("2026-01-01"),
            },
          ],
          activeMeters: [{ creditedUnits: 1000, consumedUnits: 1000 }],
        })),
      },
    })

    const { db } = loadDb()
    const { createBillingService } = loadBilling()
    mockSelectSequence(db, [
      { kind: "list", value: [] },
      { kind: "sum", value: [{ credits: "0" }] },
      { kind: "sum", value: [{ credits: "1000" }] },
    ])

    await expect(
      createBillingService().assertCanStartCall("user-1")
    ).resolves.toBe(true)
  })

  it("requires a subscription when Polar is configured and no credits remain", async () => {
    process.env.POLAR_STARTER_PRODUCT_ID = "prod_starter"
    const { getPolarSdk } = loadPolar()
    getPolarSdk.mockReturnValue({
      customers: {
        getStateExternal: jest.fn(async () => ({
          activeSubscriptions: [],
          activeMeters: [],
        })),
      },
    })

    const { db } = loadDb()
    const { createBillingService } = loadBilling()
    mockSelectSequence(db, [
      { kind: "list", value: [] },
      { kind: "sum", value: [{ credits: "0" }] },
      { kind: "sum", value: [{ credits: "0" }] },
    ])

    await expect(
      createBillingService().assertCanStartCall("user-1")
    ).rejects.toMatchObject({
      status: 402,
      code: "BILLING_SUBSCRIPTION_REQUIRED",
    })
  })
})
