# Voice API

A self-hostable voice AI API platform inspired by [Vapi](https://vapi.ai) and [Retell](https://retellai.com). Build production voice agents with a fully typed REST API, webhook callbacks, and a developer dashboard — without being locked into a proprietary vendor.

Voice API is **source-available** under the [Voice API License](./LICENSE.md). You can read, modify, and self-host the software for free. Commercial redistribution or hosted resale requires a [commercial license](./LICENSE_COMMERCIAL.md).

## Features

- **REST-first API** — agents, calls, call logs, recordings, phone numbers, and Twilio/Telnyx configuration under `/api/v1/*`
- **Twilio ConversationRelay** — real-time voice relay with WebSocket support for local development
- **Telnyx BYOK** — bring-your-own Telnyx credentials as an alternative telephony provider alongside Twilio
- **LiveKit integration** — optional SIP outbound and room-based voice workflows
- **Typed SDK compatibility** — response shapes aligned with [`keyman500/voice-ai-sdk`](https://github.com/keyman500/voice-ai-sdk)
- **Bring your own keys** — Twilio, Telnyx, LiveKit, and AI provider credentials stored per user
- **Auth & API keys** — [Better Auth](https://www.better-auth.com) sessions plus API key issuance for programmatic access
- **Billing** — Polar-powered subscriptions and usage-based Voice AI credits
- **Developer dashboard** — manage agents, calls, phone numbers, API keys, and settings
- **OpenAPI docs** — interactive API reference at `/api/openapi` (Scalar)

## Architecture

```
Next.js App Router
└── app/api/[[...slugs]]/route.ts   ← mounts the Elysia app
    └── lib/api.ts                  ← Elysia app (prefix: /api)
        ├── .mount(auth.handler)    ← Better Auth under /api/auth/*
        ├── GET /api/health
        ├── GET /api/version
        ├── GET /api/session        ← protected via `auth: true` macro
        └── lib/voice-relay.ts      ← /api/v1/* voice product surface
```

| Layer | Stack |
| --- | --- |
| API | [Elysia](https://elysiajs.com) on Next.js App Router |
| Database | [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL (Neon) |
| Auth | [Better Auth](https://www.better-auth.com) + API keys |
| Client | [Eden Treaty](https://elysiajs.com/eden/overview) + [TanStack Query](https://tanstack.com/query) |
| Voice | Twilio ConversationRelay, Telnyx TeXML, LiveKit, Vercel AI Gateway |

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 20+)
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- Twilio and/or Telnyx account (for voice calls; configure either in Settings)

### Setup

```bash
git clone https://github.com/keyman500/voice-api.git
cd voice-api
bun install
cp .env.example .env.local
```

Fill in the required values in `.env.local`:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | At least 32-character random secret |
| `BETTER_AUTH_URL` | Yes | Base URL of the app (e.g. `http://localhost:3000`) |

See [`.env.example`](./.env.example) for optional integrations (Polar billing, Vercel Blob, AI Gateway, Twilio, Telnyx, LiveKit).

### Database

```bash
bun run db:migrate
```

### Development

```bash
# Standard Next.js dev server
bun run dev

# Voice development with ngrok WebSocket tunnel for ConversationRelay
bun run dev:voice
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard, or [http://localhost:3000/api/openapi](http://localhost:3000/api/openapi) for API docs.

### Tests

```bash
bun run test
```

## API authentication

Protected `/api/v1/*` routes accept any of:

- Better Auth **session cookie** (dashboard login)
- `Authorization: Bearer <api_key>`
- `x-api-key: <api_key>` (Better Auth default header)

Create API keys from **Dashboard → Settings**.

## License

Voice API is distributed under a source-available license designed for self-hosting and internal use, with separate terms for commercial redistribution.

### Voice API License (default)

The source code is available under the [Voice API License](./LICENSE.md). You may use, modify, and redistribute the software with these limitations:

- Use and modification are allowed for **internal business purposes**, **personal use**, or **non-commercial use**
- Redistribution is allowed only **free of charge** and for **non-commercial purposes**
- You may not remove or obscure license notices

### Commercial license

If you want to sell, white-label, or host Voice API as a paid service where the value derives substantially from Voice API functionality, you need a separate [commercial license](./LICENSE_COMMERCIAL.md).

### Is this open source?

Per the [Open Source Initiative](https://opensource.org), licenses that restrict commercial use are not OSI-approved open source. Voice API is **source-available** — you can read the code, self-host, contribute, and fork for internal use, while commercial redistribution requires a separate agreement with the licensor.

| Use case | License needed |
| --- | --- |
| Self-host for your own app or company | Voice API License (free) |
| Personal or hobby projects | Voice API License (free) |
| Consulting / integration services | Voice API License (free) |
| White label or sell Voice API as a product | [Commercial license](./LICENSE_COMMERCIAL.md) |
| Host a paid multi-tenant Voice API service | [Commercial license](./LICENSE_COMMERCIAL.md) |

## Contributing

Contributions are welcome. See [AGENTS.md](./AGENTS.md) for architecture notes and contributor conventions.

By contributing, you agree that your contributions will be licensed under the same [Voice API License](./LICENSE.md) as the rest of the project.

## Related projects

- [`keyman500/voice-ai-sdk`](https://github.com/keyman500/voice-ai-sdk) — TypeScript SDK for the Voice API
