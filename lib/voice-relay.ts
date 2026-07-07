import { Elysia } from "elysia"
import type { AuthedContext } from "@/lib/resolve-user"
import { resolveAuthedContext } from "@/lib/resolve-user"
import { VoiceServiceError } from "./services"
import { getPostCallWorkflowStarter } from "./services/post-call-workflow-runner"
import { getVoiceRelayService } from "./services/voice-relay-service"
import * as s from "./v1-schemas"

type RouteCtx = { authed: AuthedContext }

function serviceError(error: unknown, set: { status?: number | string }) {
  if (error instanceof VoiceServiceError) {
    set.status = error.status
    return { error: { code: error.code, message: error.message } }
  }
  throw error
}

function twilioVoiceError(error: unknown) {
  if (
    error instanceof VoiceServiceError &&
    error.code === "TWILIO_SIGNATURE_INVALID"
  ) {
    return new Response("Invalid Twilio signature", { status: 401 })
  }
  if (error instanceof VoiceServiceError) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We could not connect the voice assistant. Please try again later.</Say></Response>',
      {
        status: 200,
        headers: { "content-type": "text/xml; charset=utf-8" },
      }
    )
  }
  throw error
}

async function formParams(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  const params: Record<string, string> = {}
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") params[key] = value
    }
    return params
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = new URLSearchParams(await request.text())
    for (const [key, value] of body.entries()) params[key] = value
    return params
  }
  const body = await request.formData().catch(() => null)
  if (body) {
    for (const [key, value] of body.entries()) {
      if (typeof value === "string") params[key] = value
    }
  }
  return params
}

function publicUrl(request: Request) {
  const url = new URL(request.url)
  url.protocol = request.headers.get("x-forwarded-proto") ?? url.protocol
  url.host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host
  return url.toString()
}

