CREATE TABLE "voice_tool" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"description" text,
	"function" jsonb,
	"server" jsonb,
	"messages" jsonb,
	"async" boolean NOT NULL,
	"metadata" jsonb,
	"provider_options" jsonb,
	"raw" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_agent" ADD COLUMN "tool_ids" jsonb;--> statement-breakpoint
ALTER TABLE "voice_tool" ADD CONSTRAINT "voice_tool_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_tool_user_id_idx" ON "voice_tool" USING btree ("user_id");