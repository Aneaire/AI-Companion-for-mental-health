import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Message } from "@/types/chat";
import { useEffect, useState } from "react";

interface TextDisplayProps {
  messages: Message[];
  currentMessageIndex: number;
  currentWordIndex: number;
  textSize: "small" | "medium" | "large";
  highlightStyle: "underline" | "background" | "bold";
  autoScroll: boolean;
  isPlaying: boolean;
}

export function TextDisplay({
  messages,
  currentMessageIndex,
  currentWordIndex,
  textSize,
  highlightStyle,
  autoScroll,
  isPlaying,
}: TextDisplayProps) {
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);

  // Update displayed messages when current message changes
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      // Show current message and a few previous ones for context
      const startIndex = Math.max(0, currentMessageIndex - 2);
      const endIndex = Math.min(messages.length, currentMessageIndex + 3);
      setDisplayedMessages(messages.slice(startIndex, endIndex));
    } else {
      setDisplayedMessages(messages);
    }
  }, [messages, currentMessageIndex, autoScroll]);

  const getTextSizeClasses = () => {
    switch (textSize) {
      case "small":
        return "text-lg leading-relaxed";
      case "medium":
        return "text-xl leading-relaxed";
      case "large":
        return "text-2xl leading-loose";
      default:
        return "text-xl leading-relaxed";
    }
  };

  const getHighlightClasses = (isHighlighted: boolean) => {
    if (!isHighlighted) return "";

    switch (highlightStyle) {
      case "underline":
        return "underline decoration-2 decoration-blue-500 underline-offset-4";
      case "background":
        return "bg-blue-200/60 rounded px-1";
      case "bold":
        return "font-bold text-blue-700";
      default:
        return "bg-blue-200/60 rounded px-1";
    }
  };

  const renderHighlightedText = (text: string, messageIndex: number, globalMessageIndex: number) => {
    if (!text) return null;

    const words = text.split(/\s+/);

    return words.map((word, wordIdx) => {
      const isHighlighted =
        globalMessageIndex === currentMessageIndex &&
        wordIdx === currentWordIndex &&
        isPlaying;

      return (
        <span
          key={`${messageIndex}-${wordIdx}`}
          className={`${getHighlightClasses(isHighlighted)} transition-all duration-200`}
        >
          {word}{wordIdx < words.length - 1 ? " " : ""}
        </span>
      );
    });
  };

  const getSpeakerBadge = (sender: string) => {
    const isTherapist = sender === "user" || sender === "therapist";
    return (
      <Badge
        variant={isTherapist ? "default" : "secondary"}
        className={`mb-2 ${
          isTherapist
            ? "bg-blue-100 text-blue-800 border-blue-200"
            : "bg-purple-100 text-purple-800 border-purple-200"
        }`}
      >
        {isTherapist ? "Therapist" : "Patient"}
      </Badge>
    );
  };

  const getProgressPercentage = () => {
    if (messages.length === 0) return 0;
    return ((currentMessageIndex + 1) / messages.length) * 100;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white rounded-lg p-6 shadow-inner">
      {/* Album Art Placeholder */}
      <div className="flex-shrink-0 mb-6">
        <div className="w-full max-w-sm mx-auto aspect-square bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg shadow-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white">🎵</span>
            </div>
            <p className="text-gray-600 text-sm">Therapeutic Conversation</p>
          </div>
        </div>
      </div>

      {/* Song Info Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Therapeutic Dialogue
        </h2>
        <p className="text-lg text-gray-600 mb-1">Therapist & Patient</p>
        <Badge variant="outline" className="mt-2">
          Healing Conversation
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Message {currentMessageIndex + 1} of {messages.length}
          </span>
          <span className="text-sm text-gray-600">
            {Math.round(getProgressPercentage())}% Complete
          </span>
        </div>
        <Progress value={getProgressPercentage()} className="h-2" />
      </div>

      {/* Lyrics Display Area */}
      <div className="flex-1 overflow-y-auto space-y-6 px-4">
        {displayedMessages.map((message, index) => {
          const globalIndex = messages.indexOf(message);
          const isCurrentMessage = globalIndex === currentMessageIndex;
          const isPastMessage = globalIndex < currentMessageIndex;
          const isUpcomingMessage = globalIndex > currentMessageIndex;

          return (
            <div
              key={message.id || message.tempId || globalIndex}
              className={`transition-all duration-500 ${
                isCurrentMessage
                  ? "transform scale-105 opacity-100"
                  : isPastMessage
                  ? "opacity-70"
                  : isUpcomingMessage
                  ? "opacity-50"
                  : "opacity-40"
              }`}
            >
              {/* Speaker Badge */}
              <div className="flex justify-center mb-3">
                {getSpeakerBadge(message.sender)}
              </div>

              {/* Message Text as Lyrics */}
              <div
                className={`text-center ${getTextSizeClasses()} text-gray-800 leading-relaxed`}
              >
                {renderHighlightedText(message.text || "", index, globalIndex)}
              </div>

              {/* Current Message Indicator */}
              {isCurrentMessage && isPlaying && (
                <div className="flex justify-center mt-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Indicator */}
      <div className="mt-4 text-center">
        {isPlaying ? (
          <div className="inline-flex items-center gap-2 text-sm text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Now Playing
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            Paused
          </div>
        )}
      </div>
    </div>
  );
}