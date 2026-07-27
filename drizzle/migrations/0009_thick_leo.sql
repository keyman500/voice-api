CREATE TABLE "telnyx_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encrypted_public_key" text,
	"account_sid" text NOT NULL,
	"application_sid" text NOT NULL,
	"default_from_number" text,
	"default_webhook_base_url" text,
	"delete_telnyx_recording_after_blob_upload" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "telnyx_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "telnyx_call_sid" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "telnyx_account_sid" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "telephony_provider" text;--> statement-breakpoint
ALTER TABLE "voice_call" ADD COLUMN "recording_deleted_from_telnyx_at" timestamp;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD COLUMN "telnyx_phone_number_id" text;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD COLUMN "telnyx_account_sid" text;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD COLUMN "telephony_provider" text;--> statement-breakpoint
ALTER TABLE "telnyx_config" ADD CONSTRAINT "telnyx_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;