"use client"

import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatDateTime, statusTone } from "@/lib/dashboard"

export function DashboardPageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_20px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/65">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(0,214,201,0.22), transparent 34%), linear-gradient(135deg, rgba(8,15,23,0.01), rgba(8,15,23,0.05))",
        }}
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p
            className="text-[0.7rem] font-medium tracking-[0.34em] text-teal-600/80 uppercase dark:text-teal-300/80"
            style={{ fontFamily: "var(--font-dashboard-mono), ui-monospace" }}
          >
            {eyebrow}
          </p>
          <div className="space-y-2">
            <h1
              className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
              style={{
                fontFamily: "var(--font-dashboard-brand), var(--font-sans)",
              }}
            >
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
        </div>
        {action ? (
          <div className="relative flex shrink-0 items-center">{action}</div>
        ) : null}
      </div>
    </header>
  )
}

export function DashboardPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        "border border-white/60 bg-white/80 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/60",
        className
      )}
    >
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle
              className="text-lg"
              style={{
                fontFamily: "var(--font-dashboard-brand), var(--font-sans)",
              }}
            >
              {title}
            </CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function MetricCard({
  label,
  value,
  caption,
}: {
  label: string
  value: ReactNode
  caption?: string
}) {
  return (
    <div className="rounded-[1.6rem] border border-border/70 bg-background/80 p-5 shadow-sm">
      <p className="text-[0.72rem] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {caption ? (
        <p className="mt-2 text-sm text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  return <Badge variant={statusTone(status)}>{status ?? "unknown"}</Badge>
}

export function KeyValue({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <div
        className={cn("text-sm text-foreground", mono && "font-mono text-xs")}
      >
        {value}
      </div>
    </div>
  )
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}

export function JsonPreview({
  value,
  emptyLabel = "No structured data",
}: {
  value: unknown
  emptyLabel?: string
}) {
  if (!value) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-zinc-950 px-4 py-3 text-xs leading-6 text-zinc-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function TimestampLine({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      {formatDateTime(value)}
    </p>
  )
}

export function PanelSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1.6rem] border border-border/70 bg-background/80 p-5"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}
