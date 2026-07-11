# AGENTS.md

## Product Background

**Voice API** is an open-source voice AI API platform inspired by Vapi and Retell.
The goal is a fully typed, self-hostable API that lets developers build voice AI products
without being locked into a proprietary vendor.

### Key references

- SDK: [`keyman500/voice-ai-sdk`](https://github.com/keyman500/voice-ai-sdk) — maintain compatibility
- API style: Vapi / Retell — REST-first, webhook callbacks, typed events

---

## Architecture

```
Next.js App Router
└── app/api/[[...slugs]]/route.ts   ← mounts the Elysia app
    └── lib/api.ts                  ← Elysia app (prefix: /api)
        ├── .mount(auth.handler)    ← Better Auth under /api/auth/*
        ├── GET /api/health
        ├── GET /api/version
        ├── GET /api/session        ← protected via `auth: true` macro (session cookie)
        └── lib/voice-v1.ts         ← GET|POST|PATCH|DELETE /api/v1/… (session or Bearer API key)
```

### Data layer

- **Drizzle ORM + Neon (PostgreSQL)** — schema in `lib/schema.ts`
- **Better Auth** — user sessions + API key issuance
- **Drizzle migrations** committed in `drizzle/migrations/`

### Frontend layer

- **Eden treaty** (`lib/eden.ts`) — isomorphic typed API client
- **TanStack React Query** — default client-side data layer
- Server components can call Eden directly (zero HTTP round-trip)

---

## Contributor Rules

### API first

1. **Elysia routes are the source of truth.** Every product capability is exposed as an Elysia route before any portal UI is built for it.
2. **No Next.js API routes** — all backend logic lives in `lib/api.ts` and is mounted via the Elysia catch-all route.
3. **Auth is enforced at the API layer.** Use the `auth: true` macro on Elysia routes. Never guard things only in UI.
3. Good API documentation is a core feature not an after thought the API is the main part of this project

### Auth

4. Better Auth is the single auth system — do not add Clerk, NextAuth, or parallel auth stacks.
5. API key issuance is through the `@better-auth/api-key` plugin — surface key management through Elysia routes.

### Frontend

6. **React Query + Eden** is the standard path for client-side data fetching. Do not use `fetch()` directly against API routes in components.
7. Server components may call Eden directly (the isomorphic client detects the server environment and calls Elysia in-process).
8. Keep server-side Eden calls in server components / server actions only.

### Database

9. All schema changes go through `lib/schema.ts` → `bun run db:generate` → commit migration files.
10. Never use `db:push` in production — run migrations only.

### SDK compatibility

11. When adding or changing endpoint response shapes, check compatibility with `keyman500/voice-ai-sdk`.
12. Prefer predictable, versioned response shapes so SDK consumers are not broken by additions.

### Testing

13. This project is test-driven. Add or update tests before/with behavior changes.
14. API route tests should exercise `app.handle` with mocked auth and assert status codes plus response shapes.
15. Service tests must mock database/repository calls and external SDK clients, then assert the expected DB writes/updates and LiveKit SDK method parameters.
16. For LiveKit-backed behavior, cover success, missing config, provider fallback, SDK failure, and stored call logs/events.

---

## Environment Variables

| Variable             | Required | Description                                        |
| -------------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`       | ✅       | Neon PostgreSQL connection string                  |
| `BETTER_AUTH_SECRET` | ✅       | At least 32-character random secret                |
| `BETTER_AUTH_URL`    | ✅       | Base URL of the app (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_POSTHOG_KEY` | —   | PostHog project API key (client analytics; optional) |
| `NEXT_PUBLIC_POSTHOG_HOST` | —  | PostHog API host (default `https://us.i.posthog.com`) |

Copy `.env.example` → `.env.local` and fill in values before running.
