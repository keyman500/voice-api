"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

type PostHogIdentifyProps = {
  user?: {
    id: string
    email?: string | null
    name?: string | null
  } | null
}

export function PostHogIdentify({ user }: PostHogIdentifyProps) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      })
      return
    }

    posthog.reset()
  }, [user?.id, user?.email, user?.name])

  return null
}
