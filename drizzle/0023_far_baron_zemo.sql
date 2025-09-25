CREATE TABLE "persona_customizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"customization_type" varchar NOT NULL,
	"customization_data" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persona_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"thread_id" integer,
	"session_duration" integer,
	"conversation_quality_score" integer,
	"therapeutic_techniques_used" jsonb,
	"persona_adaptations" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persona_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"base_personality" jsonb,
	"base_background" text,
	"base_age_range" varchar,
	"base_problem_types" jsonb,
	"is_public" boolean DEFAULT false,
	"created_by" integer,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persona_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"changes" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "template_id" integer;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "category" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "complexity_level" varchar DEFAULT 'basic';--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "emotional_profile" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "behavioral_patterns" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "cultural_background" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "socioeconomic_status" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "education_level" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "relationship_status" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "coping_mechanisms" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "triggers" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "goals" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "fears" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "strengths" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "weaknesses" jsonb;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "communication_style" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "attachment_style" varchar;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "is_template" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "usage_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "last_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "persona" ADD COLUMN "evolution_stage" varchar DEFAULT 'initial';--> statement-breakpoint
ALTER TABLE "persona_customizations" ADD CONSTRAINT "persona_customizations_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_sessions" ADD CONSTRAINT "persona_sessions_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_sessions" ADD CONSTRAINT "persona_sessions_thread_id_impersonate_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."impersonate_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_templates" ADD CONSTRAINT "persona_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_versions" ADD CONSTRAINT "persona_versions_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona" ADD CONSTRAINT "persona_template_id_persona_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."persona_templates"("id") ON DELETE no action ON UPDATE no action;