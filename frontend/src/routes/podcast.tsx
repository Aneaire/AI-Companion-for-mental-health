import { createFileRoute } from "@tanstack/react-router";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

export const Route = createFileRoute("/podcast")({
  component: RouteComponent,
});

function RouteComponent() {
  // Get background music controls
  const { startMusic, stopMusic, isPlaying: musicIsPlaying } = useBackgroundMusic("podcast");

  const handlePlayPause = () => {
    if (musicIsPlaying) {
      stopMusic();
    } else {
      startMusic();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Button
        onClick={handlePlayPause}
        size="lg"
        className={`w-40 h-40 rounded-full text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 ${
          musicIsPlaying
            ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 animate-pulse'
            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
        }`}
      >
        {musicIsPlaying ? (
          <Pause className="w-16 h-16" />
        ) : (
          <Play className="w-16 h-16 ml-2" />
        )}
      </Button>
    </div>
  );
}

