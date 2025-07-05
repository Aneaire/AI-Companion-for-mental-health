ALTER TABLE "impostor_profiles" RENAME TO "persona";--> statement-breakpoint
ALTER TABLE "persona" DROP CONSTRAINT "impostor_profiles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "persona_id" integer;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona" ADD CONSTRAINT "persona_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;