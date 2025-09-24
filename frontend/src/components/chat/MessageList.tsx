import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Message } from "@/types/chat";
import type { ConversationPreferences } from "@/stores/chatStore";
import { AlertCircle, BrainCircuit, MessageCircle, RefreshCw, User, Play, Pause, Volume2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MessageFormattingUtils } from "@/lib/messageFormatter";
import textToSpeech from "@/services/elevenlabs/textToSpeech";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean | "idle" | "observer" | "generating" | "streaming";
  onRetryMessage?: (message: Message) => void;
  voiceId?: string;
  preferences?: ConversationPreferences;
}

// Message formatting is now handled by MessageFormatter class
// Keeping this for backward compatibility during transition

// Memoized Message Component for better performance
const MessageBubble = memo(({
  message,
  isUser,
  isConsecutive,
  onRetry,
  voiceId,
  preferences
}: {
  message: Message;
  isUser: boolean;
  isConsecutive: boolean;
  onRetry?: (message: Message) => void;
  voiceId?: string;
  preferences?: ConversationPreferences;
}) => {
  const formatTime = (timestamp?: Date) => {
    if (!timestamp) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  };

  const user = { imageUrl: "", fullName: "User" };

  // For play buttons: show for all AI-generated messages (therapist, impostor, ai)
  const shouldShowPlayButton = message.sender !== "user";

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleRetry = useCallback(() => {
    if (onRetry && message.status === "failed") {
      onRetry(message);
    }
  }, [onRetry, message]);

  const handlePlayAudio = useCallback(async () => {
    if (!message.text || message.text.trim() === "") return;

    try {
      setIsPlaying(true);

      // Determine the correct voiceId based on message sender
      let audioVoiceId = voiceId;
      if (preferences) {
        if (message.sender === "therapist") {
          audioVoiceId = preferences.therapistVoiceId;
        } else if (message.sender === "impostor") {
          audioVoiceId = preferences.impostorVoiceId;
        } else if (message.sender === "ai") {
          audioVoiceId = preferences.mainTTSVoiceId;
        }
      }

      // Get audio URL (will use cache if available)
      const url = await textToSpeech(message.text, audioVoiceId, false);
      setAudioUrl(url);

      // Create and play audio
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setAudioUrl(null);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setAudioUrl(null);
        console.error("Audio playback failed");
      };

      await audio.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsPlaying(false);
      setAudioUrl(null);
    }
  }, [message.text, voiceId]);

  const handleStopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setAudioUrl(null);
  }, []);

  const getStatusIndicator = () => {
    if (!message.status || message.status === "sent") return null;
    
    switch (message.status) {
      case "sending":
        return (
          <div className="flex items-center gap-1 mt-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-xs text-yellow-600">Sending...</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2 mt-1">
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-xs text-red-600">{message.error || "Failed to send"}</span>
            {onRetry && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-xs text-red-600 hover:text-red-700"
                onClick={handleRetry}
              >
                <RefreshCw size={10} className="mr-1" />
                Retry
              </Button>
            )}
          </div>
        );
      case "streaming":
        // For streaming, don't show any status indicator - the live text is the indicator
        return null;
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex items-end gap-2 sm:gap-3 animate-in fade-in duration-300 ${
        isUser ? "justify-end" : "justify-start"
      } ${message.status === "failed" ? "opacity-75" : ""}`}
    >
      {!isUser && (
        <div className="flex flex-col items-center">
          <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <BrainCircuit size={12} className="sm:w-4 sm:h-4" />
            </AvatarFallback>
          </Avatar>
          {message.timestamp && (
            <span className="text-xs text-gray-400 mt-1 hidden sm:block">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      )}

      <div
        className={`max-w-[75%] sm:max-w-[75%] group ${
          isConsecutive ? "mt-1" : "mt-0"
        }`}
      >
        <div
          className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
            isUser
              ? `bg-gradient-to-r from-blue-600 to-purple-600 text-white ${
                  message.status === "failed" ? "from-red-500 to-red-600" : ""
                }`
              : "bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-800"
          }`}
          role="article"
          aria-label={isUser ? "User message" : "AI message"}
        >
          {/* Audio play button */}
           {shouldShowPlayButton && message.text && message.text.trim() && (
            <div className="flex items-center justify-between mb-2">
              <Button
                size="sm"
                variant="ghost"
                 className={`h-6 px-2 text-xs ${
                   isUser
                     ? "text-blue-200 hover:text-blue-100 hover:bg-white/10"
                     : "text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                 }`}
                onClick={isPlaying ? handleStopAudio : handlePlayAudio}
                disabled={!message.text || message.text.trim() === ""}
              >
                {isPlaying ? (
                  <>
                    <Pause size={12} className="mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play size={12} className="mr-1" />
                    Play
                  </>
                )}
              </Button>
              {isPlaying && (
                <div className="flex items-center gap-1">
                   <Volume2 size={10} className={isUser ? "text-blue-200" : "text-gray-500"} />
                  <div className="w-8 h-1 bg-current opacity-30 rounded">
                    <div className="w-full h-full bg-current animate-pulse rounded"></div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            className={`prose prose-xs sm:prose-sm max-w-none ${
              isUser ? "prose-invert" : ""
            } [&_p]:mb-1 sm:[&_p]:mb-2 [&_p:last-child]:mb-0`}
          >
            {message.status === "streaming" && !message.text ? (
              // Show loading dots for empty streaming messages
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full animate-bounce opacity-60" />
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full animate-bounce delay-100 opacity-60" />
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full animate-bounce delay-200 opacity-60" />
              </div>
            ) : (
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                     <a
                       href={href}
                       className={`${
                         isUser
                           ? "text-blue-200 hover:text-blue-100"
                           : "text-blue-600 hover:text-blue-700"
                       } underline transition-colors`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children, className }) => (
                     <code
                       className={`${
                         isUser
                           ? "bg-white/20 text-blue-100"
                           : "bg-gray-100 text-gray-800"
                       } px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded text-xs sm:text-sm font-mono`}
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                     <pre
                       className={`${
                         isUser
                           ? "bg-white/20 border-white/30"
                           : "bg-gray-100 border-gray-200"
                       } border rounded-lg p-2 sm:p-3 overflow-x-auto text-xs sm:text-sm`}
                    >
                      {children}
                    </pre>
                  ),
                  // Custom bullet point rendering
                  ul: ({ children }) => (
                    <ul className="space-y-1 my-2">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2 my-1">
                       <span
                         className={`inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                           isUser ? 'bg-blue-200' : 'bg-blue-500'
                         }`}
                       />
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  // Custom numbered list rendering
                  ol: ({ children }) => (
                    <ol className="space-y-1 my-2">
                      {children}
                    </ol>
                  ),
                }}
              >
                {message.text}
              </ReactMarkdown>
            )}
          </div>
        </div>
        {getStatusIndicator()}
      </div>

      {isUser && (
        <div className="flex flex-col items-center">
          <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
            <AvatarImage
              src={user?.imageUrl || ""}
              alt={user?.fullName || "User"}
            />
            <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white">
              {user?.fullName?.charAt(0) || (
                <User size={12} className="sm:w-4 sm:h-4" />
              )}
            </AvatarFallback>
          </Avatar>
          {message.timestamp && (
            <span className="text-xs text-gray-400 mt-1 hidden sm:block">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  onRetryMessage,
  voiceId,
  preferences
}: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef<number>(messages.length);
  const lastMessageTextRef = useRef<string>("");
  const [stabilizedMessages, setStabilizedMessages] = useState<Message[]>([]);

  // Stabilize messages for rendering during streaming
  useEffect(() => {
    const timer = setTimeout(() => {
      setStabilizedMessages(
        messages.map((msg) => ({
          ...msg,
          text: MessageFormattingUtils.normalizeMessage(msg.text || ""),
        }))
      );
    }, 50);

    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Scroll to bottom on messages change
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [stabilizedMessages.length]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const isAtBottom =
      scrollContainerRef.current.scrollHeight -
        scrollContainerRef.current.scrollTop <=
      scrollContainerRef.current.clientHeight + 50;

    const lastMessage = stabilizedMessages[stabilizedMessages.length - 1];
    const isStreamingUpdate =
      isLoading &&
      lastMessage?.sender === "ai" &&
      lastMessage.text !== lastMessageTextRef.current;

    if (
      (isAtBottom &&
        (stabilizedMessages.length > lastMessageCountRef.current ||
          isStreamingUpdate)) ||
      isLoading
    ) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    lastMessageCountRef.current = stabilizedMessages.length;
    lastMessageTextRef.current = lastMessage?.text || "";
  }, [stabilizedMessages, isLoading]);

  const getMessageKey = (message: Message, index: number) => {
    return (
      message.tempId ||
      message.id ||
      `${message.sender}-${message.timestamp?.getTime() || index}`
    );
  };

  // Smooth loading indicator with fixed height to prevent layout shifts
  const SmoothLoadingIndicator = ({ 
    currentState, 
    hasStreamingMessage 
  }: { 
    currentState: string;
    hasStreamingMessage: boolean;
  }) => {
    // Always render the container to maintain consistent spacing, but hide content when not needed
    const showContent = !hasStreamingMessage && currentState && currentState !== "idle";
    
    const getLoadingContent = () => {
      switch (currentState) {
        case "observer":
          return "Thinking";
        case "generating":
          return "Generating";
        default:
          return null;
      }
    };
    
    const loadingText = getLoadingContent();
    
    return (
      <div 
        className="animate-in fade-in duration-300"
        style={{ 
          minHeight: showContent ? "60px" : "0px", // Maintain height when showing, collapse when not
          transition: "min-height 0.2s cubic-bezier(0.4, 0, 0.2, 1)", // Smooth height transition
          overflow: "hidden" // Prevent content from showing during collapse
        }}
      >
        {showContent && loadingText && (
          <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="relative">
              <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <BrainCircuit size={12} className="sm:w-4 sm:h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-pulse border-2 border-white" />
            </div>
            <div className="flex items-center"> {/* Changed from flex-1 to just flex items-center for content-width */}
              <div 
                className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm inline-block"
                style={{ 
                  transition: "all 0.2s ease-in-out"
                }}
              >
                <div className="flex items-center gap-2 whitespace-nowrap"> {/* Added whitespace-nowrap to prevent wrapping */}
                  <span 
                    className="text-xs sm:text-sm font-medium text-gray-700"
                    style={{ 
                      transition: "opacity 0.2s ease-in-out"
                    }}
                    key={loadingText} // Key ensures smooth text transition
                  >
                    {loadingText}
                  </span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce delay-100" />
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="space-y-3 sm:space-y-6 px-3 sm:px-6 md:px-3 sm:pb-24 md:pt-44 pt-52"
      role="log"
      aria-live="polite"
      ref={scrollContainerRef}
    >
      {stabilizedMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-3 sm:mb-4">
            <MessageCircle size={20} className="text-gray-400 sm:w-6 sm:h-6" />
          </div>
          <p className="text-gray-500 text-xs sm:text-sm">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        stabilizedMessages.map((message, index) => {
          if (!message.sender) {
            console.warn("Malformed message at index", index, message);
            return (
              <div
                key={getMessageKey(message, index)}
                className="flex justify-center"
              >
                <Badge variant="destructive" className="text-xs">
                  Error: Malformed message
                </Badge>
              </div>
            );
          }

          // Don't show empty AI messages with dots - let the status indicator handle it
          if (message.sender === "ai" && !message.text && message.status !== "streaming") {
            return null; // Skip rendering empty AI messages
          }

          if (!message.text && message.status !== "streaming") {
            return (
              <div
                key={getMessageKey(message, index)}
                className="flex justify-center"
              >
                <Badge variant="destructive" className="text-xs">
                  Error: Malformed message
                </Badge>
              </div>
            );
          }

          // For positioning: user and impostor messages appear on the right
  const isUser = message.sender === "user" || message.sender === "impostor";
  // For play buttons: show for AI messages only when TTS is enabled
  const shouldShowPlayButton = message.sender !== "user" && preferences?.mainEnableTTS;
          const isConsecutive =
            index > 0 &&
            stabilizedMessages[index - 1]?.sender === message.sender;

          return (
            <MessageBubble
              key={getMessageKey(message, index)}
              message={message}
              isUser={isUser}
              isConsecutive={isConsecutive}
              onRetry={onRetryMessage}
              voiceId={voiceId}
              preferences={preferences}
            />
          );
        })
      )}

      {/* Smooth loading indicator with fixed height to prevent layout shifts */}
      <SmoothLoadingIndicator 
        currentState={typeof isLoading === "string" ? isLoading : "idle"}
        hasStreamingMessage={stabilizedMessages.some(msg => msg.status === "streaming")}
      />

      <div ref={endOfMessagesRef} aria-hidden="true" />
    </div>
  );
});

