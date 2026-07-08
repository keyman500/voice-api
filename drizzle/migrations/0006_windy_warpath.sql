CREATE TABLE "usage_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"call_id" text,
	"agent_id" text,
	"kind" text NOT NULL,
	"event_name" text NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"duration_seconds" integer,
	"credits" double precision NOT NULL,
	"provider_cost_usd" double precision,
	"billable_usd" double precision,
	"markup" double precision,
	"polar_event_id" text,
	"polar_ingest_status" text NOT NULL,
	"polar_ingest_error" text,
	"raw" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_ledger_user_id_idx" ON "usage_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_ledger_call_id_idx" ON "usage_ledger" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "usage_ledger_kind_idx" ON "usage_ledger" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "usage_ledger_polar_ingest_status_idx" ON "usage_ledger" USING btree ("polar_ingest_status");