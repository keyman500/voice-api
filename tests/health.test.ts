import { app } from "@/lib/api"

function handle(path: string, init?: RequestInit) {
  return app.handle(
    new Request(new URL(path, "http://localhost"), {
      ...init,
      headers: { ...init?.headers },
    })
  )
}

describe("public routes", () => {
  it("GET /api/health returns ok", async () => {
    const res = await handle("/api/health")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe("ok")
  })

  it("GET /api/version includes name", async () => {
    const res = await handle("/api/version")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { name: string; version: string }
    expect(body.name).toBe("voice-api")
    expect(typeof body.version).toBe("string")
  })
})

describe("v1 without auth", () => {
  it("GET /api/v1/agents returns 401", async () => {
    const res = await handle("/api/v1/agents")
    expect(res.status).toBe(401)
  })
})
