ALTER TABLE "chat_sessions" RENAME COLUMN "initial_form" TO "preferred_name";--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "current_emotions" jsonb;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "reason_for_visit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "support_type" jsonb;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "support_type_other" text;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "additional_context" text;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "response_tone" varchar;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "image_response" text;