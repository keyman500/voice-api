import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Fraunces, IBM_Plex_Mono } from "next/font/google"

import { LoginExperience } from "@/components/auth/login-experience"
import { auth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-voice-display",
})

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-voice-mono",
})

export default async function Home() {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (session) {
    redirect("/dashboard")
  }

  return (
    <LoginExperience
      displayFontClassName={display.className}
      monoFontClassName={mono.className}
      fontVariableClassName={cn(display.variable, mono.variable)}
    />
  )
}
