import { db } from "./server/db/config";
import { personasConfig } from "./server/db/schema";
import { seedPersonasConfig } from "./server/db/seed-personas-config";

async function seedPersonas() {
  try {
    console.log("Seeding personas configuration...");

    const configData = seedPersonasConfig();

    if (configData.length === 0) {
      console.error("No personas configuration data found");
      return;
    }

    // Insert the configuration
    await db.insert(personasConfig).values(configData[0]);

    console.log("✅ Personas configuration seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding personas configuration:", error);
  } finally {
    process.exit(0);
  }
}

seedPersonas();