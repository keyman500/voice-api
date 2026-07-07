CREATE TABLE "twilio_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_account_sid" text NOT NULL,
	"encrypted_auth_token" text NOT NULL,
	"default_from_number" text,
	"default_webhook_base_url" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "twilio_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "voice_transcript_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"call_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"sequence" integer NOT NULL,
	"raw" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "twilio_call_sid" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "twilio_account_sid" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "relay_session_id" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_sid" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_status" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_storage_key" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_storage_provider" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_content_type" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD COLUMN "twilio_phone_number_sid" text;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD COLUMN "twilio_account_sid" text;--> statement-breakpoint
ALTER TABLE "twilio_config" ADD CONSTRAINT "twilio_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_transcript_item" ADD CONSTRAINT "voice_transcript_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_transcript_item" ADD CONSTRAINT "voice_transcript_item_call_id_voice_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."voice_call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_transcript_item_call_id_idx" ON "voice_transcript_item" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "voice_transcript_item_user_id_idx" ON "voice_transcript_item" USING btree ("user_id");