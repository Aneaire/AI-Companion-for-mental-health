CREATE TABLE "session_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"answers" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "session_forms" ADD CONSTRAINT "session_forms_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;