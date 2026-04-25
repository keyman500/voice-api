import { jest } from "@jest/globals"

/**
 * Picked up when a test file calls `jest.mock("@/lib/resolve-user")`.
 * Tests that need auth: `mockResolvedValue({ authed, ... })` in `beforeEach`.
 */
export const resolveAuthedContext = jest.fn()
