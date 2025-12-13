DROP TABLE IF EXISTS "role_audit_log" CASCADE;
--> statement-breakpoint
CREATE TABLE "thread_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"thread_id" integer,
	"access_type" varchar NOT NULL,
	"reason" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp,
	"expires_at" timestamp,
	"denied_at" timestamp,
	"denial_reason" text,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thread_access_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"access_log_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"thread_id" integer,
	"access_type" varchar NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "thread_access_logs" ADD CONSTRAINT "thread_access_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_access_logs" ADD CONSTRAINT "thread_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_access_logs" ADD CONSTRAINT "thread_access_logs_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_access_permissions" ADD CONSTRAINT "thread_access_permissions_access_log_id_thread_access_logs_id_fk" FOREIGN KEY ("access_log_id") REFERENCES "public"."thread_access_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_access_permissions" ADD CONSTRAINT "thread_access_permissions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_access_permissions" ADD CONSTRAINT "thread_access_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_access_permissions" ADD CONSTRAINT "thread_access_permissions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;