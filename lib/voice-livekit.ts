import { Elysia } from "elysia"
import type { AuthedContext } from "@/lib/resolve-user"
import { resolveAuthedContext } from "@/lib/resolve-user"
import { getVoiceService, VoiceServiceError } from "./services"
import * as s from "./v1-schemas"

type RouteCtx = { authed: AuthedContext }

function serviceError(error: unknown, set: { status?: number | string }) {
  if (error instanceof VoiceServiceError) {
    set.status = error.status
    return { error: { code: error.code, message: error.message } }
  }
  throw error
}

/**
 * Phase 1 voice resources — `voice-ai-sdk`–aligned names backed by Drizzle + LiveKit.
 * Mounted at `/api/v1/...` (Elysia app has prefix `/api`).
 */
export const voiceLiveKit = new Elysia({ name: "voice-livekit", prefix: "/v1" })
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

  // -------------------------------------------------------------------------
  // LiveKit config
  // -------------------------------------------------------------------------
  .get(
    "/livekit-config",
    ({ authed }) => getVoiceService().getLiveKitConfig(authed.user.id),
    {
      authUser: true,
      detail: {
        summary: "Get redacted LiveKit config",
        description:
          "Returns only redacted credential status. Secrets are encrypted at rest and never returned.",
        tags: ["LiveKit config"],
      },
    }
  )

  .put(
    "/livekit-config",
    ({ authed, body }) =>
      getVoiceService().upsertLiveKitConfig(authed.user.id, {
        livekitUrl: body.livekitUrl,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        defaultSipOutboundTrunkId: body.defaultSipOutboundTrunkId,
      }),
    {
      authUser: true,
      body: s.upsertLiveKitConfigBody,
      detail: { summary: "Set LiveKit config", tags: ["LiveKit config"] },
    }
  )

  .post(
    "/livekit-config/test",
    async ({ authed, set }) => {
      try {
        return await getVoiceService().testLiveKitConfig(authed.user.id)
      } catch (error) {
        return serviceError(error, set)
      }
    },
    {
      authUser: true,
      detail: { summary: "Test LiveKit config", tags: ["LiveKit config"] },
    }
  )

  .delete(
    "/livekit-config",
    async ({ authed }) => {
      const deleted = await getVoiceService().deleteLiveKitConfig(authed.user.id)
      return { ok: true as const, deleted }
    },
    {
      authUser: true,
      detail: { summary: "Delete LiveKit config", tags: ["LiveKit config"] },
    }
  )

  // -------------------------------------------------------------------------
  // Agents
  // -------------------------------------------------------------------------
  .get(
    "/agents",
    ({ authed, query }) =>
      getVoiceService().listAgents(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
      }),
    {
      authUser: true,
      query: s.listAgentsQuery,
      detail: {
        summary: "List agents",
        description:
          "Lists stored agents (SDK `agents.list`) backed by the Voice API database.",
        tags: ["Agents"],
      },
    }
  )

  .get(
    "/agents/:id",
    async ({ authed, params, set }) => {
      const a = await getVoiceService().getAgent(authed.user.id, params.id)
      if (!a) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Agent not found" } }
      }
      return a
    },
    {
      authUser: true,
      params: s.idParam,
      detail: {
        summary: "Get agent by id",
        tags: ["Agents"],
      },
    }
  )

  .post(
    "/agents",
    ({ authed, body }) =>
      getVoiceService().createAgent(authed.user.id, {
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
    {
      authUser: true,
      body: s.createAgentBody,
      detail: { summary: "Create agent", tags: ["Agents"] },
    }
  )

  .patch(
    "/agents/:id",
    async ({ authed, params, body, set }) => {
      const a = await getVoiceService().updateAgent(authed.user.id, params.id, {
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
      })
      if (!a) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Agent not found" } }
      }
      return a
    },
    {
      authUser: true,
      params: s.idParam,
      body: s.updateAgentBody,
      detail: { summary: "Update agent", tags: ["Agents"] },
    }
  )

  .delete(
    "/agents/:id",
    async ({ authed, params, set }) => {
      const ok = await getVoiceService().deleteAgent(authed.user.id, params.id)
      if (!ok) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Agent not found" } }
      }
      return { ok: true as const }
    },
    {
      authUser: true,
      params: s.idParam,
      detail: { summary: "Delete agent", tags: ["Agents"] },
    }
  )

  // -------------------------------------------------------------------------
  // Calls
  // -------------------------------------------------------------------------
  .get(
    "/calls",
    ({ authed, query }) =>
      getVoiceService().listCalls(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
        agentId: query.agentId,
        phoneNumberId: query.phoneNumberId,
        callStatus: query.callStatus,
      }),
    {
      authUser: true,
      query: s.listCallsQuery,
      detail: {
        summary: "List calls",
        description:
          "SDK `calls.list` shape; extra list filters are accepted for Vapi/Retell-style parity.",
        tags: ["Calls"],
      },
    }
  )

  .get(
    "/calls/:id",
    async ({ authed, params, set }) => {
      const c = await getVoiceService().getCall(authed.user.id, params.id)
      if (!c) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      return c
    },
    {
      authUser: true,
      params: s.idParam,
      detail: { summary: "Get call by id", tags: ["Calls"] },
    }
  )

  .post(
    "/calls",
    async ({ authed, body, set }) => {
      try {
        return await getVoiceService().createCall(authed.user.id, {
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
    {
      authUser: true,
      body: s.createCallBody,
      detail: { summary: "Create outbound LiveKit SIP call", tags: ["Calls"] },
    }
  )

  .patch(
    "/calls/:id",
    async ({ authed, params, body, set }) => {
      const c = await getVoiceService().updateCall(authed.user.id, params.id, {
        metadata: body.metadata,
        providerOptions: body.providerOptions,
        status: body.status,
      })
      if (!c) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      return c
    },
    {
      authUser: true,
      params: s.idParam,
      body: s.updateCallBody,
      detail: {
        summary: "Update call (metadata / end via status)",
        tags: ["Calls"],
      },
    }
  )

  .delete(
    "/calls/:id",
    async ({ authed, params, set }) => {
      const ok = await getVoiceService().deleteCall(authed.user.id, params.id)
      if (!ok) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Call not found" } }
      }
      return { ok: true as const }
    },
    {
      authUser: true,
      params: s.idParam,
      detail: { summary: "Delete call", tags: ["Calls"] },
    }
  )

  // -------------------------------------------------------------------------
  // Phone numbers
  // -------------------------------------------------------------------------
  .get(
    "/phone-numbers",
    ({ authed, query }) =>
      getVoiceService().listPhoneNumbers(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
      }),
    {
      authUser: true,
      query: s.listPhoneNumbersQuery,
      detail: { summary: "List phone numbers", tags: ["Phone numbers"] },
    }
  )

  .get(
    "/phone-numbers/:id",
    async ({ authed, params, set }) => {
      const p = await getVoiceService().getPhoneNumber(authed.user.id, params.id)
      if (!p) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Phone number not found" } }
      }
      return p
    },
    {
      authUser: true,
      params: s.idParam,
      detail: { summary: "Get phone number", tags: ["Phone numbers"] },
    }
  )

  .post(
    "/phone-numbers",
    ({ authed, body }) =>
      getVoiceService().createPhoneNumber(authed.user.id, {
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
      detail: { summary: "Create phone number binding", tags: ["Phone numbers"] },
    }
  )

  .patch(
    "/phone-numbers/:id",
    async ({ authed, params, body, set }) => {
      const p = await getVoiceService().updatePhoneNumber(authed.user.id, params.id, {
        name: body.name,
        inboundAgentId: body.inboundAgentId,
        outboundAgentId: body.outboundAgentId,
        webhookUrl: body.webhookUrl,
        providerOptions: body.providerOptions,
        number: body.number,
      })
      if (!p) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Phone number not found" } }
      }
      return p
    },
    {
      authUser: true,
      params: s.idParam,
      body: s.updatePhoneNumberBody,
      detail: { summary: "Update phone number", tags: ["Phone numbers"] },
    }
  )

  .delete(
    "/phone-numbers/:id",
    async ({ authed, params, set }) => {
      const ok = await getVoiceService().deletePhoneNumber(authed.user.id, params.id)
      if (!ok) {
        set.status = 404
        return { error: { code: "NOT_FOUND", message: "Phone number not found" } }
      }
      return { ok: true as const }
    },
    {
      authUser: true,
      params: s.idParam,
      detail: { summary: "Delete phone number", tags: ["Phone numbers"] },
    }
  )
