import { personasConfig } from "./schema";
import { readFileSync } from "fs";
import { join } from "path";

const seedPersonasConfig = () => {
  try {
    // Read the personas.json file
    const configPath = join(process.cwd(), "frontend", "public", "personas.json");
    const configData = readFileSync(configPath, "utf-8");
    const personasData = JSON.parse(configData);

    return [
      {
        key: "main",
        personas: personasData.personas,
        selectionRules: personasData.selectionRules,
        angerDetection: personasData.angerDetection,
      },
    ];
  } catch (error) {
    console.error("Error reading personas.json:", error);
    return [];
  }
};

export { seedPersonasConfig };