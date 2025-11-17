CREATE TABLE "personas_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"personas" jsonb NOT NULL,
	"selection_rules" jsonb,
	"anger_detection" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "personas_config_key_unique" UNIQUE("key")
);
