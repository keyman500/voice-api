ALTER TABLE "twilio_config" ADD COLUMN "delete_twilio_recording_after_blob_upload" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "post_call_status" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "post_call_workflow_run_id" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_ingested_at" timestamp;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_deleted_from_twilio_at" timestamp;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_ingestion_error" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "analysis_status" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "analysis_error" text;