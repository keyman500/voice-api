import { headers } from "next/headers"
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google"

import { DashboardShell } from "@/components/dashboard/dashboard-sidebar"
import { auth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const dashboardBrand = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-dashboard-brand",
  weight: ["400", "500", "600", "700"],
})

const dashboardMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dashboard-mono",
})

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  return (
    <div
      className={cn(
        dashboardBrand.variable,
        dashboardMono.variable,
        "h-svh overflow-hidden antialiased"
      )}
    >
      <DashboardShell userEmail={session?.user.email ?? null}>
        {children}
      </DashboardShell>
    </div>
  )
}
