export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
}

export interface VoicesResponse {
  voices: ElevenLabsVoice[];
}

export const fetchVoices = async (): Promise<ElevenLabsVoice[]> => {
  try {
    const response = await fetch("https://api.elevenlabs.io/v2/voices", {
      headers: {
        "xi-api-key": import.meta.env.VITE_ELEVENLABS_API_KEY || "",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data: VoicesResponse = await response.json();
    return data.voices;
  } catch (error) {
    console.error("Error fetching voices:", error);
    throw error;
  }
};

export const getDefaultVoices = (): { therapist: string; impostor: string } => {
  return {
    therapist: "21m00Tcm4TlvDq8ikWAM", // Rachel
    impostor: "AZnzlk1XvdvUeBnXmlld", // Domi
  };
};