import { HealthStatus } from "@/components/health-status";
import { api } from "@/lib/eden";
import Link from "next/link";

/**
 * Dashboard page — server component.
 * HealthStatus polls /api/health live via React Query + Eden on the client.
 */
export default async function DashboardPage() {
    // Server-side Eden call (direct Elysia invocation, no HTTP round-trip)
    const { data: versionData } = await api.version.get();

    return (
        <div className="flex min-h-svh flex-col gap-8 p-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Voice API Portal
                </h1>
                <p className="text-sm text-muted-foreground">
                    Open-source voice AI platform · Vapi/Retell-style API
                </p>
            </header>

            <section className="flex flex-col gap-4 rounded-lg border p-6">
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    API Status
                </h2>

                {/* Live health check via React Query + Eden (client component) */}
                <HealthStatus />

                {/* Server-side version data — rendered at request time */}
                {versionData && (
                    <p className="font-mono text-xs text-muted-foreground">
                        {versionData.name} v{versionData.version}
                    </p>
                )}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border p-6">
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Quick Links
                </h2>
                <ul className="flex flex-col gap-2 text-sm">
                    <li>
                        <Link
                            href="/api/health"
                            className="font-mono text-primary hover:underline"
                        >
                            GET /api/health
                        </Link>
                        <span className="ml-2 text-muted-foreground">— Public health check</span>
                    </li>
                    <li>
                        <Link
                            href="/api/version"
                            className="font-mono text-primary hover:underline"
                        >
                            GET /api/version
                        </Link>
                        <span className="ml-2 text-muted-foreground">— API version info</span>
                    </li>
                    <li>
                        <span className="font-mono text-primary">
                            POST /api/auth/sign-up/email
                        </span>
                        <span className="ml-2 text-muted-foreground">— Create account</span>
                    </li>
                    <li>
                        <span className="font-mono text-primary">
                            POST /api/auth/sign-in/email
                        </span>
                        <span className="ml-2 text-muted-foreground">— Sign in</span>
                    </li>
                    <li>
                        <Link
                            href="/api/session"
                            className="font-mono text-primary hover:underline"
                        >
                            GET /api/session
                        </Link>
                        <span className="ml-2 text-muted-foreground">
                            — Current session (protected)
                        </span>
                    </li>
                    <li>
                        <Link
                            href="/api/openapi"
                            className="font-mono text-primary hover:underline"
                        >
                            /api/openapi
                        </Link>
                        <span className="ml-2 text-muted-foreground">
                            — OpenAPI UI (Scalar via @elysiajs/openapi); JSON at{" "}
                            <code className="text-xs">/api/openapi/json</code> ·{" "}
                            <Link
                                href="/docs"
                                className="text-primary hover:underline"
                            >
                                /docs
                            </Link>{" "}
                            redirects here
                        </span>
                    </li>
                    <li>
                        <span className="font-mono text-primary">
                            /api/v1/agents, /api/v1/calls, /api/v1/phone-numbers
                        </span>
                        <span className="ml-2 text-muted-foreground">
                            — Voice resources (session cookie or{" "}
                            <code className="text-xs">Authorization: Bearer</code>{" "}
                            API key; stub data until LiveKit is wired)
                        </span>
                    </li>
                </ul>
            </section>
        </div>
    );
}
