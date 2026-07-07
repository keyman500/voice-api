"use client"

import {
  RiRobot2Line,
  RiSettings3Line,
  RiUserVoiceLine,
} from "@remixicon/react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { parseTranscript, type ParsedTranscriptTurn } from "@/lib/transcript"
import { cn } from "@/lib/utils"

type CallTranscriptThreadProps = {
  transcript?: string | null
}

type TurnPresentation = {
  align: "start" | "end"
  label: string
  bubbleVariant: "tinted" | "muted" | "outline"
  bubbleClassName: string
  icon: React.ComponentType<{ className?: string }>
  avatarClassName: string
}

function turnPresentation(turn: ParsedTranscriptTurn): TurnPresentation {
  switch (turn.role) {
    case "user":
      return {
        align: "end",
        label: "Caller",
        bubbleVariant: "tinted",
        bubbleClassName:
          "bg-teal-50 text-foreground border border-teal-100/90 dark:bg-teal-950/45 dark:border-teal-900/50",
        icon: RiUserVoiceLine,
        avatarClassName:
          "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
      }
    case "assistant":
      return {
        align: "start",
        label: "Assistant",
        bubbleVariant: "muted",
        bubbleClassName: "bg-zinc-100 text-foreground dark:bg-zinc-800",
        icon: RiRobot2Line,
        avatarClassName:
          "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
      }
    default:
      return {
        align: "start",
        label:
          turn.role === "unknown"
            ? "Unknown"
            : turn.role.charAt(0).toUpperCase() + turn.role.slice(1),
        bubbleVariant: "outline",
        bubbleClassName:
          "bg-background text-foreground border border-border/80",
        icon: RiSettings3Line,
        avatarClassName: "bg-muted text-muted-foreground",
      }
  }
}

export function CallTranscriptThread({ transcript }: CallTranscriptThreadProps) {
  const turns = parseTranscript(transcript)

  if (!turns.length) {
    return (
      <div className="rounded-[1.5rem] border border-border/70 bg-background/75 px-4 py-4 text-sm text-muted-foreground">
        No transcript stored for this call.
      </div>
    )
  }

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/75 px-4 py-4">
      <ScrollArea
        className="h-72 w-full pr-3"
        aria-label="Call transcript"
      >
        <MessageGroup className="gap-4 pr-1">
          {turns.map((turn, index) => {
            const presentation = turnPresentation(turn)
            const Icon = presentation.icon

            return (
              <Message
                key={`${turn.role}-${index}`}
                align={presentation.align}
              >
                <MessageAvatar
                  className={cn(
                    "size-8 shrink-0 self-end overflow-hidden rounded-full p-0",
                    presentation.avatarClassName
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                </MessageAvatar>
                <MessageContent className="max-w-[85%]">
                  <MessageHeader>{presentation.label}</MessageHeader>
                  <Bubble
                    variant={presentation.bubbleVariant}
                    align={presentation.align}
                  >
                    <BubbleContent
                      className={cn(
                        "whitespace-pre-wrap shadow-sm",
                        presentation.bubbleClassName
                      )}
                    >
                      {turn.text}
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            )
          })}
        </MessageGroup>
      </ScrollArea>
    </div>
  )
}
