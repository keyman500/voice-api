import { polarClient } from "@polar-sh/better-auth/client"
import { apiKeyClient } from "@better-auth/api-key/client"
import { createAuthClient } from "better-auth/react"

/**
 * Browser client for Better Auth. Uses the app origin + `/api/auth` (default path).
 * Set `NEXT_PUBLIC_BETTER_AUTH_URL` to the public base (same as `BETTER_AUTH_URL`, e.g. `http://localhost:3000`).
 *
 * `polarClient` adds `customer` + `usage` methods when the Polar plugin is enabled on the server
 * (requires `POLAR_ACCESS_TOKEN` in the server environment).
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [apiKeyClient(), polarClient()],
})
