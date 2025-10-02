import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Settings,
  RotateCcw,
  RotateCw
} from "lucide-react";
import type { Message } from "@/types/chat";

interface PodcastControlsProps {
  isPlaying: boolean;
  isImpersonating: boolean;
  currentMessageIndex: number;
  totalMessages: number;
  speed: number;
  onPlayPause: () => void;
  onStartImpersonation: () => void;
  onStopImpersonation: () => void;
  onSkipToMessage: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onSettingsClick: () => void;
  messages: Message[];
  isPodcastMode?: boolean;
}

export function PodcastControls({
  isPlaying,
  isImpersonating,
  currentMessageIndex,
  totalMessages,
  speed,
  onPlayPause,
  onStartImpersonation,
  onStopImpersonation,
  onSkipToMessage,
  onSpeedChange,
  onSettingsClick,
  messages,
  isPodcastMode = false,
}: PodcastControlsProps) {
  const currentMessage = messages[currentMessageIndex];

  const handleSkip = (direction: 'prev' | 'next') => {
    let newIndex;
    if (direction === 'next') {
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
      {/* Progress and Current Speaker */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {currentMessageIndex + 1} / {totalMessages}
          </Badge>
          {currentMessage && (
            <Badge
              variant={currentMessage.sender === "user" || currentMessage.sender === "therapist" ? "default" : "secondary"}
              className="text-xs"
            >
              {getSpeakerName(currentMessage.sender)}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSettingsClick}
        >
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

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {/* Previous Message */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSkip('prev')}
          disabled={currentMessageIndex === 0}
        >
          <SkipBack size={20} />
        </Button>

        {/* Play/Pause or Start/Stop Impersonation */}
        {isImpersonating ? (
          <Button
            size="lg"
            onClick={isPlaying ? onPlayPause : onStartImpersonation}
            className={`rounded-full w-14 h-14 ${
              isPlaying
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={onStartImpersonation}
            className="rounded-full w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Play size={24} />
          </Button>
        )}

        {/* Next Message */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSkip('next')}
          disabled={currentMessageIndex >= totalMessages - 1}
        >
          <SkipForward size={20} />
        </Button>
      </div>
      {/* Secondary Controls */}
      <div className="flex items-center justify-end">
        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <RotateCcw size={14} className="text-gray-500" />
          <Slider
            value={[speed]}
            onValueChange={(value) => onSpeedChange(value[0])}
            max={2}
            min={0.5}
            step={0.1}
            className="w-20"
          />
          <RotateCw size={14} className="text-gray-500" />
          <span className="text-xs text-gray-600 min-w-8">
            {speed.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="text-center mt-3">
        {isImpersonating ? (
          <span className="text-xs text-green-600">
            {isPlaying ? "Playing" : "Paused"} • Auto-advancing through conversation
            {isPodcastMode && totalMessages >= 5 && (
              <span className="block mt-1 text-amber-600">
                Podcast limit: 5 messages reached
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-gray-500">
            {isPodcastMode ? "Ready to start podcast session (5 message limit)" : "Ready to start session"}
          </span>
        )}
      </div>
    </div>
  );
}