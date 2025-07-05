ALTER TABLE "persona" ALTER COLUMN "full_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "age" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "personality" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "talk_about" text NOT NULL;