import { describe, expect, it } from "@jest/globals"

import { parseTranscript } from "@/lib/transcript"

describe("parseTranscript", () => {
  it("returns an empty array for null, undefined, or blank input", () => {
    expect(parseTranscript(null)).toEqual([])
    expect(parseTranscript(undefined)).toEqual([])
    expect(parseTranscript("   \n  ")).toEqual([])
  })

  it("parses a single turn", () => {
    expect(parseTranscript("user: I need help")).toEqual([
      { role: "user", text: "I need help" },
    ])
  })

  it("parses multiple turns", () => {
    expect(
      parseTranscript(
        "user: I need help\nassistant: Hello there\nuser: Thanks"
      )
    ).toEqual([
      { role: "user", text: "I need help" },
      { role: "assistant", text: "Hello there" },
      { role: "user", text: "Thanks" },
    ])
  })

  it("normalizes role casing", () => {
    expect(parseTranscript("USER: Hi\nAssistant: Hello")).toEqual([
      { role: "user", text: "Hi" },
      { role: "assistant", text: "Hello" },
    ])
  })

  it("parses system and tool roles", () => {
    expect(parseTranscript("system: Call started\ntool: lookup_account")).toEqual(
      [
        { role: "system", text: "Call started" },
        { role: "tool", text: "lookup_account" },
      ]
    )
  })

  it("appends unmatched lines to the previous turn", () => {
    expect(
      parseTranscript("assistant: Hello there\nThis continues on the next line")
    ).toEqual([
      { role: "assistant", text: "Hello there\nThis continues on the next line" },
    ])
  })

  it("stores unmatched leading lines as unknown", () => {
    expect(parseTranscript("No role prefix here\nuser: After that")).toEqual([
      { role: "unknown", text: "No role prefix here" },
      { role: "user", text: "After that" },
    ])
  })
})
