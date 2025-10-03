import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { z } from "zod";

const audioRoute = new Hono();

// Ensure audio directory exists
const audioDir = path.join(process.cwd(), "audio");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Save audio file endpoint
audioRoute.post("/save", async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      text: z.string(),
      voiceId: z.string(),
      modelId: z.string().optional(),
      audioBlob: z.string(), // base64 encoded audio
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    const { text, voiceId, modelId = "eleven_flash_v2_5", audioBlob } = parsed.data;

    // Create filename based on text hash and voiceId (using same hash as client)
    const input = text.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const textHash = Math.abs(hash).toString(36).substring(0, 16);
    const filename = `${textHash}_${voiceId}_${modelId}.mp3`;
    const filepath = path.join(audioDir, filename);

    // Decode base64 and save file
    const audioBuffer = Buffer.from(audioBlob, 'base64');
    fs.writeFileSync(filepath, audioBuffer);

    return c.json({
      success: true,
      filename,
      url: `/api/audio/${filename}`
    });
  } catch (error) {
    console.error("Error saving audio file:", error);
    return c.json({ error: "Failed to save audio file" }, 500);
  }
});

// Get audio file endpoint
audioRoute.get("/:filename", async (c) => {
  try {
    const filename = c.req.param("filename");
    const filepath = path.join(audioDir, filename);

    if (!fs.existsSync(filepath)) {
      return c.json({ error: "Audio file not found" }, 404);
    }

    const audioBuffer = fs.readFileSync(filepath);
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error("Error serving audio file:", error);
    return c.json({ error: "Failed to serve audio file" }, 500);
  }
});

// Check if audio exists endpoint
audioRoute.get("/exists/:textHash/:voiceId/:modelId?", async (c) => {
  try {
    const textHash = c.req.param("textHash");
    const voiceId = c.req.param("voiceId");
    const modelId = c.req.param("modelId") || "eleven_flash_v2_5";
    const filename = `${textHash}_${voiceId}_${modelId}.mp3`;
    const filepath = path.join(audioDir, filename);

    const exists = fs.existsSync(filepath);
    return c.json({ exists, filename: exists ? filename : null });
  } catch (error) {
    console.error("Error checking audio file:", error);
    return c.json({ error: "Failed to check audio file" }, 500);
  }
});

export default audioRoute;