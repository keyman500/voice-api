/**
 * Next.js App Router catch-all route that mounts the Elysia app.
 * This file re-exports the Elysia app (for Eden type inference) and all
 * HTTP method handlers from the shared lib/api module.
 */
export { app, GET, POST, PUT, PATCH, DELETE } from "@/lib/api"
