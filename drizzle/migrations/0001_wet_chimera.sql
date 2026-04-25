CREATE TABLE "livekit_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_url" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encrypted_api_secret" text NOT NULL,
	"default_sip_outbound_trunk_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "livekit_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "voice_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"voice" jsonb,
	"model" jsonb,
	"first_message" text,
	"max_duration_seconds" integer,
	"background_sound" text,
	"voicemail_message" text,
	"webhook_url" text,
	"webhook_timeout_seconds" integer,
	"metadata" jsonb,
	"provider_options" jsonb,
	"raw" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_call" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"to_number" text,
	"from_number" text,
	"phone_number_id" text,
	"livekit_room_name" text,
	"livekit_sip_participant_id" text,
	"livekit_sip_call_id" text,
	"livekit_sip_trunk_id" text,
	"provider_source" text NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration" integer,
	"transcript" text,
	"recording_url" text,
	"analysis" jsonb,
	"metadata" jsonb,
	"provider_options" jsonb,
	"raw" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_call_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"call_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_phone_number" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"number" text,
	"name" text,
	"inbound_agent_id" text,
	"outbound_agent_id" text,
	"webhook_url" text,
	"area_code" text,
	"livekit_sip_inbound_trunk_id" text,
	"livekit_sip_outbound_trunk_id" text,
	"metadata" jsonb,
	"provider_options" jsonb,
	"raw" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "livekit_config" ADD CONSTRAINT "livekit_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_agent" ADD CONSTRAINT "voice_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call" ADD CONSTRAINT "voice_call_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call" ADD CONSTRAINT "voice_call_agent_id_voice_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."voice_agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call_event" ADD CONSTRAINT "voice_call_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call_event" ADD CONSTRAINT "voice_call_event_call_id_voice_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."voice_call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD CONSTRAINT "voice_phone_number_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD CONSTRAINT "voice_phone_number_inbound_agent_id_voice_agent_id_fk" FOREIGN KEY ("inbound_agent_id") REFERENCES "public"."voice_agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_phone_number" ADD CONSTRAINT "voice_phone_number_outbound_agent_id_voice_agent_id_fk" FOREIGN KEY ("outbound_agent_id") REFERENCES "public"."voice_agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_agent_user_id_idx" ON "voice_agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_call_user_id_idx" ON "voice_call" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_call_agent_id_idx" ON "voice_call" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "voice_call_status_idx" ON "voice_call" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_call_event_call_id_idx" ON "voice_call_event" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "voice_call_event_user_id_idx" ON "voice_call_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_phone_number_user_id_idx" ON "voice_phone_number" USING btree ("user_id");