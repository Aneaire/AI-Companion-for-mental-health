ALTER TABLE "impostor_profiles" ALTER COLUMN "full_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "age" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "personality" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ADD COLUMN "talk_about" text NOT NULL;