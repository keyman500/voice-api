ALTER TABLE "voice_agent" ADD COLUMN "voice_engine" text DEFAULT 'conversation-relay' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "voice_engine" text DEFAULT 'conversation-relay' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "realtime_model" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "transcription_status" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "transcription_model" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "transcription_error" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "terminal_reason" text;