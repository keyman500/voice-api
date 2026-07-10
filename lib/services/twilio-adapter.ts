import crypto from "node:crypto"
import type { TwilioCredentials } from "./voice-types"

export type TwilioCallInput = {
  to: string
  from: string
  voiceUrl: string
  statusCallbackUrl?: string
  recordingStatusCallbackUrl?: string
  record?: boolean
}

export type TwilioCallResult = {
  sid: string
  accountSid?: string
  status?: string
  raw: unknown
}

export type TwilioRecordingMetadata = {
  sid: string
  status?: string
  contentType?: string
  duration?: string
  raw: unknown
}

export type TwilioRecordingMedia = {
  body: ReadableStream<Uint8Array> | Blob | ArrayBuffer
  contentType: string
  size?: number
}

export type TwilioIncomingPhoneNumber = {
  sid: string
  accountSid?: string
  phoneNumber: string
  friendlyName?: string
  voiceUrl?: string
  voiceMethod?: string
  statusCallbackUrl?: string
  statusCallbackMethod?: string
  raw: unknown
}

export type ConversationRelayOptions = {
  websocketUrl: string
  welcomeGreeting?: string
  language?: string
  ttsProvider?: string
  voice?: string
  transcriptionProvider?: string
  speechModel?: string
  interruptible?: "none" | "dtmf" | "speech" | "any"
  interruptSensitivity?: "high" | "medium" | "low"
  reportInputDuringAgentSpeech?: "none" | "dtmf" | "speech" | "any"
  recordingStatusCallbackUrl?: string
  recordingStatusCallbackMethod?: "GET" | "POST"
  recordingStatusCallbackEvent?: string
  customParameters?: Record<string, string | undefined>
}

export type TwilioAdapter = {
  testCredentials(credentials: TwilioCredentials): Promise<void>
  createCall(
    credentials: TwilioCredentials,
    input: TwilioCallInput
  ): Promise<TwilioCallResult>
  conversationRelayTwiML(input: ConversationRelayOptions): string
  getRecording(
    credentials: TwilioCredentials,
    recordingSid: string
  ): Promise<TwilioRecordingMetadata>
  fetchRecordingMedia(
    credentials: TwilioCredentials,
    recordingSid: string
  ): Promise<TwilioRecordingMedia>
  deleteRecording(
    credentials: TwilioCredentials,
    recordingSid: string
  ): Promise<void>
  listIncomingPhoneNumbers(
    credentials: TwilioCredentials
  ): Promise<TwilioIncomingPhoneNumber[]>
  updateIncomingPhoneNumberWebhook(
    credentials: TwilioCredentials,
    input: {
      sid: string
      voiceUrl: string
      voiceMethod?: "GET" | "POST"
      statusCallbackUrl?: string
      statusCallbackMethod?: "GET" | "POST"
    }
  ): Promise<TwilioIncomingPhoneNumber>
  validateSignature(input: {
    authToken: string
    url: string
    params: Record<string, string>
    signature?: string | null
  }): boolean
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function appendAttr(attrs: string[], key: string, value: string | undefined) {
  if (value) attrs.push(`${key}="${escapeXml(value)}"`)
}

function formBody(input: Record<string, string | undefined>) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) body.set(key, value)
  }
  return body
}

function signatureFor(
  authToken: string,
  url: string,
  params: Record<string, string>
) {
  const sorted = Object.keys(params).sort()
  const payload = sorted.reduce((acc, key) => acc + key + params[key], url)
  return crypto.createHmac("sha1", authToken).update(payload).digest("base64")
}

function basicAuth(credentials: TwilioCredentials) {
  return (
    "Basic " +
    Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString(
      "base64"
    )
  )
}

