import { Hono } from "hono";
import { superadminMiddleware } from "../middleware/superadmin";
import { db } from "../db/config";
import { personasConfig } from "../db/schema";
import { eq } from "drizzle-orm";

const personas = new Hono();

// Load personas configuration from database
const loadPersonasConfig = async () => {
  try {
    const result = await db.select().from(personasConfig).where(eq(personasConfig.key, "main")).limit(1);
    if (result.length > 0) {
      const config = result[0];
      return {
        personas: config.personas,
        selectionRules: config.selectionRules,
        angerDetection: config.angerDetection,
      };
    }
    return null;
  } catch (error) {
    console.error("Error loading personas config from database:", error);
    return null;
  }
};

// Load default personas configuration (backup)
const loadDefaultConfig = () => {
  try {
    // For now, return a basic default config
    return {
      personas: {},
      selectionRules: {},
      angerDetection: {},
    };
  } catch (error) {
    console.error("Error loading default config:", error);
    return null;
  }
};

// Save personas configuration to database
const savePersonasConfigToDB = async (config: any) => {
  try {
    await db
      .insert(personasConfig)
      .values({
        key: "main",
        personas: config.personas,
        selectionRules: config.selectionRules,
        angerDetection: config.angerDetection,
      })
      .onConflictDoUpdate({
        target: personasConfig.key,
        set: {
          personas: config.personas,
          selectionRules: config.selectionRules,
          angerDetection: config.angerDetection,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch (error) {
    console.error("Error saving personas config to database:", error);
    return false;
  }
};

// Get current personas configuration
personas.get("/config", superadminMiddleware, async (c) => {
  const config = await loadPersonasConfig();
  if (!config) {
    return c.json({ error: "Failed to load personas configuration" }, 500);
  }
  return c.json(config);
});

// Get default personas configuration
personas.get("/default", superadminMiddleware, async (c) => {
  const config = loadDefaultConfig();
  if (!config) {
    return c.json({ error: "Failed to load default configuration" }, 500);
  }
  return c.json(config);
});

// Save personas configuration
personas.post("/config", superadminMiddleware, async (c) => {
  try {
    const body = await c.req.json();

    // Validate the configuration structure
    if (!body.personas || typeof body.personas !== "object") {
      return c.json({ error: "Invalid configuration: missing personas object" }, 400);
    }

    // Validate each persona has required fields
    for (const [personaId, persona] of Object.entries(body.personas)) {
      const p = persona as any;
      if (!p.id || !p.name || !p.description || !p.systemInstruction) {
        return c.json({
          error: `Invalid persona ${personaId}: missing required fields (id, name, description, systemInstruction)`
        }, 400);
      }
    }

    const success = await savePersonasConfigToDB(body);
    if (!success) {
      return c.json({ error: "Failed to save configuration" }, 500);
    }

    return c.json({ success: true, message: "Configuration saved successfully" });
  } catch (error) {
    console.error("Error saving personas config:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default personas;