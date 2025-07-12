const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { threads, sessions, messages } = require("./server/db/schema");

// Database connection
const sql = postgres(
  process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/capstone"
);
const db = drizzle(sql);

async function migrateToSessions() {
  try {
    console.log("Starting migration to sessions...");

    // Step 1: Create sessions table
    console.log("Creating sessions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" serial PRIMARY KEY NOT NULL,
        "thread_id" integer NOT NULL,
        "session_number" integer NOT NULL,
        "session_name" varchar,
        "summary" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;

    // Step 2: Add foreign key constraint for sessions -> threads
    console.log("Adding foreign key constraint...");
    await sql`
      ALTER TABLE "sessions" 
      ADD CONSTRAINT IF NOT EXISTS "sessions_thread_id_threads_id_fk" 
      FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action
    `;

    // Step 3: Create sessions for existing threads
    console.log("Creating sessions for existing threads...");
    await sql`
      INSERT INTO "sessions" ("thread_id", "session_number", "session_name", "created_at", "updated_at")
      SELECT 
        t.id as thread_id,
        1 as session_number,
        COALESCE(t.session_name, 'Session 1') as session_name,
        t.created_at,
        t.updated_at
      FROM "threads" t
      ON CONFLICT DO NOTHING
    `;

    // Step 4: Check if there are any messages that need migration
    const existingMessages = await sql`
      SELECT COUNT(*) as count FROM "messages" WHERE "thread_type" = 'main'
    `;

    if (existingMessages[0].count > 0) {
      console.log(`Found ${existingMessages[0].count} messages to migrate...`);

      // Step 5: Create temporary column
      console.log("Creating temporary column...");
      await sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "new_session_id" integer`;

      // Step 6: Update messages to reference sessions
      console.log("Updating message references...");
      await sql`
        UPDATE "messages" 
        SET "new_session_id" = s.id
        FROM "sessions" s
        WHERE "messages"."session_id" = s."thread_id" 
        AND "messages"."thread_type" = 'main'
      `;

      // Step 7: Drop old foreign key constraint if it exists
      console.log("Dropping old foreign key constraint...");
      await sql`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_session_id_threads_id_fk"`;

      // Step 8: Remove old session_id column and rename new one
      console.log("Renaming columns...");
      await sql`ALTER TABLE "messages" DROP COLUMN IF EXISTS "session_id"`;
      await sql`ALTER TABLE "messages" RENAME COLUMN "new_session_id" TO "session_id"`;

      // Step 9: Make session_id NOT NULL
      console.log("Making session_id NOT NULL...");
      await sql`ALTER TABLE "messages" ALTER COLUMN "session_id" SET NOT NULL`;

      // Step 10: Add new foreign key constraint
      console.log("Adding new foreign key constraint...");
      await sql`
        ALTER TABLE "messages" 
        ADD CONSTRAINT "messages_session_id_sessions_id_fk" 
        FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action
      `;
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the migration
migrateToSessions().catch(console.error);
