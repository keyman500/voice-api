"use client"

/**
 * Sign-in / sign-up use Better Auth’s `authClient` (cookie session). For typed
 * Elysia API calls, use Eden from `@/lib/eden` with TanStack Query (`useQuery` /
 * `useMutation`) — same idea as the [TanStack Start + Eden](https://elysiajs.com/integrations/tanstack-start.html#eden) docs, but this app is Next.js.
 */

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { useTheme } from "next-themes"
import { useMutation } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"

import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "sign-in" | "sign-up"

type LoginFormValues = {
  name: string
  email: string
  password: string
}

function authErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

function SignalWaveform({ className }: { className?: string }) {
  const bars = [12, 28, 42, 56, 48, 32, 18, 36, 52, 38, 22, 44, 30, 14, 40]
  return (
    <svg
      className={cn("h-32 w-full max-w-xs text-primary/80", className)}
      viewBox="0 0 240 80"
      fill="currentColor"
      aria-hidden
    >
      <title>Signal</title>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={4 + i * 16}
          y={72 - h}
          width="8"
          height={h}
          rx="2"
          className="origin-bottom motion-safe:animate-[login-signal-wave_1.4s_ease-in-out_infinite]"
          style={{
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </svg>
  )
}

export type LoginExperienceProps = {
  displayFontClassName: string
  monoFontClassName: string
  fontVariableClassName: string
}

export function LoginExperience({
  displayFontClassName,
  monoFontClassName,
  fontVariableClassName,
}: LoginExperienceProps) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mode, setMode] = useState<Mode>("sign-in")

  const form = useForm<LoginFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  const authMutation = useMutation({
    mutationKey: ["auth", "email", mode],
    retry: false,
    mutationFn: async (values: LoginFormValues) => {
      if (mode === "sign-in") {
        const { error } = await authClient.signIn.email({
          email: values.email,
          password: values.password,
          callbackURL: "/dashboard",
        })
        if (error) {
          throw error
        }
        return
      }
      const { error } = await authClient.signUp.email({
        name:
          values.name.trim() ||
          values.email.split("@")[0] ||
          "User",
        email: values.email,
        password: values.password,
        callbackURL: "/dashboard",
      })
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      router.push("/dashboard")
      router.refresh()
    },
  })

  const serverError =
    authMutation.isError && authMutation.error
      ? authErrorMessage(
          authMutation.error,
          mode === "sign-in"
            ? "Sign in failed. Check your email and password."
            : "Could not create an account. Try a different email."
        )
      : null

  function onSubmit(values: LoginFormValues) {
    authMutation.reset()
    authMutation.mutate(values)
  }

  function switchMode(next: Mode) {
    setMode(next)
    authMutation.reset()
    form.clearErrors()
    void form.trigger("password")
  }

  return (
    <div
      className={cn(
        "relative min-h-svh overflow-hidden bg-background text-foreground dark:bg-[#080a0d] dark:text-zinc-100",
        fontVariableClassName
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(14_165_233/0.14)_0%,transparent_42%,rgb(20_184_166/0.1)_100%)] dark:bg-[linear-gradient(135deg,rgb(25_50_80/0.35)_0%,transparent_45%,rgb(30_32_60/0.4)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-size-[48px_48px] opacity-[0.45] bg-[linear-gradient(rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.06)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-[0.35]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg_viewBox=%220_0_256_256%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter_id=%22n%22%3E%3CfeTurbulence_type=%22fractalNoise%22_baseFrequency=%220.85%22_numOctaves=%224%22_stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/%3E%3C/svg%3E')] opacity-[0.06] dark:opacity-[0.08]"
        aria-hidden
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-4 right-4 z-10 border border-border bg-card/85 text-muted-foreground backdrop-blur-md hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80 dark:hover:text-white"
        onClick={() =>
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
        }
        aria-label="Toggle theme"
      >
        <RiSunLine className="hidden size-4 [html.dark_&]:block" />
        <RiMoonLine className="size-4 [html.dark_&]:hidden" />
      </Button>

      <div className="relative z-1 mx-auto flex min-h-svh max-w-6xl flex-col gap-10 px-6 py-14 md:flex-row md:items-center md:gap-16 md:px-12 lg:gap-24">
        <section
          className="flex max-w-xl flex-1 flex-col justify-center motion-safe:animate-[login-fade-up_0.65s_ease-out_both]"
          style={{ animationDelay: "40ms" }}
        >
          <p
            className={cn(
              "mb-3 text-xs font-medium tracking-[0.28em] text-primary/80 uppercase",
              monoFontClassName
            )}
          >
            Voice API
          </p>
          <h1
            className={cn(
              "mb-4 text-4xl leading-[1.05] tracking-tight sm:text-5xl",
              displayFontClassName
            )}
          >
            Build on an open voice stack.
          </h1>
          <p className="mb-10 max-w-md text-base leading-relaxed text-muted-foreground dark:text-zinc-400">
            Self-hostable API for agents, calls, and phone numbers — typed
            routes, webhooks, and session or API key access.
          </p>
          <div className="hidden md:block">
            <SignalWaveform />
            <p
              className={cn(
                "mt-6 text-xs tracking-wide text-muted-foreground uppercase dark:text-zinc-500",
                monoFontClassName
              )}
            >
              — carrier-grade patterns, no lock-in
            </p>
          </div>
        </section>

        <div
          className="w-full max-w-md flex-1 self-center motion-safe:animate-[login-fade-up_0.7s_ease-out_both]"
          style={{ animationDelay: "120ms" }}
        >
          <Card className="border border-border/80 bg-card/90 shadow-lg shadow-foreground/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/75 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_80px_-20px_rgba(0,0,0,0.65)]">
            <CardHeader>
              <CardTitle className="text-lg dark:text-zinc-100">
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </CardTitle>
              <CardDescription className="dark:text-zinc-500">
                {mode === "sign-in"
                  ? "Use your email and password to open the portal."
                  : "Register to get started with the API and dashboard."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
              >
                {mode === "sign-up" && (
                  <div className="grid gap-2">
                    <Label
                      htmlFor="name"
                      className="dark:text-zinc-300"
                    >
                      Name
                    </Label>
                    <Controller
                      name="name"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <>
                          <Input
                            id="name"
                            type="text"
                            autoComplete="name"
                            placeholder="Ada Lovelace"
                            aria-invalid={fieldState.invalid}
                            className="dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                            {...field}
                          />
                          {fieldState.error?.message && (
                            <p className="text-xs text-destructive dark:text-red-300">
                              {fieldState.error.message}
                            </p>
                          )}
                        </>
                      )}
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label
                    htmlFor="email"
                    className="dark:text-zinc-300"
                  >
                    Email
                  </Label>
                  <Controller
                    name="email"
                    control={form.control}
                    rules={{
                      required: "Enter your email",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email",
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@domain.com"
                          aria-invalid={fieldState.invalid}
                          className="dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                          {...field}
                        />
                        {fieldState.error?.message && (
                          <p className="text-xs text-destructive dark:text-red-300">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="password"
                    className="dark:text-zinc-300"
                  >
                    Password
                  </Label>
                  <Controller
                    name="password"
                    control={form.control}
                    rules={
                      mode === "sign-up"
                        ? {
                            required: "Enter your password",
                            minLength: {
                              value: 8,
                              message: "At least 8 characters",
                            },
                          }
                        : {
                            required: "Enter your password",
                          }
                    }
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="password"
                          type="password"
                          autoComplete={
                            mode === "sign-in"
                              ? "current-password"
                              : "new-password"
                          }
                          placeholder="••••••••"
                          aria-invalid={fieldState.invalid}
                          className="dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                          {...field}
                        />
                        {fieldState.error?.message && (
                          <p className="text-xs text-destructive dark:text-red-300">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
                {serverError && (
                  <p
                    className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                    role="alert"
                  >
                    {serverError}
                  </p>
                )}
                <Button
                  type="submit"
                  className="mt-1 w-full"
                  disabled={authMutation.isPending}
                >
                  {authMutation.isPending
                    ? "Please wait…"
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <p className="text-center text-sm text-muted-foreground dark:text-zinc-500">
                  {mode === "sign-in" ? (
                    <>
                      No account?{" "}
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:text-primary/80 hover:underline"
                        onClick={() => switchMode("sign-up")}
                      >
                        Create one
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:text-primary/80 hover:underline"
                        onClick={() => switchMode("sign-in")}
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </form>
            </CardContent>
          </Card>
          <p
            className={cn(
              "mt-6 text-center text-xs text-muted-foreground dark:text-zinc-600",
              monoFontClassName
            )}
          >
            <Link
              href="/docs"
              className="text-muted-foreground transition-colors hover:text-primary dark:text-zinc-500 dark:hover:text-primary/90"
            >
              Documentation
            </Link>
            <span className="mx-2 text-border dark:text-zinc-700">·</span>
            <span className="dark:text-zinc-600">Press D to toggle app theme</span>
          </p>
        </div>
      </div>
    </div>
  )
}
