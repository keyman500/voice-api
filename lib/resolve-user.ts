import { eq } from "drizzle-orm"
import { auth, type User } from "@/lib/auth"
import { db } from "./db"
import * as schema from "./schema"

export type AuthedContext = {
  user: User
  /** Set when the caller authenticated with a session cookie. */
  session: typeof auth.$Infer.Session["session"] | null
  authMethod: "session" | "apiKey"
  /** Set when `authMethod` is `apiKey` — the Better Auth api key record id. */
  apiKeyId: string | null
}

type KeyRow = {
  id: string
  userId?: string
  /** Newer API key plugin field when `references: "user"` is represented this way. */
  referenceId?: string
}
type VerifyApiKeyResult = {
  valid: boolean
  key: KeyRow | null
  error: { code?: string; message?: string } | null
}

/**
 * Resolves a signed-in user from either a Better Auth **session** (cookie)
 * or a **Bearer** API key (`Authorization: Bearer <key>`) verified via `verifyApiKey`.
 */
export async function resolveAuthedContext(
  headers: Headers
): Promise<AuthedContext | null> {
  const session = await auth.api.getSession({ headers })
  if (session) {
    return {
      user: session.user,
      session: session.session,
      authMethod: "session",
      apiKeyId: null,
    }
  }

  const authz = headers.get("authorization")
  if (!authz?.toLowerCase().startsWith("bearer ")) {
    return null
  }
  const rawKey = authz.slice(7).trim()
  if (!rawKey) {
    return null
  }

  const verified = (await auth.api.verifyApiKey({
    body: { key: rawKey },
  })) as VerifyApiKeyResult

  if (!verified.valid || !verified.key) {
    return null
  }

  const userId =
    verified.key.userId ?? verified.key.referenceId
  if (!userId) {
    return null
  }
  const [row] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  if (!row) {
    return null
  }

  const user: User = {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }

  return {
    user,
    session: null,
    authMethod: "apiKey",
    apiKeyId: verified.key.id,
  }
}