async function twilioJson(
  credentials: TwilioCredentials,
  path: string,
  init?: RequestInit
) {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}${path}`,
    {
      ...init,
      headers: {
        authorization: basicAuth(credentials),
        ...init?.headers,
      },
    }
  )
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      typeof raw === "object" && raw && "message" in raw
        ? String((raw as { message: unknown }).message)
        : `Twilio request failed with status ${res.status}`
    throw new Error(message)
  }
  return raw
}

export const twilioAdapter: TwilioAdapter = {
  async testCredentials(credentials) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`,
      {
        headers: {
          authorization: basicAuth(credentials),
        },
      }
    )
    if (!res.ok) {
      throw new Error(`Twilio credentials failed with status ${res.status}`)
    }
  },

  async createCall(credentials, input) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          authorization: basicAuth(credentials),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: formBody({
          To: input.to,
          From: input.from,
          Url: input.voiceUrl,
          StatusCallback: input.statusCallbackUrl,
          RecordingStatusCallback: input.recordingStatusCallbackUrl,
          Record: input.record ? "true" : undefined,
        }),
      }
    )
    const raw = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message =
        typeof raw === "object" && raw && "message" in raw
          ? String((raw as { message: unknown }).message)
          : `Twilio request failed with status ${res.status}`
      throw new Error(message)
    }
    const record = raw as Record<string, unknown>
    return {
      sid: String(record.sid),
      accountSid:
        typeof record.account_sid === "string" ? record.account_sid : undefined,
      status: typeof record.status === "string" ? record.status : undefined,
      raw,
    }
  },

  conversationRelayTwiML(input) {
    const attrs: string[] = []
    appendAttr(attrs, "url", input.websocketUrl)
    appendAttr(attrs, "welcomeGreeting", input.welcomeGreeting)
    appendAttr(attrs, "language", input.language)
    appendAttr(attrs, "ttsProvider", input.ttsProvider)
    appendAttr(attrs, "voice", input.voice)
    appendAttr(attrs, "transcriptionProvider", input.transcriptionProvider)
    appendAttr(attrs, "speechModel", input.speechModel)
    appendAttr(attrs, "interruptible", input.interruptible)
    appendAttr(attrs, "interruptSensitivity", input.interruptSensitivity)
    appendAttr(
      attrs,
      "reportInputDuringAgentSpeech",
      input.reportInputDuringAgentSpeech
    )
    const params = Object.entries(input.customParameters ?? {})
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
      .map(
        ([name, value]) =>
          `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`
      )
      .join("")
    const recordingAttrs: string[] = []
    appendAttr(
      recordingAttrs,
      "recordingStatusCallback",
      input.recordingStatusCallbackUrl
    )
    appendAttr(
      recordingAttrs,
      "recordingStatusCallbackMethod",
      input.recordingStatusCallbackMethod
    )
    appendAttr(
      recordingAttrs,
      "recordingStatusCallbackEvent",
      input.recordingStatusCallbackEvent
    )
    const recording = input.recordingStatusCallbackUrl
      ? `<Start><Recording ${recordingAttrs.join(" ")} /></Start>`
      : ""
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${recording}<Connect><ConversationRelay ${attrs.join(" ")}>${params}</ConversationRelay></Connect></Response>`
  },

  async getRecording(credentials, recordingSid) {
    const raw = await twilioJson(
      credentials,
      `/Recordings/${recordingSid}.json`
    )
    const record = raw as Record<string, unknown>
    return {
      sid: typeof record.sid === "string" ? record.sid : recordingSid,
      status: typeof record.status === "string" ? record.status : undefined,
      contentType:
        typeof record.content_type === "string"
          ? record.content_type
          : "audio/mpeg",
      duration:
        typeof record.duration === "string" ? record.duration : undefined,
      raw,
    }
  },

  async fetchRecordingMedia(credentials, recordingSid) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Recordings/${recordingSid}.mp3`,
      {
        headers: {
          authorization: basicAuth(credentials),
        },
      }
    )
    if (!res.ok || !res.body) {
      throw new Error(`Twilio recording media failed with status ${res.status}`)
    }
    return {
      body: res.body,
      contentType: res.headers.get("content-type") ?? "audio/mpeg",
      size: Number(res.headers.get("content-length")) || undefined,
    }
  },

  async deleteRecording(credentials, recordingSid) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Recordings/${recordingSid}.json`,
      {
        method: "DELETE",
        headers: {
          authorization: basicAuth(credentials),
        },
      }
    )
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Twilio recording delete failed with status ${res.status}`
      )
    }
  },

  async listIncomingPhoneNumbers(credentials) {
    const raw = await twilioJson(credentials, "/IncomingPhoneNumbers.json")
    const list = Array.isArray(
      (raw as { incoming_phone_numbers?: unknown }).incoming_phone_numbers
    )
      ? (raw as { incoming_phone_numbers: unknown[] }).incoming_phone_numbers
      : []
    return list
      .map((item) => {
        const record = item as Record<string, unknown>
        return {
          sid: String(record.sid ?? ""),
          accountSid:
            typeof record.account_sid === "string"
              ? record.account_sid
              : undefined,
          phoneNumber:
            typeof record.phone_number === "string" ? record.phone_number : "",
          friendlyName:
            typeof record.friendly_name === "string"
              ? record.friendly_name
              : undefined,
          voiceUrl:
            typeof record.voice_url === "string" ? record.voice_url : undefined,
          voiceMethod:
            typeof record.voice_method === "string"
              ? record.voice_method
              : undefined,
          statusCallbackUrl:
            typeof record.status_callback === "string"
              ? record.status_callback
              : undefined,
          statusCallbackMethod:
            typeof record.status_callback_method === "string"
              ? record.status_callback_method
              : undefined,
          raw: item,
        }
      })
      .filter((item) => item.sid && item.phoneNumber)
  },

  async updateIncomingPhoneNumberWebhook(credentials, input) {
    const raw = await twilioJson(
      credentials,
      `/IncomingPhoneNumbers/${input.sid}.json`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: formBody({
          VoiceUrl: input.voiceUrl,
          VoiceMethod: input.voiceMethod ?? "POST",
          StatusCallback: input.statusCallbackUrl,
          StatusCallbackMethod: input.statusCallbackMethod,
        }),
      }
    )
    const record = raw as Record<string, unknown>
    return {
      sid: typeof record.sid === "string" ? record.sid : input.sid,
      accountSid:
        typeof record.account_sid === "string" ? record.account_sid : undefined,
      phoneNumber:
        typeof record.phone_number === "string" ? record.phone_number : "",
      friendlyName:
        typeof record.friendly_name === "string"
          ? record.friendly_name
          : undefined,
      voiceUrl:
        typeof record.voice_url === "string" ? record.voice_url : undefined,
      voiceMethod:
        typeof record.voice_method === "string"
          ? record.voice_method
          : undefined,
      statusCallbackUrl:
        typeof record.status_callback === "string"
          ? record.status_callback
          : input.statusCallbackUrl,
      statusCallbackMethod:
        typeof record.status_callback_method === "string"
          ? record.status_callback_method
          : input.statusCallbackMethod,
      raw,
    }
  },

  validateSignature({ authToken, url, params, signature }) {
    if (!signature) return false
    const expected = signatureFor(authToken, url, params)
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  },
}
