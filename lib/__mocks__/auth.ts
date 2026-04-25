/**
 * Jest manual mock for `@/lib/auth` — avoids loading the real `better-auth` ESM graph in tests.
 * @see https://jestjs.io/docs/manual-mocks
 */
import { jest } from "@jest/globals"

/** Mirrors `better-auth` user shape used in the app. */
export type User = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export const auth = {
  api: {
    getSession: jest.fn(),
    verifyApiKey: jest.fn(),
  },
  handler: (() =>
    new Response("auth routes not exercised in this test", {
      status: 404,
    })) as (request: Request) => Response,
} as const
