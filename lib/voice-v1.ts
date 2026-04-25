import { Elysia } from "elysia"
import type { AuthedContext } from "@/lib/resolve-user"
import { resolveAuthedContext } from "@/lib/resolve-user"
import { voiceInMemory } from "./services"
import * as s from "./v1-schemas"

type RouteCtx = { authed: AuthedContext }

/**
 * Phase 1 voice resources — `voice-ai-sdk`–aligned names; stubbed data until LiveKit integration.
 * Mounted at `/api/v1/...` (Elysia app has prefix `/api`).
 */
export const voiceV1 = new Elysia({ name: "voice-v1", prefix: "/v1" })
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
  // Agents
  // -------------------------------------------------------------------------
  .get(
    "/agents",
    ({ authed, query }) =>
      voiceInMemory.listAgents(authed.user.id, {
        limit: query.limit,
        cursor: query.cursor,
      }),
    {
      authUser: true,
      query: s.listAgentsQuery,
      detail: {
        summary: "List agents",
        description:
          "Lists agents (SDK `agents.list`). Stub store until LiveKit + persistence land.",
        tags: ["Agents"],
      },
    }
  )

  .get(
    "/agents/:id",
    ({ authed, params, set }) => {
      const a = voiceInMemory.getAgent(authed.user.id, params.id)
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
      voiceInMemory.createAgent(authed.user.id, {
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
    ({ authed, params, body, set }) => {
      const a = voiceInMemory.updateAgent(authed.user.id, params.id, {
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
    ({ authed, params, set }) => {
      const ok = voiceInMemory.deleteAgent(authed.user.id, params.id)
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
      voiceInMemory.listCalls(authed.user.id, {
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
          "SDK `calls.list` shape; extra list filters are accepted for Vapi/Retell-style parity. Stub filters only: agentId, phoneNumberId (in metadata), callStatus.",
        tags: ["Calls"],
      },
    }
  )

  .get(
    "/calls/:id",
    ({ authed, params, set }) => {
      const c = voiceInMemory.getCall(authed.user.id, params.id)
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
    ({ authed, body, set }) => {
      if (body.agentId) {
        const a = voiceInMemory.getAgent(authed.user.id, body.agentId)
        if (!a) {
          set.status = 400
          return { error: { code: "AGENT_NOT_FOUND", message: "agentId not found" } }
        }
      }
      return voiceInMemory.createCall(authed.user.id, {
        agentId: body.agentId,
        toNumber: body.toNumber,
        fromNumber: body.fromNumber,
        metadata: body.metadata,
        providerOptions: body.providerOptions,
      })
    },
    {
      authUser: true,
      body: s.createCallBody,
      detail: { summary: "Create outbound call (stub)", tags: ["Calls"] },
    }
  )

  .patch(
    "/calls/:id",
    ({ authed, params, body, set }) => {
      const c = voiceInMemory.updateCall(authed.user.id, params.id, {
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
    ({ authed, params, set }) => {
      const ok = voiceInMemory.deleteCall(authed.user.id, params.id)
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
      voiceInMemory.listPhoneNumbers(authed.user.id, {
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
    ({ authed, params, set }) => {
      const p = voiceInMemory.getPhoneNumber(authed.user.id, params.id)
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
      voiceInMemory.createPhoneNumber(authed.user.id, {
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
      detail: { summary: "Create phone number (stub)", tags: ["Phone numbers"] },
    }
  )

  .patch(
    "/phone-numbers/:id",
    ({ authed, params, body, set }) => {
      const p = voiceInMemory.updatePhoneNumber(authed.user.id, params.id, {
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
    ({ authed, params, set }) => {
      const ok = voiceInMemory.deletePhoneNumber(authed.user.id, params.id)
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
