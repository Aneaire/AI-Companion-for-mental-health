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

    // Upsert the configuration (insert or update if exists)
    await db
      .insert(personasConfig)
      .values(configData[0])
      .onConflictDoUpdate({
        target: personasConfig.key,
        set: {
          personas: configData[0].personas,
          selectionRules: configData[0].selectionRules,
          angerDetection: configData[0].angerDetection,
          updatedAt: new Date(),
        },
      });

    console.log("✅ Personas configuration seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding personas configuration:", error);
  } finally {
    process.exit(0);
  }
}

seedPersonas();