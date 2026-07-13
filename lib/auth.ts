import { checkout, polar, portal, usage, webhooks } from "@polar-sh/better-auth"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { apiKey } from "@better-auth/api-key"
import { db } from "./db"
import { getPolarSdk } from "./polar"
import * as schema from "./schema"
import { grantSignupBonus } from "./services/billing"

const polarSdk = getPolarSdk()
const polarAuthPlugin = polarSdk
  ? polar({
      client: polarSdk,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            ...(process.env.POLAR_STARTER_PRODUCT_ID
              ? [
                  {
                    productId: process.env.POLAR_STARTER_PRODUCT_ID,
                    slug: "starter",
                  },
                ]
              : []),
            ...(process.env.POLAR_PRO_PRODUCT_ID
              ? [
                  {
                    productId: process.env.POLAR_PRO_PRODUCT_ID,
                    slug: "pro",
                  },
                ]
              : []),
          ],
          authenticatedUsersOnly: true,
          successUrl: process.env.POLAR_CHECKOUT_SUCCESS_URL,
          returnUrl: process.env.POLAR_CHECKOUT_RETURN_URL,
        }),
        portal({ returnUrl: process.env.POLAR_CHECKOUT_RETURN_URL }),
        usage(),
        ...(process.env.POLAR_WEBHOOK_SECRET
          ? [webhooks({ secret: process.env.POLAR_WEBHOOK_SECRET })]
          : []),
      ],
    })
  : null

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

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await grantSignupBonus(user.id)
          } catch (error) {
            console.error("Failed to grant signup bonus credits", error)
          }
        },
      },
    },
  },

  // API key plugin — foundation only (no key-management UX yet).
  // Polar: customer on sign-up, checkout, portal, usage, and optional webhooks.
  plugins: [apiKey(), ...(polarAuthPlugin ? [polarAuthPlugin] : [])],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
