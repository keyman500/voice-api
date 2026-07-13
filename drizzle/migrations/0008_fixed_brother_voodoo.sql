CREATE TABLE "credit_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credits" double precision NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_grants_user_id_idx" ON "credit_grants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_grants_user_id_reason_uidx" ON "credit_grants" USING btree ("user_id","reason");