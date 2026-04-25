import path from "node:path"
import { fileURLToPath } from "node:url"
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { openapi, fromTypes } from "@elysiajs/openapi"
import { auth } from "@/lib/auth"
import { voiceV1 } from "./voice-v1"

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
            "Phase 1: agents, calls, and phone numbers — aligned with `voice-ai-sdk` field names. Authenticate with a Better Auth session cookie or `Authorization: Bearer <api_key>`.",
        },
        tags: [
          { name: "Agents", description: "Voice agent configuration" },
          { name: "Calls", description: "Call resources (stub; LiveKit integration later)" },
          { name: "Phone numbers", description: "Phone number bindings" },
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
  .use(voiceV1)

  // ── Public endpoints ────────────────────────────────────────────────────
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  .get("/version", () => ({
    version: process.env.npm_package_version ?? "0.0.1",
    name: "voice-api",
  }))

  // ── Protected endpoints ─────────────────────────────────────────────────
  .get("/session", ({ user, session }) => ({ user, session }), { auth: true })

  // Voice product surface lives under /api/v1/* (see `lib/voice-v1.ts`).

// ---------------------------------------------------------------------------
// Next.js App Router HTTP method handlers
// ---------------------------------------------------------------------------

export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const PATCH = app.fetch
export const DELETE = app.fetch

export type App = typeof app
