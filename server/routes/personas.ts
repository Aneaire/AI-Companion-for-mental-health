import { Hono } from "hono";
import { adminMiddleware } from "../middleware/admin";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const personas = new Hono();

// Load personas configuration
const loadPersonasConfig = () => {
  try {
    const configPath = join(process.cwd(), "..", "frontend", "public", "personas.json");
    const configData = readFileSync(configPath, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error loading personas config:", error);
    return null;
  }
};

// Load default personas configuration (backup)
const loadDefaultConfig = () => {
  try {
    const configPath = join(process.cwd(), "..", "server", "personas.json.backup");
    const configData = readFileSync(configPath, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error loading default config:", error);
    return null;
  }
};

// Save personas configuration
const savePersonasConfig = (config: any) => {
  try {
    const configPath = join(process.cwd(), "..", "frontend", "public", "personas.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving personas config:", error);
    return false;
  }
};

// Get current personas configuration
personas.get("/config", adminMiddleware, async (c) => {
  const config = loadPersonasConfig();
  if (!config) {
    return c.json({ error: "Failed to load personas configuration" }, 500);
  }
  return c.json(config);
});

// Get default personas configuration
personas.get("/default", adminMiddleware, async (c) => {
  const config = loadDefaultConfig();
  if (!config) {
    return c.json({ error: "Failed to load default configuration" }, 500);
  }
  return c.json(config);
});

// Save personas configuration
personas.post("/config", adminMiddleware, async (c) => {
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
    
    const success = savePersonasConfig(body);
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