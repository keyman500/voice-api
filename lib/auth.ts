import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey } from "@better-auth/api-key"
import { db } from "./db"
import * as schema from "./schema"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    // Map all Better Auth + plugin tables to our Drizzle schema definitions.
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      // API key plugin table
      apikey: schema.apikey,
    },
  }),

  emailAndPassword: {
    enabled: true,
  },

  // API key plugin — foundation only (no key-management UX yet).
  plugins: [apiKey()],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
