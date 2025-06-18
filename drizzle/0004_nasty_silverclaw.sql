ALTER TABLE "chat_sessions" ADD COLUMN "initial_form" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "preferred_name";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "current_emotions";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "reason_for_visit";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "support_type";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "support_type_other";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "additional_context";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "response_tone";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "image_response";