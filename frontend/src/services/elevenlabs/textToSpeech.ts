import client from "./client";

const textToSpeech = async (text: string, voiceId?: string): Promise<string> => {
  const selectedVoiceId = voiceId || import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  const response = await client.post(
    `/v1/text-to-speech/${selectedVoiceId}`,
    {
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    },
    { responseType: "blob" }
  );

  const file = new File([response.data], "audio.mp3", { type: "audio/mpeg" });
  const url = URL.createObjectURL(file);

  // Auto-play the audio
  const audio = new Audio(url);
  audio.play().catch(error => {
    console.error("Failed to play audio:", error);
  });

  return url;
};

export default textToSpeech;
