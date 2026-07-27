import crypto from "node:crypto"
import type { TelnyxCredentials } from "./voice-types"

export type TelnyxCallInput = {
  to: string
  from: string
  voiceUrl: string
  statusCallbackUrl?: string
  recordingStatusCallbackUrl?: string
  record?: boolean
}

export type TelnyxCallResult = {
  sid: string
  accountSid?: string
  status?: string
  raw: unknown
}

export type TelnyxRecordingMetadata = {
  sid: string
  status?: string
  contentType?: string
  duration?: string
  downloadUrl?: string
  raw: unknown
}

export type TelnyxRecordingMedia = {
  body: ReadableStream<Uint8Array> | Blob | ArrayBuffer
  contentType: string
  size?: number
}

export type TelnyxIncomingPhoneNumber = {
  id: string
  accountSid?: string
  phoneNumber: string
  friendlyName?: string
  connectionId?: string
  raw: unknown
}

export type TelnyxStreamOptions = {
  websocketUrl: string
  recordingStatusCallbackUrl?: string
  customParameters?: Record<string, string | undefined>
  welcomeGreeting?: string
}

export type TelnyxAdapter = {
  testCredentials(credentials: TelnyxCredentials): Promise<void>
  createCall(
    credentials: TelnyxCredentials,
    input: TelnyxCallInput
  ): Promise<TelnyxCallResult>
  streamTeXML(input: TelnyxStreamOptions): string
  sayTeXML(message: string): string
  getRecording(
    credentials: TelnyxCredentials,
    recordingSid: string
  ): Promise<TelnyxRecordingMetadata>
  fetchRecordingMedia(
    credentials: TelnyxCredentials,
    recordingSid: string,
    options?: { downloadUrl?: string }
  ): Promise<TelnyxRecordingMedia>
  deleteRecording(
    credentials: TelnyxCredentials,
    recordingSid: string
  ): Promise<void>
  listIncomingPhoneNumbers(
    credentials: TelnyxCredentials
  ): Promise<TelnyxIncomingPhoneNumber[]>
  updateIncomingPhoneNumberConnection(
    credentials: TelnyxCredentials,
    input: {
      id: string
      connectionId: string
    }
  ): Promise<TelnyxIncomingPhoneNumber>
  validateSignature(input: {
    publicKey: string
    rawBody: string
    signature?: string | null
    timestamp?: string | null
    toleranceSeconds?: number
  }): boolean
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function bearerAuth(credentials: TelnyxCredentials) {
  return `Bearer ${credentials.apiKey}`
}

async function telnyxJson(
  credentials: TelnyxCredentials,
  path: string,
  init?: RequestInit
) {
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    ...init,
    headers: {
      authorization: bearerAuth(credentials),
      accept: "application/json",
      "content-type": "application/json",
      ...init?.headers,
    },
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      typeof raw === "object" &&
      raw &&
      "errors" in raw &&
      Array.isArray((raw as { errors: unknown[] }).errors) &&
      (raw as { errors: Array<{ detail?: unknown }> }).errors[0]?.detail
        ? String(
            (raw as { errors: Array<{ detail?: unknown }> }).errors[0].detail
          )
        : `Telnyx request failed with status ${res.status}`
    throw new Error(message)
  }
  return raw
}

function decodePublicKey(publicKey: string) {
  const trimmed = publicKey.trim()
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return crypto.createPublicKey(trimmed)
  }
  return crypto.createPublicKey({
    key: Buffer.from(trimmed, "base64"),
    format: "der",
    type: "spki",
  })
}

