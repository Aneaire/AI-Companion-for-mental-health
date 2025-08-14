-- Step 1: Create sessions table
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"session_number" integer NOT NULL,
	"session_name" varchar,
	"summary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Step 2: Add foreign key constraint for sessions -> threads
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;

-- Step 3: Create sessions for existing threads (each thread gets session #1)
INSERT INTO "sessions" ("thread_id", "session_number", "session_name", "created_at", "updated_at")
SELECT 
    t.id as thread_id,
    1 as session_number,
    COALESCE(t.session_name, 'Session 1') as session_name,
    t.created_at,
    t.updated_at
FROM "threads" t;

-- Step 4: Temporarily disable foreign key constraints
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_session_id_threads_id_fk";

-- Step 5: Create a temporary column to store the new session_id
ALTER TABLE "messages" ADD COLUMN "new_session_id" integer;

-- Step 6: Update messages to reference the correct session
UPDATE "messages" 
SET "new_session_id" = s.id
FROM "sessions" s
WHERE "messages"."session_id" = s."thread_id" 
AND "messages"."thread_type" = 'main';

-- Step 7: Remove old session_id column and rename new one
ALTER TABLE "messages" DROP COLUMN "session_id";
ALTER TABLE "messages" RENAME COLUMN "new_session_id" TO "session_id";

-- Step 8: Make session_id NOT NULL
ALTER TABLE "messages" ALTER COLUMN "session_id" SET NOT NULL;

-- Step 9: Add the new foreign key constraint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;