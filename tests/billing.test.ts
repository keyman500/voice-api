import { describe, expect, it } from "@jest/globals"
import {
  creditsForRuntime,
  creditsForTokenUsage,
  reconcileCreditBalance,
} from "@/lib/services/billing"

describe("voice credit accounting", () => {
  it("uses newer local usage while Polar meter ingestion is catching up", () => {
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
    expect(creditsForRuntime(1)).toBe(1)
    expect(creditsForRuntime(60)).toBe(1)
    expect(creditsForRuntime(61)).toBe(2)
  })

  it("prices agent tokens using the configured credit conversion", () => {
    const result = creditsForTokenUsage("openai/gpt-4o-mini", {
      inputTokens: 1000,
      outputTokens: 1000,
    })
    expect(result.priced).toBe(true)
    expect(result.credits).toBeCloseTo(0.1125)
  })

  it("prices the default DeepSeek model instead of treating it as free", () => {
    const result = creditsForTokenUsage("deepseek/deepseek-v4-flash", {
      inputTokens: 1000,
      outputTokens: 1000,
    })
    expect(result.priced).toBe(true)
    expect(result.providerCostUsd).toBeCloseTo(0.00042)
    expect(result.credits).toBeCloseTo(0.063)
  })
})
