DROP TABLE "impostor_conversations" CASCADE;--> statement-breakpoint
DROP TABLE "impostor_personas" CASCADE;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "thread_type" varchar DEFAULT 'chat' NOT NULL;