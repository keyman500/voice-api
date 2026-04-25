import { Polar } from "@polar-sh/sdk"

type PolarServer = "sandbox" | "production"

/**
 * Polar SDK for Better Auth (sign-up customer creation, portal, usage).
 * Set `POLAR_ACCESS_TOKEN` and `POLAR_SERVER` in the environment. If the token
 * is missing, {@link getPolarSdk} returns `null` and the Polar plugin is not registered.
 */
export function getPolarSdk(): Polar | null {
  const token = process.env.POLAR_ACCESS_TOKEN?.trim()
  if (!token) {
    return null
  }
  const server: PolarServer =
    process.env.POLAR_SERVER === "production" ? "production" : "sandbox"
  return new Polar({
    accessToken: token,
    server,
  })
}
