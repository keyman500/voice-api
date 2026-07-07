"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiLayoutGridLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiPhoneLine,
  RiRobot2Line,
  RiSettings3Line,
} from "@remixicon/react"

import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SIDEBAR_COLLAPSED_KEY = "voice-dashboard-sidebar-collapsed"

export type NavItem =
  | {
      kind: "link"
      href: string
      label: string
      icon: React.ComponentType<{ className?: string }>
      match?: "exact" | "prefix"
    }
  | {
      kind: "soon"
      label: string
      icon: React.ComponentType<{ className?: string }>
    }

const mainNav: NavItem[] = [
  {
    kind: "link",
    href: "/dashboard",
    label: "Overview",
    icon: RiLayoutGridLine,
    match: "exact",
  },
  {
    kind: "link",
    href: "/dashboard/agents",
    label: "Agents",
    icon: RiRobot2Line,
    match: "prefix",
  },
  {
    kind: "link",
    href: "/dashboard/calls",
    label: "Calls",
    icon: RiPhoneLine,
    match: "prefix",
  },
  {
    kind: "link",
    href: "/dashboard/logs",
    label: "Logs",
    icon: RiFileList3Line,
    match: "prefix",
  },
  {
    kind: "link",
    href: "/dashboard/settings",
    label: "Settings",
    icon: RiSettings3Line,
    match: "prefix",
  },
]

function navItemActive(pathname: string, item: NavItem): boolean {
  if (item.kind !== "link") return false
  if (item.match === "exact") return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

type DashboardSidebarProps = {
  className?: string
  onNavigate?: () => void
  /** Collapse icon-only mode (desktop only; parent passes false on small viewports). */
  collapsed: boolean
  onToggleCollapse: () => void
  collapseControlsReady: boolean
}

export function DashboardSidebar({
  className,
  onNavigate,
  collapsed,
  onToggleCollapse,
  collapseControlsReady,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  function handleClick() {
    onNavigate?.()
  }

  async function signOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.push("/")
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  /** Icon-only when collapsed (desktop). */
  const showLabels = !collapsed

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        "border-sidebar-border/80 bg-sidebar text-sidebar-foreground",
        "bg-[radial-gradient(120%_80%_at_0%_0%,rgb(13_148_136/0.12)_0%,transparent_50%)]",
        "dark:bg-[#0a0b0d] dark:bg-[radial-gradient(120%_80%_at_0%_0%,rgb(45_212_191/0.18)_0%,transparent_55%)]",
        className
      )}
    >
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-teal-500/50 via-cyan-500/35 to-transparent dark:from-teal-400/50 dark:via-cyan-400/30"
        aria-hidden
      />
      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden",
          "pt-4 pb-2 transition-[padding] duration-300 ease-out motion-reduce:transition-none",
          showLabels ? "gap-1 px-3" : "items-center gap-2 px-2"
        )}
      >
        <div
          className={cn(
            "flex items-center",
            showLabels
              ? "flex-col items-stretch pl-0"
              : "h-10 w-10 items-center justify-center self-center rounded-xl border border-sidebar-border/80 bg-background/50 font-semibold text-teal-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-teal-300"
          )}
        >
          {showLabels ? (
            <>
              <p
                className="pl-0 text-[0.65rem] font-medium tracking-[0.35em] text-muted-foreground uppercase"
                style={{
                  fontFamily: "var(--font-dashboard-mono), ui-monospace",
                }}
              >
                Voice API
              </p>
              <div
                className="mt-0.5 text-xl font-semibold tracking-tight"
                style={{
                  fontFamily: "var(--font-dashboard-brand), var(--font-sans)",
                }}
              >
                Control room
              </div>
              <p className="text-xs leading-snug text-muted-foreground">
                Agents, calls, and API surface — all in one place.
              </p>
            </>
          ) : (
            <span
              className="text-sm font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-dashboard-brand), var(--font-sans)",
              }}
            >
              V
            </span>
          )}
        </div>
      </div>

      <nav
        className={cn(
          "mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-1.5",
          "md:px-1.5"
        )}
        aria-label="Dashboard"
      >
        {mainNav.map((item) => {
          if (item.kind === "soon") {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={cn(
                  "flex cursor-not-allowed items-center rounded-xl py-2.5 text-sm",
                  "text-muted-foreground",
                  showLabels ? "gap-3 px-3" : "justify-center px-0"
                )}
                title={`${item.label} (coming soon)`}
              >
                <Icon className="size-[18px] shrink-0 opacity-50" aria-hidden />
                {showLabels && (
                  <>
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                    <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[0.6rem] tracking-wide uppercase">
                      soon
                    </span>
                  </>
                )}
              </div>
            )
          }

          const active = navItemActive(pathname, item)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              title={!showLabels ? item.label : undefined}
              className={cn(
                "group flex items-center rounded-xl text-sm",
                "transition-[background,color,box-shadow,padding] duration-300 ease-out outline-none motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
                "border-l-2 border-transparent py-2.5",
                showLabels ? "min-h-0 gap-3 px-3" : "justify-center px-1.5",
                active
                  ? "border-l-2 border-teal-500 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm dark:shadow-none"
                  : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
                active && showLabels && "pl-[calc(0.75rem-2px)]"
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-colors",
                  active
                    ? "text-teal-600 dark:text-teal-300"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "min-w-0 font-medium",
                  "transition-all duration-300 ease-out motion-reduce:transition-none",
                  showLabels
                    ? "max-w-56 translate-x-0 opacity-100"
                    : "max-w-0 -translate-x-1 overflow-hidden opacity-0"
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div
        className={cn(
          "mt-auto space-y-1 border-t border-sidebar-border",
          "px-1.5 py-3 transition-[padding] duration-300"
        )}
      >
        {collapseControlsReady && (
          <div className="mb-1 hidden justify-center md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="size-9 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
            >
              {collapsed ? (
                <RiArrowRightSLine className="size-5" />
              ) : (
                <RiArrowLeftSLine className="size-5" />
              )}
            </Button>
          </div>
        )}
        <Link
          href="/docs"
          onClick={handleClick}
          title={!showLabels ? "API docs" : undefined}
          className={cn(
            "flex items-center rounded-xl text-sm text-muted-foreground transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-foreground",
            showLabels ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5"
          )}
        >
          <RiExternalLinkLine className="size-[18px] shrink-0" aria-hidden />
          <span
            className={cn(
              "min-w-0 font-medium",
              "transition-all duration-300 ease-out motion-reduce:transition-none",
              showLabels
                ? "max-w-56 opacity-100"
                : "max-w-0 overflow-hidden opacity-0"
            )}
          >
            API docs
          </span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto w-full text-muted-foreground",
            "hover:bg-destructive/10 hover:text-destructive",
            "dark:hover:text-red-200",
            showLabels
              ? "justify-start gap-3 px-3 py-2.5"
              : "justify-center px-0 py-2.5"
          )}
          onClick={signOut}
          disabled={signingOut}
          title={!showLabels ? "Sign out" : undefined}
        >
          <RiLogoutBoxRLine className="size-[18px] shrink-0" aria-hidden />
          <span
            className={cn(
              "min-w-0",
              "transition-all duration-300 ease-out motion-reduce:transition-none",
              showLabels
                ? "max-w-56 opacity-100"
                : "max-w-0 overflow-hidden opacity-0"
            )}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </span>
        </Button>
      </div>
    </div>
  )
}

