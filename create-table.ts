import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function createTable() {
  try {
    console.log("Creating personas_config table...");

    await sql`
      CREATE TABLE IF NOT EXISTS "personas_config" (
        "id" serial PRIMARY KEY NOT NULL,
        "key" varchar NOT NULL,
        "personas" jsonb NOT NULL,
        "selection_rules" jsonb,
        "anger_detection" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "personas_config_key_unique" UNIQUE("key")
      );
    `;

    console.log("✅ Table created successfully!");
  } catch (error) {
    console.error("❌ Error creating table:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

createTable();