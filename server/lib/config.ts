export const geminiConfig = {
  // Default model to use
  model: "gemini-1.5-flash",

  // Flash Models (optimized for speed and efficiency)
  twoFlash: "gemini-2.5-flash-lite",
  twoPoint5Flash: "gemini-2.5-flash-lite",
  twoPoint5FlashLite: "gemini-2.5-flash-lite", // Even lighter/faster, if available

  // Pro Models (optimized for complex reasoning and larger tasks)
  // These names are speculative for "2.0" and "2.5" as
  // Google publicly uses "1.5-pro". Use what your environment supports.
  twoPro: "gemini-2.0-pro",
  twoPoint5Pro: "gemini-2.5-pro",

  // Common public names for reference, if your system maps to these
  oneFiveFlash: "gemini-1.5-flash",
  oneFiveFlashLatest: "gemini-1.5-flash-latest",
  oneFivePro: "gemini-1.5-pro",
  oneFiveProLatest: "gemini-1.5-pro-latest",

  // Example of a vision-capable model (often included with Pro or specific multimodal models)
  // If your system has a distinct vision model ID
  visionPro: "gemini-2.5-pro-vision", // Speculative name for a vision-specific version
};

// Global cache for admin settings (in production, this would be in a database)
let adminSettingsCache: {
  geminiApiKey?: string;
  elevenlabsApiKey?: string;
} = {};

// Function to get admin settings (in production, this would query the database)
export async function getAdminSettings() {
  // TODO: Implement database query to get admin settings
  // For now, return cached values
  return adminSettingsCache;
}

// Function to update admin settings cache
export function updateAdminSettings(settings: { geminiApiKey?: string; elevenlabsApiKey?: string }) {
  adminSettingsCache = { ...adminSettingsCache, ...settings };
}

// Utility function to get Gemini API key (prioritizes admin settings over env vars)
export function getGeminiApiKey(): string | undefined {
  return adminSettingsCache.geminiApiKey || process.env.GEMINI_API_KEY;
}

// Utility function to get ElevenLabs API key (prioritizes admin settings over env vars)
export function getElevenLabsApiKey(): string | undefined {
  return adminSettingsCache.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY;
}
