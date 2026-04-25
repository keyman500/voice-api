import { decryptSecret, encryptSecret } from "@/lib/services/encryption"

describe("LiveKit credential encryption", () => {
  it("round-trips secrets without storing plaintext", () => {
    const encrypted = encryptSecret("super-secret-livekit-value")
    expect(encrypted).not.toContain("super-secret-livekit-value")
    expect(decryptSecret(encrypted)).toBe("super-secret-livekit-value")
  })
})
