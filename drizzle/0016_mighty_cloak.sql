CREATE TABLE "impersonate_thread" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"persona_id" integer,
	"session_name" varchar,
	"preferred_name" varchar,
	"reason_for_visit" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_name" varchar,
	"preferred_name" varchar,
	"current_emotions" jsonb,
	"reason_for_visit" text NOT NULL,
	"support_type" jsonb,
	"support_type_other" text,
	"additional_context" text,
	"response_tone" varchar,
	"image_response" text,
	"response_character" varchar,
	"response_description" text,
	"summary_context" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chat_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "chat_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_session_id_chat_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "thread_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "impersonate_thread" ADD CONSTRAINT "impersonate_thread_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonate_thread" ADD CONSTRAINT "impersonate_thread_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;