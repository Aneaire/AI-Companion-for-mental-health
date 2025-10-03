import client from "./client";
import { audioCache } from "@/lib/audioCache";
import { playAudioSequentially } from "@/lib/audioQueue";

const textToSpeech = async (text: string, voiceId?: string, autoPlay: boolean = true, modelId?: string): Promise<string> => {
  const selectedVoiceId = voiceId || import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  // Check if audio is already cached locally
  const cachedAudioUrl = audioCache.getAudio(text, selectedVoiceId, modelId);
  if (cachedAudioUrl) {
    console.log("Playing cached audio for:", text.substring(0, 50) + "...");

    if (autoPlay) {
      // Add to audio queue for sequential playback
      playAudioSequentially(cachedAudioUrl);
    }

    return cachedAudioUrl;
  }

  // Check if audio exists on server
  try {
    // Generate text hash using simple hash function (safe for any characters)
    const input = text.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const textHash = Math.abs(hash).toString(36).substring(0, 16);
    const existsResponse = await fetch(`/api/audio/exists/${textHash}/${selectedVoiceId}/${modelId}`);
    if (existsResponse.ok) {
      const existsData = await existsResponse.json();
      if (existsData.exists && existsData.filename) {
        const serverUrl = `/api/audio/${existsData.filename}`;
        console.log("Found existing audio on server for:", text.substring(0, 50) + "...");

        // Cache the server URL locally
        audioCache.cacheServerUrl(text, selectedVoiceId, serverUrl, existsData.filename, modelId);

        if (autoPlay) {
          // Add to audio queue for sequential playback
          playAudioSequentially(serverUrl);
        }

        return serverUrl;
      }
    }
  } catch (error) {
    console.warn("Failed to check server for existing audio:", error);
  }

  // Generate new audio if not cached
  console.log("Generating new audio for:", text.substring(0, 50) + "...");

  const response = await client.post(
    `/v1/text-to-speech/${selectedVoiceId}`,
    {
      text,
      model_id: modelId || "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    },
    { responseType: "blob" }
  );

  const audioBlob = response.data as Blob;

  // Store audio on server and get URL
  const url = await audioCache.storeAudio(text, selectedVoiceId, audioBlob, modelId);

  if (autoPlay) {
    // Add to audio queue for sequential playback
    playAudioSequentially(url);
  }

  return url;
};

export default textToSpeech;
