import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
}

function ElevenLabsTTSTest() {
  const [text, setText] = useState("Hello! This is a test of ElevenLabs text-to-speech. The quick brown fox jumps over the lazy dog.");
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState("21m00Tcm4TlvDq8ikWAM"); // Rachel
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.5,
    style: 0.0,
    use_speaker_boost: true,
  });
  const [model, setModel] = useState("eleven_monolingual_v1");

  const audioRef = useRef<HTMLAudioElement>(null);

  // Popular ElevenLabs voices
  const voices: Voice[] = [
    { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "premade" },
    { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "premade" },
    { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "premade" },
    { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "premade" },
    { voice_id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "premade" },
    { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "premade" },
    { voice_id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "premade" },
  ];

  const models = [
    { id: "eleven_monolingual_v1", name: "Eleven Monolingual v1" },
    { id: "eleven_multilingual_v1", name: "Eleven Multilingual v1" },
    { id: "eleven_turbo_v2", name: "Eleven Turbo v2" },
  ];

  const generateSpeech = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text to convert to speech");
      return;
    }

    setIsLoading(true);
    setAudioUrl(null);

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": import.meta.env.VITE_ELEVENLABS_API_KEY || "",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: model,
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      toast.success("Audio generated successfully!");
    } catch (error) {
      console.error("TTS Error:", error);
      toast.error(`Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `elevenlabs-tts-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const updateVoiceSetting = (key: keyof VoiceSettings, value: number | boolean) => {
    setVoiceSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">ElevenLabs Text-to-Speech Test</h1>
        <p className="text-gray-600">
          Test ElevenLabs text-to-speech functionality with different voices and settings
        </p>
      </div>

      {/* Text Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Text to Convert</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="min-h-[100px]"
            rows={4}
          />
          <div className="mt-2 text-sm text-gray-500">
            {text.length} characters
          </div>
        </CardContent>
      </Card>

      {/* Voice Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Voice Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {voices.map((voice) => (
              <Button
                key={voice.voice_id}
                variant={selectedVoice === voice.voice_id ? "default" : "outline"}
                onClick={() => setSelectedVoice(voice.voice_id)}
                className="h-auto p-3 flex flex-col items-center"
              >
                <span className="font-medium">{voice.name}</span>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {voice.category}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Model Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {models.map((modelOption) => (
              <Button
                key={modelOption.id}
                variant={model === modelOption.id ? "default" : "outline"}
                onClick={() => setModel(modelOption.id)}
                className="h-auto p-3 flex flex-col items-center"
              >
                <span className="font-medium">{modelOption.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Voice Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Stability: {voiceSettings.stability.toFixed(2)}</Label>
            <Slider
              value={[voiceSettings.stability]}
              onValueChange={(value) => updateVoiceSetting('stability', value[0])}
              max={1}
              min={0}
              step={0.01}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Higher values make the voice more stable and consistent
            </p>
          </div>

          <div>
            <Label>Similarity Boost: {voiceSettings.similarity_boost.toFixed(2)}</Label>
            <Slider
              value={[voiceSettings.similarity_boost]}
              onValueChange={(value) => updateVoiceSetting('similarity_boost', value[0])}
              max={1}
              min={0}
              step={0.01}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Higher values make the voice more similar to the original
            </p>
          </div>

          <div>
            <Label>Style Exaggeration: {(voiceSettings.style || 0).toFixed(2)}</Label>
            <Slider
              value={[voiceSettings.style || 0]}
              onValueChange={(value) => updateVoiceSetting('style', value[0])}
              max={1}
              min={0}
              step={0.01}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Higher values make the voice more expressive
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="speakerBoost"
              checked={voiceSettings.use_speaker_boost || false}
              onChange={(e) => updateVoiceSetting('use_speaker_boost', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="speakerBoost">Use Speaker Boost</Label>
          </div>
        </CardContent>
      </Card>

      {/* Generate and Play */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate & Play Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Button
              onClick={generateSpeech}
              disabled={isLoading || !text.trim()}
              className="flex-1"
            >
              {isLoading ? "Generating..." : "Generate Speech"}
            </Button>

            {audioUrl && (
              <>
                <Button onClick={playAudio} variant="outline">
                  Play Audio
                </Button>
                <Button onClick={downloadAudio} variant="outline">
                  Download
                </Button>
              </>
            )}
          </div>

          {audioUrl && (
            <div className="mt-4">
              <audio
                ref={audioRef}
                controls
                className="w-full"
                src={audioUrl}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Key Notice */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>API Key Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Make sure to set your ElevenLabs API key in the environment variables:
          </p>
          <code className="block mt-2 p-2 bg-gray-100 rounded text-sm">
            VITE_ELEVENLABS_API_KEY=your_api_key_here
          </code>
          <p className="text-sm text-gray-600 mt-2">
            Get your API key from the <a href="https://elevenlabs.io/app/profile" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ElevenLabs dashboard</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ElevenLabsTTSTest;

export const Route = createFileRoute("/elevenlabs-tts-test")({
  component: ElevenLabsTTSTest,
});