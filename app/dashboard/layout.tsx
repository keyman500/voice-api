import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google"

import { DashboardShell } from "@/components/dashboard/dashboard-sidebar"
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        dashboardBrand.variable,
        dashboardMono.variable,
        "min-h-svh antialiased"
      )}
    >
      <DashboardShell>{children}</DashboardShell>
    </div>
  )
}
