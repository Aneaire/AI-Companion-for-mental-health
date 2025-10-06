import client from "./client";
import { audioCache } from "@/lib/audioCache";
import { playAudioSequentially } from "@/lib/audioQueue";

const textToSpeech = async (text: string, voiceId?: string, autoPlay: boolean = true, modelId?: string, speed?: number): Promise<string> => {
  const selectedVoiceId = voiceId || import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  // Check if audio is already cached locally
  const cachedAudioUrl = audioCache.getAudio(text, selectedVoiceId, modelId);
  if (cachedAudioUrl) {
    console.log("Playing cached audio for:", text.substring(0, 50) + "...");

    if (autoPlay) {
      // Add to audio queue for sequential playback
      playAudioSequentially(cachedAudioUrl, undefined, undefined, undefined, speed);
    }

    return cachedAudioUrl;
  }

  // Audio will be cached in browser only - no server check needed

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
        volume: 1.0, // 100% volume
      },
    },
    { responseType: "blob" }
  );

  const audioBlob = response.data as Blob;

  // Store audio on server and get URL
  const url = await audioCache.storeAudio(text, selectedVoiceId, audioBlob, modelId);

  if (autoPlay) {
    // Add to audio queue for sequential playback
    playAudioSequentially(url, undefined, undefined, undefined, speed);
  }

  return url;
};

export default textToSpeech;
