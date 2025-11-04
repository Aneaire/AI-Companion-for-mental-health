CREATE TABLE "counselor_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"status" varchar DEFAULT 'active',
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"message_count" integer DEFAULT 0,
	"session_duration" integer,
	"transfer_reason" text,
	"admin_summary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "counselor_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_type" varchar NOT NULL,
	"message" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"is_read" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "counselor_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"admin_id" integer,
	"status" varchar DEFAULT 'pending',
	"request_reason" text NOT NULL,
	"urgency_level" varchar DEFAULT 'medium',
	"user_context" jsonb,
	"requested_at" timestamp DEFAULT now(),
	"accepted_at" timestamp,
	"completed_at" timestamp,
	"admin_notes" text,
	"satisfaction_rating" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_request_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"request_count" integer DEFAULT 0,
	"date" timestamp NOT NULL,
	"last_request_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "counselor_chats" ADD CONSTRAINT "counselor_chats_request_id_counselor_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."counselor_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_chats" ADD CONSTRAINT "counselor_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_chats" ADD CONSTRAINT "counselor_chats_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_messages" ADD CONSTRAINT "counselor_messages_chat_id_counselor_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."counselor_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_messages" ADD CONSTRAINT "counselor_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_requests" ADD CONSTRAINT "counselor_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_requests" ADD CONSTRAINT "counselor_requests_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_request_limits" ADD CONSTRAINT "daily_request_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;