import { db } from "./server/db/config";
import { personasConfig } from "./server/db/schema";
import { eq } from "drizzle-orm";

async function checkDatabase() {
  try {
    console.log("Checking personas_config table...");

    const result = await db.select().from(personasConfig).where(eq(personasConfig.key, "main"));
    console.log("Current records:", result.length);

    if (result.length > 0) {
      console.log("Found existing record with key 'main'");
    } else {
      console.log("No records found with key 'main'");
    }
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    process.exit(0);
  }
}

checkDatabase();