import { describe, expect, it } from "@jest/globals"

import { decryptSecret, encryptSecret } from "@/lib/services/encryption"

describe("credential encryption", () => {
  it("round-trips secrets without storing plaintext", () => {
    const encrypted = encryptSecret("super-secret-credential-value")
    expect(encrypted).not.toContain("super-secret-credential-value")
    expect(decryptSecret(encrypted)).toBe("super-secret-credential-value")
  })
})
