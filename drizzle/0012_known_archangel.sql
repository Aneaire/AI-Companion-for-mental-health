ALTER TABLE "impostor_profiles" RENAME COLUMN "interests" TO "problem_description";--> statement-breakpoint
ALTER TABLE "impostor_profiles" ADD COLUMN "personality" varchar;