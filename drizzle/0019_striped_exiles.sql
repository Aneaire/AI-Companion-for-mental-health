ALTER TABLE "messages" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "impersonate_thread_id" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_impersonate_thread_id_impersonate_thread_id_fk" FOREIGN KEY ("impersonate_thread_id") REFERENCES "public"."impersonate_thread"("id") ON DELETE cascade ON UPDATE no action;