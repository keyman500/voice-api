import { describe, expect, it } from "@jest/globals"

import {
  formatDuration,
  getApiErrorMessage,
  parseJsonRecordInput,
  parseListInput,
} from "@/lib/dashboard"

describe("dashboard helpers", () => {
  it("parses JSON object input for advanced fields", () => {
    expect(parseJsonRecordInput('{"team":"ops"}', "Metadata")).toEqual({
      team: "ops",
    })
    expect(parseJsonRecordInput("   ", "Metadata")).toBeUndefined()
  })

  it("rejects invalid advanced JSON payloads", () => {
    expect(() => parseJsonRecordInput("[1,2,3]", "Provider options")).toThrow(
      "Provider options must be a JSON object"
    )
    expect(() => parseJsonRecordInput("{oops", "Provider options")).toThrow(
      "Provider options must be valid JSON"
    )
  })

  it("parses line or comma separated list input", () => {
    expect(parseListInput("kb-a\nkb-b, kb-c")).toEqual(["kb-a", "kb-b", "kb-c"])
    expect(parseListInput("")).toBeUndefined()
  })

  it("formats durations for control-room summaries", () => {
    expect(formatDuration(undefined)).toBe("—")
    expect(formatDuration(42)).toBe("42s")
    expect(formatDuration(125)).toBe("2m 5s")
    expect(formatDuration(7200)).toBe("2h")
  })

  it("extracts nested Eden error messages", () => {
    expect(
      getApiErrorMessage(
        {
          value: {
            error: {
              message: "LiveKit config missing",
            },
          },
        },
        "fallback"
      )
    ).toBe("LiveKit config missing")
  })
})
