import path from "node:path"
import { fileURLToPath } from "node:url"
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { openapi, fromTypes } from "@elysiajs/openapi"
import { auth } from "@/lib/auth"
import { voiceRelay } from "./voice-relay"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)

// ---------------------------------------------------------------------------
// Better Auth plugin — mounts handler + provides session macro
// ---------------------------------------------------------------------------

const betterAuth = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) return status(401)
        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

// ---------------------------------------------------------------------------
// Main Elysia app — exported so Eden can infer the full API contract
// ---------------------------------------------------------------------------

export const app = new Elysia({ prefix: "/api" })
  .use(cors())
  .use(
    openapi({
      /**
       * Required for Safari and correct multi-tab behavior. With `embedSpec: false`,
       * `@elysiajs/openapi` registers a single pre-built `Response` for `/openapi` (see
       * `get(path, embedSpec ? page : page(), …)` in the plugin) — the body can only be
       * read once, so a second request hits `Response.clone: Body has already been consumed`
       * in strict engines (WebKit). `true` uses a per-request handler and inlines the spec
       * for Scalar (`content` in `data-configuration`).
       */
      embedSpec: true,
      documentation: {
        info: {
          title: "Voice API",
          version: "0.0.1",
          description:
            "ConversationRelay-backed agents, calls, call logs, recordings, phone numbers, and Twilio configuration — aligned with `voice-ai-sdk` field names. Authenticate with a Better Auth session cookie, `Authorization: Bearer <api_key>`, or the default Better Auth `x-api-key: <api_key>` header. API keys can be created from Dashboard Settings.",
        },
        tags: [
          { name: "Authentication", description: "Use a session cookie, Bearer API key, or x-api-key header for protected v1 routes" },
          { name: "Twilio config", description: "Encrypted BYOK Twilio connection settings" },
          { name: "Agents", description: "Voice agent configuration" },
          {
            name: "Tools",
            description:
              "Vapi-style custom function tools with server URL callbacks; attach to agents via toolIds",
          },
          { name: "Calls", description: "Call resources backed by Twilio ConversationRelay and local logs" },
          { name: "Logs", description: "Call history, transcript, recording, and post-call analysis resources exposed through the calls endpoints" },
          { name: "Phone numbers", description: "Phone number bindings" },
          { name: "Twilio webhooks", description: "Twilio Voice, status, and recording callbacks" },
        ],
      },
      /** Enrich spec with TypeScript-inferred routes where runtime schema is thin. */
      references: fromTypes("lib/api.ts", {
        projectRoot,
        instanceName: "app",
      }),
    })
  )
  .use(betterAuth)
  .use(voiceRelay)

  // ── Public endpoints ────────────────────────────────────────────────────
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  .get("/version", () => ({
    version: process.env.npm_package_version ?? "0.0.1",
    name: "voice-api",
  }))

  // ── Protected endpoints ─────────────────────────────────────────────────
  .get("/session", ({ user, session }) => ({ user, session }), { auth: true })

  // Voice product surface lives under /api/v1/* (see `lib/voice-relay.ts`).

// ---------------------------------------------------------------------------
// Next.js App Router HTTP method handlers
// ---------------------------------------------------------------------------

export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const PATCH = app.fetch
export const DELETE = app.fetch

export type App = typeof app
