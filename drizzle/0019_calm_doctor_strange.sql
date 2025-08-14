ALTER TABLE "messages" RENAME COLUMN "impersonate_thread_id" TO "thread_id";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_impersonate_thread_id_impersonate_thread_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_impersonate_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."impersonate_thread"("id") ON DELETE cascade ON UPDATE no action;