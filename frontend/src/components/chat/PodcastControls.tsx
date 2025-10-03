import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Message } from "@/types/chat";
import { Pause, Play, Settings, SkipBack, SkipForward } from "lucide-react";

interface PodcastControlsProps {
  isPlaying: boolean;
  isImpersonating: boolean;
  currentMessageIndex: number;
  totalMessages: number;
  onPlayPause: () => void;
  onStartImpersonation: () => void;
  onStopImpersonation: () => void;
  onSkipToMessage: (index: number) => void;
  onSettingsClick: () => void;
  messages: Message[];
  isPodcastMode?: boolean;
}

export function PodcastControls({
  isPlaying,
  isImpersonating,
  currentMessageIndex,
  totalMessages,
  onPlayPause,
  onStartImpersonation,
  onStopImpersonation,
  onSkipToMessage,
  onSettingsClick,
  messages,
  isPodcastMode = false,
}: PodcastControlsProps) {
  const currentMessage = messages[currentMessageIndex];

  const isLatestMessageOld = () => {
    if (messages.length === 0) return false;
    const latestMessage = messages[messages.length - 1];
    const now = new Date();
    const messageTime = new Date(latestMessage.timestamp);
    const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
    return diffInHours > 1;
  };

  const handleStartImpersonation = () => {
    if (isLatestMessageOld()) {
      // Jump to the latest message if it's more than 1 hour old
      onSkipToMessage(messages.length - 1);
    }
    onStartImpersonation();
  };

  const handleSkip = (direction: "prev" | "next") => {
    let newIndex;
    if (direction === "next") {
      newIndex = Math.min(currentMessageIndex + 1, totalMessages - 1);
    } else {
      newIndex = Math.max(currentMessageIndex - 1, 0);
    }
    onSkipToMessage(newIndex);
  };

  const getSpeakerName = (sender: string) => {
    switch (sender) {
      case "user":
      case "therapist":
        return "Therapist";
      case "ai":
        return "AI Assistant";
      case "impostor":
        return "Patient";
      default:
        return "Speaker";
    }
  };

  const getProgressPercentage = () => {
    if (totalMessages === 0) return 0;
    return ((currentMessageIndex + 1) / totalMessages) * 100;
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200/60 p-4 shadow-lg">
      {/* Song Info and Settings */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {currentMessageIndex + 1} / {totalMessages}
          </Badge>
          {currentMessage && (
            <Badge
              variant={
                currentMessage.sender === "user" ||
                currentMessage.sender === "therapist"
                  ? "default"
                  : "secondary"
              }
              className="text-xs"
            >
              {getSpeakerName(currentMessage.sender)}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onSettingsClick}>
          <Settings size={16} />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <Slider
          value={[getProgressPercentage()]}
          max={100}
          min={0}
          step={1}
          className="w-full"
          onValueChange={(value) => {
            const percentage = value[0];
            const newIndex = Math.floor((percentage / 100) * totalMessages);
            onSkipToMessage(Math.max(0, Math.min(newIndex, totalMessages - 1)));
          }}
        />
      </div>

      {/* Main Music Player Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {/* Previous Message */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSkip("prev")}
          disabled={currentMessageIndex === 0}
        >
          <SkipBack size={20} />
        </Button>

        {/* Play/Pause or Start/Stop Impersonation */}
        {isImpersonating ? (
          <Button
            size="icon"
            onClick={isPlaying ? onPlayPause : handleStartImpersonation}
            className={`rounded-full w-14 h-14 ${
              isPlaying
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isPlaying ? (
              <Pause size={24} className="text-white" />
            ) : (
              <Play size={24} className="text-white" />
            )}
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleStartImpersonation}
            className="rounded-full w-14 h-14 bg-blue-500 hover:bg-blue-600"
          >
            <Play size={24} className="text-white" />
          </Button>
        )}

        {/* Next Message */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSkip("next")}
          disabled={currentMessageIndex >= totalMessages - 1}
        >
          <SkipForward size={20} />
        </Button>
      </div>

      {/* Status */}
      <div className="text-center mt-3">
        {isImpersonating ? (
          <span className="text-xs text-green-600">
            {isPlaying ? "🎵 Now Playing" : "⏸️ Paused"} • Therapeutic Dialogue
            {isPodcastMode && totalMessages >= 5 && (
              <span className="block mt-1 text-amber-600">
                Session limit: 5 exchanges reached
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-gray-500">
            {isPodcastMode
              ? "🎧 Ready to start therapeutic session"
              : "🎧 Ready to begin dialogue"}
          </span>
        )}
      </div>
    </div>
  );
}
