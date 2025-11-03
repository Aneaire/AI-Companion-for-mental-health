CREATE TABLE "persona_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"selection_count" integer DEFAULT 1,
	"last_selected_at" timestamp DEFAULT now(),
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persona_selection_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"selection_count" integer DEFAULT 1,
	"cache_period_start" timestamp NOT NULL,
	"cache_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "nickname" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "age" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "hobby" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "session_forms" ADD COLUMN "questions" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image_url" varchar;--> statement-breakpoint
ALTER TABLE "persona_analytics" ADD CONSTRAINT "persona_analytics_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_selection_cache" ADD CONSTRAINT "persona_selection_cache_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE cascade ON UPDATE no action;