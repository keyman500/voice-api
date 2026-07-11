ALTER TABLE "voice_agent" ADD COLUMN "success_evaluation_prompt" text;--> statement-breakpoint
ALTER TABLE "voice_agent" ADD COLUMN "encrypted_webhook_secret" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "call_successful" boolean;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "success_evaluation_status" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "success_evaluation_reason" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "success_evaluation_error" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "webhook_delivery_status" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "webhook_delivery_attempts" integer;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "webhook_delivery_error" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "webhook_last_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "webhook_delivered_at" timestamp;