type DashboardShellProps = {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
    } catch {
      return false
    }
  })
  const [collapseControlsReady, setCollapseControlsReady] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => {
      setIsDesktop(mq.matches)
      setCollapseControlsReady(true)
    }
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const effectiveCollapsed = sidebarCollapsed && isDesktop

  function toggleSidebarCollapse() {
    setSidebarCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div className="flex min-h-svh w-full min-w-0 flex-row overflow-x-hidden text-foreground">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/*
        Mobile and desktop are separate: WebKit/Safari breaks when one <aside> mixes
        `position: fixed` (drawer) with `md:relative` / static (rail) — overlap, lost bg, wrong width.
      */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(19rem,88vw)] max-w-full border-r border-sidebar-border",
          "bg-sidebar shadow-lg shadow-black/8",
          "flex flex-col transition-transform duration-300 ease-in-out will-change-transform",
          "motion-reduce:transition-none",
          "md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-sidebar-border/80 bg-sidebar/95 px-2 backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <RiCloseLine className="size-5" />
          </Button>
        </div>
        <DashboardSidebar
          onNavigate={() => setMobileOpen(false)}
          className="min-h-0 flex-1"
          collapsed={false}
          onToggleCollapse={toggleSidebarCollapse}
          collapseControlsReady={false}
        />
      </aside>

      <aside
        className={cn(
          "relative z-0 hidden h-svh shrink-0 flex-col overflow-hidden",
          "border-r border-sidebar-border bg-sidebar",
          "shadow-md dark:shadow-none",
          "md:flex",
          "transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
          collapseControlsReady && effectiveCollapsed
            ? "w-17 max-w-17 min-w-17"
            : "w-64 max-w-64 min-w-64"
        )}
      >
        <DashboardSidebar
          className="min-h-0 flex-1"
          collapsed={effectiveCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          collapseControlsReady={collapseControlsReady}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <RiMenuLine className="size-5" />
          </Button>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-dashboard-brand), var(--font-sans)",
            }}
          >
            Voice API
          </span>
        </header>
        <main
          className={cn(
            "min-h-0 flex-1 transition-[background-color] duration-300",
            "bg-zinc-50/90 bg-[radial-gradient(ellipse_90%_60%_at_100%_0%,rgb(6_182_212/0.22)_0%,transparent_50%)]",
            "dark:bg-zinc-950/90 dark:bg-[radial-gradient(ellipse_90%_60%_at_100%_0%,rgb(34_120_100/0.18)_0%,transparent_50%)]"
          )}
        >
          <div
            className="h-full min-h-[calc(100dvh-3.5rem)] md:min-h-svh"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.04'/%3E%3C/svg%3E")`,
            }}
          >
            <div className="h-full w-full max-w-6xl px-4 py-8 md:mx-auto md:px-8 md:py-10">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
