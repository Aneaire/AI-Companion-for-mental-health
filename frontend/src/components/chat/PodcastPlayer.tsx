import type { Message } from "@/types/chat";
import type { ConversationPreferences } from "@/stores/chatStore";
import { TextDisplay } from "./TextDisplay";
import { PodcastControls } from "./PodcastControls";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

interface PodcastPlayerProps {
  messages: Message[];
  isPlaying: boolean;
  isImpersonating: boolean;
  preferences: ConversationPreferences;
  onStartImpersonation: (startFromMessageIndex?: number) => void;
  onStopImpersonation: () => void;
  onSkipToMessage: (index: number) => void;
  onSettingsClick: () => void;
  onPreferencesChange: (preferences: ConversationPreferences) => void;
}

export function PodcastPlayer({
  messages,
  isPlaying,
  isImpersonating,
  preferences,
  onStartImpersonation,
  onStopImpersonation,
  onSkipToMessage,
  onSettingsClick,
  onPreferencesChange,
}: PodcastPlayerProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userSelectedMessage, setUserSelectedMessage] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = preferences.podcastMusicVolume ?? 0.3;

      audioRef.current.onerror = (error) => {
        console.error("Audio playback error:", error);
      };

      audioRef.current.oncanplay = () => {
        console.log("Audio file loaded successfully");
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onerror = null;
        audioRef.current.oncanplay = null;
        audioRef.current = null;
      }
    };
  }, []);

  // Handle track changes
  useEffect(() => {
    if (!audioRef.current) return;

    const track = preferences.podcastMusicTrack ?? "ambient-piano";
    if (track && track !== "none") {
      const url = `/music/${track}.mp3`;
      // Check if file exists before setting src
      fetch(url, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            audioRef.current!.src = url;
            if (isPlaying && (preferences.podcastMusicAutoPlay ?? true)) {
              audioRef.current!.play().catch(error => {
                console.warn(`Failed to play ${track}:`, error);
                toast.error(`Failed to play ${track}`);
              });
            }
          } else {
            console.warn(`Music file not found: ${url}`);
            toast.info(`${track} file not found, music disabled`);
            audioRef.current!.src = "";
          }
        })
        .catch(error => {
          console.warn(`Error checking music file ${url}:`, error);
          toast.warning(`${track} not available`);
          audioRef.current!.src = "";
        });
    } else {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [preferences.podcastMusicTrack, isPlaying, preferences.podcastMusicAutoPlay]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = preferences.podcastMusicVolume ?? 0.3;
    }
  }, [preferences.podcastMusicVolume]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && (preferences.podcastMusicAutoPlay ?? true) && (preferences.podcastMusicTrack ?? "ambient-piano") !== "none") {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, preferences.podcastMusicAutoPlay, preferences.podcastMusicTrack]);

  // Reset to last message when messages change (unless user has manually selected)
  useEffect(() => {
    if (messages.length > 0 && !userSelectedMessage) {
      setCurrentMessageIndex(messages.length - 1);
      setCurrentWordIndex(0);
    }
  }, [messages.length, userSelectedMessage]);

  // Simulate word highlighting during playback (this would be synced with actual TTS)
  useEffect(() => {
    if (!isPlaying || !isImpersonating) {
      setCurrentWordIndex(0);
      return;
    }

    const currentMessage = messages[currentMessageIndex];
    if (!currentMessage?.text) return;

    const words = currentMessage.text.split(/\s+/);
    if (words.length === 0) return;

    // Simulate reading speed (this would be replaced with actual TTS timing)
    const wordInterval = Math.max(300, (currentMessage.text.length / words.length) * 50);

    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => {
        if (prev >= words.length - 1) {
          // Move to next message
          if (currentMessageIndex < messages.length - 1) {
            setCurrentMessageIndex(currentMessageIndex + 1);
            return 0;
          } else {
            // End of messages
            onStopImpersonation();
            return prev;
          }
        }
        return prev + 1;
      });
    }, wordInterval);

    return () => clearInterval(interval);
  }, [isPlaying, isImpersonating, currentMessageIndex, messages, onStopImpersonation]);









  const handlePlayPause = () => {
    // For now, this toggles impersonation. In a full implementation,
    // this would pause/resume the current audio playback
    if (isImpersonating) {
      onStopImpersonation();
    } else {
      // If user has manually selected a message, start from that message
      // Otherwise, start from the last message (which will generate new content)
      if (userSelectedMessage) {
        onStartImpersonation(currentMessageIndex);
      } else {
        onStartImpersonation();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Main Text Display Area */}
      <div className="flex-1 overflow-hidden">
        <TextDisplay
          messages={messages}
          currentMessageIndex={currentMessageIndex}
          currentWordIndex={currentWordIndex}
          textSize={preferences.podcastTextSize}
          highlightStyle={preferences.podcastHighlightStyle}
          autoScroll={preferences.podcastAutoScroll}
          isPlaying={isPlaying}
        />
      </div>

            {/* Podcast Controls Footer */}
            <PodcastControls
              isPlaying={isPlaying}
              isImpersonating={isImpersonating}
              currentMessageIndex={currentMessageIndex}
              totalMessages={messages.length}
              onPlayPause={handlePlayPause}
              onStartImpersonation={onStartImpersonation}
              onStopImpersonation={onStopImpersonation}
              onSkipToMessage={(index) => {
                setCurrentMessageIndex(index);
                setCurrentWordIndex(0);
                setUserSelectedMessage(true); // Mark that user manually selected a message
                onSkipToMessage(index);
              }}
              onSettingsClick={onSettingsClick}
              messages={messages}
              isPodcastMode={true}
            />
    </div>
  );
}