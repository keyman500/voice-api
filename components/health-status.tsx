"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/eden";

/**
 * HealthStatus — client component that polls /api/health via Eden + React Query.
 * Demonstrates the standard portal consumption pattern:
 *   React Query useQuery → Eden treaty → Elysia handler → typed response.
 */
export function HealthStatus() {
    const { data, isPending, isError } = useQuery({
        queryKey: ["health"],
        queryFn: async () => {
            const { data, error } = await api.health.get();
            if (error) throw new Error("Failed to fetch health");
            return data;
        },
        refetchInterval: 30_000, // refresh every 30 s
    });

    if (isPending) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                Checking API…
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                API unreachable
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span className="font-medium">API online</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-xs text-muted-foreground">
                {data?.timestamp ? new Date(data.timestamp).toLocaleString() : ""}
            </span>
        </div>
    );
}
