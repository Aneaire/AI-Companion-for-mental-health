ALTER TABLE "impostor_profiles" ALTER COLUMN "full_name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "age" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "personality" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "impostor_profiles" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "impostor_profiles" DROP COLUMN "talk_about";