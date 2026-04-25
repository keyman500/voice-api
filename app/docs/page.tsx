import { redirect } from "next/navigation"

/**
 * Interactive docs are served by `@elysiajs/openapi` (Scalar) at `/api/openapi`.
 * OpenAPI JSON: `/api/openapi/json`.
 */
export default function ApiDocsPage() {
  redirect("/api/openapi")
}