export const voiceRelay = new Elysia({ name: "voice-relay", prefix: "/v1" })
  .macro({
    authUser: {
      async resolve({ status, request: { headers } }) {
        const ctx = await resolveAuthedContext(headers)
        if (!ctx) {
          return status(401, {
            error: {
              code: "UNAUTHORIZED",
              message:
                "Sign in (session) or pass Authorization: Bearer <api_key>",
            },
          } as const)
        }
        return { authed: ctx } as RouteCtx
      },
    },
  })

  .get(
    "/twilio-config",
    ({ authed }) => getVoiceRelayService().getTwilioConfig(authed.user.id),
    {
      authUser: true,
      detail: {
        summary: "Get redacted Twilio config",
        tags: ["Twilio config"],
      },
    }
  )
  .put(
    "/twilio-config",
    ({ authed, body }) =>
      getVoiceRelayService().upsertTwilioConfig(authed.user.id, {
        accountSid: body.accountSid,
        authToken: body.authToken,
        defaultFromNumber: body.defaultFromNumber,
        defaultWebhookBaseUrl: body.defaultWebhookBaseUrl,
        deleteTwilioRecordingAfterBlobUpload:
          body.deleteTwilioRecordingAfterBlobUpload,
      }),
    {
      authUser: true,
      body: s.upsertTwilioConfigBody,
      detail: { summary: "Set Twilio config", tags: ["Twilio config"] },
    }
  )
  .post(
    "/twilio-config/test",
    async ({ authed, set }) => {
      try {
        return await getVoiceRelayService().testTwilioConfig(authed.user.id)
      } catch (error) {
        return serviceError(error, set)
      }
    },
    {
      authUser: true,
      detail: { summary: "Test Twilio config", tags: ["Twilio config"] },
    }
  )
  .delete(
    "/twilio-config",
    async ({ authed }) => {
      const deleted = await getVoiceRelayService().deleteTwilioConfig(authed.user.id)
      return { ok: true as const, deleted }
    },
    {
      authUser: true,
      detail: { summary: "Delete Twilio config", tags: ["Twilio config"] },
    }
  )

  .get(
    "/agents",
    ({ authed, query }) =>
      getVoiceRelayService().listAgents(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
      }),
    { authUser: true, query: s.listAgentsQuery, detail: { tags: ["Agents"] } }
  )
  .get(
    "/agents/:id",
    async ({ authed, params, set }) => {
      const agent = await getVoiceRelayService().getAgent(authed.user.id, params.id)
      if (!agent) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Agent not found" } }
      }
      return agent
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Agents"] } }
  )
  .post(
    "/agents",
    ({ authed, body }) =>
      getVoiceRelayService().createAgent(authed.user.id, {
        name: body.name,
        voice: body.voice,
        model: body.model,
        firstMessage: body.firstMessage,
        maxDurationSeconds: body.maxDurationSeconds,
        backgroundSound: body.backgroundSound,
        voicemailMessage: body.voicemailMessage,
        webhookUrl: body.webhookUrl,
        webhookTimeoutSeconds: body.webhookTimeoutSeconds,
        metadata: body.metadata,
        providerOptions: body.providerOptions,
      }),
    { authUser: true, body: s.createAgentBody, detail: { tags: ["Agents"] } }
  )
  .patch(
    "/agents/:id",
    async ({ authed, params, body, set }) => {
      const agent = await getVoiceRelayService().updateAgent(
        authed.user.id,
        params.id,
        {
          name: body.name,
          voice: body.voice,
          model: body.model,
          firstMessage: body.firstMessage,
          maxDurationSeconds: body.maxDurationSeconds,
          backgroundSound: body.backgroundSound,
          voicemailMessage: body.voicemailMessage,
          webhookUrl: body.webhookUrl,
          webhookTimeoutSeconds: body.webhookTimeoutSeconds,
          metadata: body.metadata,
          providerOptions: body.providerOptions,
        }
      )
      if (!agent) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Agent not found" } }
      }
      return agent
    },
    {
      authUser: true,
      params: s.idParam,
      body: s.updateAgentBody,
      detail: { tags: ["Agents"] },
    }
  )
  .delete(
    "/agents/:id",
    async ({ authed, params, set }) => {
      const ok = await getVoiceRelayService().deleteAgent(authed.user.id, params.id)
      if (!ok) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Agent not found" } }
      }
      return { ok: true as const }
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Agents"] } }
  )

  .get(
    "/calls",
    ({ authed, query }) =>
      getVoiceRelayService().listCalls(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
        agentId: query.agentId,
        phoneNumberId: query.phoneNumberId,
        callStatus: query.callStatus,
      }),
    { authUser: true, query: s.listCallsQuery, detail: { tags: ["Calls"] } }
  )
  .get(
    "/calls/:id",
    async ({ authed, params, set }) => {
      const call = await getVoiceRelayService().getCall(authed.user.id, params.id)
      if (!call) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      return call
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Calls"] } }
  )
  .post(
    "/calls",
    async ({ authed, body, set }) => {
      try {
        return await getVoiceRelayService().createCall(authed.user.id, {
          agentId: body.agentId,
          toNumber: body.toNumber,
          fromNumber: body.fromNumber,
          metadata: body.metadata,
          providerOptions: body.providerOptions,
        })
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { authUser: true, body: s.createCallBody, detail: { tags: ["Calls"] } }
  )
  .patch(
    "/calls/:id",
    async ({ authed, params, body, set }) => {
      const call = await getVoiceRelayService().updateCall(authed.user.id, params.id, {
        metadata: body.metadata,
        providerOptions: body.providerOptions,
        status: body.status,
      })
      if (!call) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      return call
    },
    {
      authUser: true,
      params: s.idParam,
      body: s.updateCallBody,
      detail: { tags: ["Calls"] },
    }
  )
  .delete(
    "/calls/:id",
    async ({ authed, params, set }) => {
      const ok = await getVoiceRelayService().deleteCall(authed.user.id, params.id)
      if (!ok) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      return { ok: true as const }
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Calls"] } }
  )
  .get(
    "/calls/:id/recording",
    async ({ authed, params, set }) => {
      try {
        const file = await getVoiceRelayService().downloadRecording(
          authed.user.id,
          params.id
        )
        return new Response(file.stream(), {
          headers: {
            "content-type": file.type || "application/octet-stream",
            "content-length": String(file.size),
          },
        })
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Calls"] } }
  )
  .post(
    "/calls/:id/post-call/retry",
    async ({ authed, params, set }) => {
      const call = await getVoiceRelayService().getCall(authed.user.id, params.id)
      if (!call) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      if (!call.recordingSid) {
        set.status = 400
        return {
          error: {
            code: "RECORDING_SID_MISSING",
            message: "Call does not have Twilio recording metadata yet",
          },
        }
      }
      try {
        return await getPostCallWorkflowStarter()({
          userId: authed.user.id,
          callId: params.id,
        })
      } catch (error) {
        return serviceError(error, set)
      }
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Calls"] } }
  )

  .get(
    "/phone-numbers",
    ({ authed, query }) =>
      getVoiceRelayService().listPhoneNumbers(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
      }),
    {
      authUser: true,
      query: s.listPhoneNumbersQuery,
      detail: { tags: ["Phone numbers"] },
    }
  )
  .get(
    "/phone-numbers/:id",
    async ({ authed, params, set }) => {
      const phone = await getVoiceRelayService().getPhoneNumber(
        authed.user.id,
        params.id
      )
      if (!phone) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Phone number not found" } }
      }
      return phone
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Phone numbers"] } }
  )
  .post(
    "/phone-numbers",
    ({ authed, body }) =>
      getVoiceRelayService().createPhoneNumber(authed.user.id, {
        name: body.name,
        inboundAgentId: body.inboundAgentId,
        outboundAgentId: body.outboundAgentId,
        webhookUrl: body.webhookUrl,
        areaCode: body.areaCode,
        providerOptions: body.providerOptions,
        number: body.number,
      }),
    {
      authUser: true,
      body: s.createPhoneNumberBody,
      detail: { tags: ["Phone numbers"] },
    }
  )
  .patch(
    "/phone-numbers/:id",
    async ({ authed, params, body, set }) => {
      const phone = await getVoiceRelayService().updatePhoneNumber(
        authed.user.id,
        params.id,
        {
          name: body.name,
          inboundAgentId: body.inboundAgentId,
          outboundAgentId: body.outboundAgentId,
          webhookUrl: body.webhookUrl,
          providerOptions: body.providerOptions,
          number: body.number,
        }
      )
      if (!phone) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Phone number not found" } }
      }
      return phone
    },
    {
      authUser: true,
      params: s.idParam,
      body: s.updatePhoneNumberBody,
      detail: { tags: ["Phone numbers"] },
    }
  )
  .delete(
    "/phone-numbers/:id",
    async ({ authed, params, set }) => {
      const ok = await getVoiceRelayService().deletePhoneNumber(
        authed.user.id,
        params.id
      )
      if (!ok) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Phone number not found" } }
      }
      return { ok: true as const }
    },
    { authUser: true, params: s.idParam, detail: { tags: ["Phone numbers"] } }
  )

  .post(
    "/twilio/voice",
    async ({ request, query }) => {
      try {
        const twiml = await getVoiceRelayService().handleVoiceWebhook({
          url: publicUrl(request),
          params: await formParams(request),
          signature: request.headers.get("x-twilio-signature"),
          callId: query.callId,
        })
        return new Response(twiml, {
          headers: { "content-type": "text/xml; charset=utf-8" },
        })
      } catch (error) {
        return twilioVoiceError(error)
      }
    },
    { detail: { summary: "Twilio Voice webhook", tags: ["Twilio webhooks"] } }
  )
  .post(
    "/twilio/status",
    async ({ request, query }) =>
      getVoiceRelayService().handleStatusWebhook({
        callId: query.callId,
        params: await formParams(request),
      }),
    { detail: { summary: "Twilio status webhook", tags: ["Twilio webhooks"] } }
  )
  .post(
    "/twilio/recording",
    async ({ request, query }) => {
      const result = await getVoiceRelayService().handleRecordingWebhook({
        callId: query.callId,
        params: await formParams(request),
      })
      if (result.matched && result.recordingSid) {
        try {
          await getPostCallWorkflowStarter()({
            userId: result.userId,
            callId: result.callId,
          })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Post-call workflow failed to start"
          await getVoiceRelayService().markPostCallWorkflowFailed({
            userId: result.userId,
            callId: result.callId,
            error: message,
          })
          return { ...result, workflowStarted: false, workflowError: message }
        }
      }
      return result.matched && result.recordingSid
        ? { ...result, workflowStarted: true }
        : result
    },
    {
      detail: { summary: "Twilio recording webhook", tags: ["Twilio webhooks"] },
    }
  )
