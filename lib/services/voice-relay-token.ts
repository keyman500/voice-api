import crypto from "node:crypto"

type VoiceRelayTokenPayload = {
  version: 1
  callId: string
  expiresAt: number
}

const DEFAULT_TOKEN_TTL_SECONDS = 4 * 60 * 60

function relayTokenSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for relay tokens")
  }
  return secret
}

function signature(encodedPayload: string) {
  return crypto
    .createHmac("sha256", relayTokenSecret())
    .update(encodedPayload)
    .digest("base64url")
}

export function createVoiceRelayToken(input: {
  callId: string
  expiresInSeconds?: number
  now?: number
}) {
  const payload: VoiceRelayTokenPayload = {
    version: 1,
    callId: input.callId,
    expiresAt:
      Math.floor((input.now ?? Date.now()) / 1000) +
      (input.expiresInSeconds ?? DEFAULT_TOKEN_TTL_SECONDS),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  )
  return `${encodedPayload}.${signature(encodedPayload)}`
}

export function verifyVoiceRelayToken(
  token: string,
  input: { callId: string; now?: number }
): VoiceRelayTokenPayload | null {
  const [encodedPayload, suppliedSignature, extra] = token.split(".")
  if (!encodedPayload || !suppliedSignature || extra) return null
  const expectedSignature = signature(encodedPayload)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<VoiceRelayTokenPayload>
    if (
      payload.version !== 1 ||
      payload.callId !== input.callId ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt < Math.floor((input.now ?? Date.now()) / 1000)
    ) {
      return null
    }
    return payload as VoiceRelayTokenPayload
  } catch {
    return null
  }
}

export function websocketSignatureUrl(requestUrl: string) {
  const url = new URL(requestUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}
