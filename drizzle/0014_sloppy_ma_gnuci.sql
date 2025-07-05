ALTER TABLE "persona" ALTER COLUMN "full_name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "age" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "personality" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "persona" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "persona" DROP COLUMN "talk_about";