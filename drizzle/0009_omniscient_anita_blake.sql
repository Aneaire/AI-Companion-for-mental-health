CREATE TABLE "impostor_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"impostor_message" text NOT NULL,
	"therapist_message" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impostor_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"name" varchar NOT NULL,
	"age" integer NOT NULL,
	"personality" text NOT NULL,
	"background" text NOT NULL,
	"current_situation" text NOT NULL,
	"communication_style" varchar NOT NULL,
	"goals" text NOT NULL,
	"fears" text,
	"interests" text,
	"relationship_status" varchar,
	"occupation" varchar,
	"cultural_background" text,
	"persona_prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "impostor_conversations" ADD CONSTRAINT "impostor_conversations_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impostor_personas" ADD CONSTRAINT "impostor_personas_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "thread_type";