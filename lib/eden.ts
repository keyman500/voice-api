import { treaty } from "@elysiajs/eden"
import type { App } from "./api"

/**
 * Isomorphic Eden treaty client.
 *
 * - Browser: uses `NEXT_PUBLIC_BETTER_AUTH_URL` (same as auth-client), then
 *   `window.location.origin` so prod never falls back to localhost.
 * - Server: uses `BETTER_AUTH_URL` for same-origin / SSR fetches.
 *
 * Access via `api.<route>.<method>()`, e.g.:
 *   const { data } = await api.health.get()
 */
function edenBaseUrl() {
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? window.location.origin
    )
  }

  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
}

export const api = treaty<App>(edenBaseUrl()).api