export const telnyxAdapter: TelnyxAdapter = {
  async testCredentials(credentials) {
    const res = await fetch("https://api.telnyx.com/v2/balance", {
      headers: {
        authorization: bearerAuth(credentials),
        accept: "application/json",
      },
    })
    if (!res.ok) {
      throw new Error(`Telnyx credentials failed with status ${res.status}`)
    }
  },

  async createCall(credentials, input) {
    const body: Record<string, unknown> = {
      ApplicationSid: credentials.applicationSid,
      To: input.to,
      From: input.from,
      Url: input.voiceUrl,
      UrlMethod: "POST",
    }
    if (input.statusCallbackUrl) {
      body.StatusCallback = input.statusCallbackUrl
      body.StatusCallbackMethod = "POST"
    }
    if (input.recordingStatusCallbackUrl) {
      body.RecordingStatusCallback = input.recordingStatusCallbackUrl
      body.RecordingStatusCallbackMethod = "POST"
    }
    if (input.record) {
      body.Record = true
      body.RecordingChannels = "dual"
    }

    const raw = await telnyxJson(
      credentials,
      `/texml/Accounts/${encodeURIComponent(credentials.accountSid)}/Calls`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    )
    const record =
      typeof raw === "object" &&
      raw &&
      "data" in raw &&
      typeof (raw as { data: unknown }).data === "object" &&
      (raw as { data: unknown }).data
        ? ((raw as { data: Record<string, unknown> }).data as Record<
            string,
            unknown
          >)
        : (raw as Record<string, unknown>)

    const sid =
      typeof record.call_sid === "string"
        ? record.call_sid
        : typeof record.CallSid === "string"
          ? record.CallSid
          : typeof record.sid === "string"
            ? record.sid
            : typeof record.id === "string"
              ? record.id
              : ""
    if (!sid) {
      throw new Error("Telnyx create call response missing call sid")
    }
    return {
      sid,
      accountSid:
        typeof record.account_sid === "string"
          ? record.account_sid
          : typeof record.AccountSid === "string"
            ? record.AccountSid
            : credentials.accountSid,
      status:
        typeof record.status === "string"
          ? record.status
          : typeof record.CallStatus === "string"
            ? record.CallStatus
            : undefined,
      raw,
    }
  },

  streamTeXML(input) {
    const parameters = Object.entries(input.customParameters ?? {})
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
      .map(
        ([name, value]) =>
          `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`
      )
      .join("")
    const recording = input.recordingStatusCallbackUrl
      ? `<Start><Recording recordingStatusCallback="${escapeXml(input.recordingStatusCallbackUrl)}" recordingStatusCallbackMethod="POST" /></Start>`
      : ""
    const greeting = input.welcomeGreeting
      ? `<Say>${escapeXml(input.welcomeGreeting)}</Say>`
      : ""
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${recording}${greeting}<Start><Stream url="${escapeXml(input.websocketUrl)}" track="both_tracks" bidirectionalMode="rtp">${parameters}</Stream></Start></Response>`
  },

  sayTeXML(message) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say></Response>`
  },

  async getRecording(credentials, recordingSid) {
    const raw = await telnyxJson(
      credentials,
      `/recordings/${encodeURIComponent(recordingSid)}`
    )
    const record =
      typeof raw === "object" &&
      raw &&
      "data" in raw &&
      typeof (raw as { data: unknown }).data === "object" &&
      (raw as { data: unknown }).data
        ? ((raw as { data: Record<string, unknown> }).data as Record<
            string,
            unknown
          >)
        : (raw as Record<string, unknown>)
    const downloadUrls =
      typeof record.download_urls === "object" && record.download_urls
        ? (record.download_urls as Record<string, unknown>)
        : undefined
    return {
      sid: typeof record.id === "string" ? record.id : recordingSid,
      status: typeof record.status === "string" ? record.status : undefined,
      contentType: "audio/mpeg",
      duration:
        typeof record.duration_millis === "number"
          ? String(Math.round(record.duration_millis / 1000))
          : undefined,
      downloadUrl:
        typeof downloadUrls?.mp3 === "string"
          ? downloadUrls.mp3
          : typeof downloadUrls?.wav === "string"
            ? downloadUrls.wav
            : undefined,
      raw,
    }
  },

  async fetchRecordingMedia(credentials, recordingSid, options) {
    let downloadUrl = options?.downloadUrl
    if (!downloadUrl) {
      const metadata = await this.getRecording(credentials, recordingSid)
      downloadUrl = metadata.downloadUrl
    }
    if (!downloadUrl) {
      throw new Error("Telnyx recording download URL is missing")
    }
    const res = await fetch(downloadUrl, {
      headers: {
        authorization: bearerAuth(credentials),
      },
    })
    if (!res.ok || !res.body) {
      throw new Error(`Telnyx recording media failed with status ${res.status}`)
    }
    return {
      body: res.body,
      contentType: res.headers.get("content-type") ?? "audio/mpeg",
      size: Number(res.headers.get("content-length")) || undefined,
    }
  },

  async deleteRecording(credentials, recordingSid) {
    const res = await fetch(
      `https://api.telnyx.com/v2/recordings/${encodeURIComponent(recordingSid)}`,
      {
        method: "DELETE",
        headers: {
          authorization: bearerAuth(credentials),
          accept: "application/json",
        },
      }
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Telnyx recording delete failed with status ${res.status}`
      )
    }
  },

  async listIncomingPhoneNumbers(credentials) {
    const raw = await telnyxJson(credentials, "/phone_numbers?page[size]=250")
    const list = Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : []
    return list
      .map((item) => {
        const record = item as Record<string, unknown>
        return {
          id: String(record.id ?? ""),
          accountSid: credentials.accountSid,
          phoneNumber:
            typeof record.phone_number === "string" ? record.phone_number : "",
          friendlyName:
            typeof record.customer_reference === "string"
              ? record.customer_reference
              : undefined,
          connectionId:
            typeof record.connection_id === "string"
              ? record.connection_id
              : undefined,
          raw: item,
        }
      })
      .filter((item) => item.id && item.phoneNumber)
  },

  async updateIncomingPhoneNumberConnection(credentials, input) {
    const raw = await telnyxJson(
      credentials,
      `/phone_numbers/${encodeURIComponent(input.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          connection_id: input.connectionId,
        }),
      }
    )
    const record =
      typeof raw === "object" &&
      raw &&
      "data" in raw &&
      typeof (raw as { data: unknown }).data === "object" &&
      (raw as { data: unknown }).data
        ? ((raw as { data: Record<string, unknown> }).data as Record<
            string,
            unknown
          >)
        : (raw as Record<string, unknown>)
    return {
      id: typeof record.id === "string" ? record.id : input.id,
      accountSid: credentials.accountSid,
      phoneNumber:
        typeof record.phone_number === "string" ? record.phone_number : "",
      friendlyName:
        typeof record.customer_reference === "string"
          ? record.customer_reference
          : undefined,
      connectionId:
        typeof record.connection_id === "string"
          ? record.connection_id
          : input.connectionId,
      raw,
    }
  },

  validateSignature({
    publicKey,
    rawBody,
    signature,
    timestamp,
    toleranceSeconds = 300,
  }) {
    if (!signature || !timestamp || !publicKey) return false
    const ts = Number.parseInt(timestamp, 10)
    if (!Number.isFinite(ts)) return false
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts)
    if (ageSeconds > toleranceSeconds) return false
    try {
      const key = decodePublicKey(publicKey)
      const payload = Buffer.from(`${timestamp}|${rawBody}`)
      const sig = Buffer.from(signature, "base64")
      return crypto.verify(null, payload, key, sig)
    } catch {
      return false
    }
  },
}
