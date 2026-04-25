import { treaty } from "@elysiajs/eden"
import type { App } from "./api"

/**
 * Isomorphic Eden treaty client.
 *
 * - On the server (Node/Bun process): calls Elysia directly without going
 *   through the network layer (uses the imported app instance).
 * - On the client (browser): makes real HTTP requests to /api.
 *
 * Access via `api.<route>.<method>()`, e.g.:
 *   const { data } = await api.health.get()
 */
export const api =
  // typeof process is defined in Node/Bun but also defined in browsers (as undefined in some bundlers).
  // The official Elysia docs recommend using `typeof process !== 'undefined'` to distinguish.
  typeof process !== "undefined"
    ? treaty<App>(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").api
    : treaty<App>("localhost:3000").api
