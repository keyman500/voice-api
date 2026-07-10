"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  RiBankCardLine,
  RiComputerLine,
  RiExpandUpDownLine,
  RiFileList3Line,
  RiLayoutGridLine,
  RiLogoutBoxRLine,
  RiMicLine,
  RiMoonLine,
  RiNumbersLine,
  RiPhoneLine,
  RiRobot2Line,
  RiSettings3Line,
  RiSunLine,
} from "@remixicon/react"

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/animate-ui/components/radix/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSession, signOut } from "@/lib/auth-client"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  match?: "exact" | "prefix"
}

const mainNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: RiLayoutGridLine,
    match: "exact",
  },
  {
    href: "/dashboard/agents",
    label: "Agents",
    icon: RiRobot2Line,
    match: "prefix",
  },
  {
    href: "/dashboard/calls",
    label: "Calls",
    icon: RiPhoneLine,
    match: "prefix",
  },
  {
    href: "/dashboard/phone-numbers",
    label: "Numbers",
    icon: RiNumbersLine,
    match: "prefix",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: RiBankCardLine,
    match: "prefix",
  },
  {
    href: "/dashboard/logs",
    label: "Logs",
    icon: RiFileList3Line,
    match: "prefix",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: RiSettings3Line,
    match: "prefix",
  },
]

function navItemActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function currentPageLabel(pathname: string): string {
  const match = mainNav.find((item) => navItemActive(pathname, item))
  return match?.label ?? "Dashboard"
}

type DashboardShellProps = {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/"
        },
      },
    })
  }

  if (!session) {
    return null
  }

  const pageLabel = currentPageLabel(pathname)

  return (
    <SidebarProvider className="h-svh min-h-0">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <RiMicLine className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span
                    className="truncate font-semibold"
                    style={{
                      fontFamily: "var(--font-dashboard-brand), var(--font-sans)",
                    }}
                  >
                    Voice API
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Dashboard
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={navItemActive(pathname, item)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  <div className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                    <Avatar className="h-8 w-8 rounded-lg">
                      {session.user.image && (
                        <AvatarImage
                          src={session.user.image}
                          alt={session.user.name}
                        />
                      )}
                      <AvatarFallback className="rounded-lg">
                        {getInitials(session.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">
                        {session.user.name}
                      </span>
                      <span className="truncate text-xs">
                        {session.user.email}
                      </span>
                    </div>
                    <RiExpandUpDownLine className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        {session.user.image && (
                          <AvatarImage
                            src={session.user.image}
                            alt={session.user.name}
                          />
                        )}
                        <AvatarFallback className="rounded-lg">
                          {getInitials(session.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {session.user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {session.user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Theme
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <RiSunLine className="size-4" />
                      Light
                      {theme === "light" && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Active
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <RiMoonLine className="size-4" />
                      Dark
                      {theme === "dark" && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Active
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <RiComputerLine className="size-4" />
                      System
                      {theme === "system" && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Active
                        </span>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                    <RiLogoutBoxRLine className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              {pathname !== "/dashboard" && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium text-foreground">{pageLabel}</span>
                </>
              )}
            </nav>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
