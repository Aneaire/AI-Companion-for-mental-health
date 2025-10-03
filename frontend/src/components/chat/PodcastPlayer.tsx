import type { Message } from "@/types/chat";
import type { ConversationPreferences } from "@/stores/chatStore";
import { TextDisplay } from "./TextDisplay";
import { PodcastControls } from "./PodcastControls";
import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { isAudioPlaying } from "@/lib/audioQueue";

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
  const [isAudioCurrentlyPlaying, setIsAudioCurrentlyPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordHighlightIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio element with enhanced error handling
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = preferences.podcastMusicVolume ?? 0.3;

      audioRef.current.onerror = (error) => {
        console.error("Background music playback error:", error);
        toast.error("Background music failed to load. Please check your connection.");
      };

      audioRef.current.oncanplay = () => {
        console.log("Background music loaded successfully");
      };

      audioRef.current.onstalled = () => {
        console.warn("Background music stalled, attempting to recover...");
      };

      audioRef.current.onwaiting = () => {
        console.log("Background music buffering...");
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onerror = null;
        audioRef.current.oncanplay = null;
        audioRef.current.onstalled = null;
        audioRef.current.onwaiting = null;
        audioRef.current = null;
      }
    };
  }, []);

  // Handle track changes with improved error handling
  useEffect(() => {
    if (!audioRef.current) return;

    const track = preferences.podcastMusicTrack ?? "ambient-piano";
    if (track && track !== "none") {
      const url = `/music/${track}.mp3`;
      
      // Set up audio element with proper error handling
      audioRef.current.src = url;
      audioRef.current.load(); // Preload the audio
      
      const handleCanPlay = () => {
        console.log(`Music track loaded successfully: ${track}`);
        if (isPlaying && (preferences.podcastMusicAutoPlay ?? true)) {
          audioRef.current!.play().catch(error => {
            console.warn(`Failed to play ${track}:`, error);
            // Don't show toast for autoplay failures (common in browsers)
          });
        }
      };

      const handleError = () => {
        console.warn(`Music file failed to load: ${url}`);
        toast.info(`Music track "${track}" unavailable, trying fallback...`);
        
        // Try fallback to ambient-piano
        if (track !== "ambient-piano") {
          const fallbackUrl = "/music/ambient-piano.mp3";
          audioRef.current!.src = fallbackUrl;
          audioRef.current!.load();
        } else {
          audioRef.current!.src = "";
        }
      };

      audioRef.current.addEventListener('canplay', handleCanPlay);
      audioRef.current.addEventListener('error', handleError);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('canplay', handleCanPlay);
          audioRef.current.removeEventListener('error', handleError);
        }
      };
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

  // Monitor audio playback state for better synchronization
  useEffect(() => {
    const checkAudioState = () => {
      const audioPlaying = isAudioPlaying();
      setIsAudioCurrentlyPlaying(audioPlaying);
    };

    // Check audio state periodically
    const interval = setInterval(checkAudioState, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Enhanced word highlighting with audio-aware timing
  const startWordHighlighting = useCallback((messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message?.text) return;

    const words = message.text.split(/\s+/);
    if (words.length === 0) return;

    // Clear any existing interval
    if (wordHighlightIntervalRef.current) {
      clearInterval(wordHighlightIntervalRef.current);
    }

    setCurrentWordIndex(0);
    
    // Calculate timing based on actual audio playback
    const averageWordsPerMinute = 150;
    const wordsPerSecond = averageWordsPerMinute / 60;
    const wordInterval = Math.max(200, (1000 / wordsPerSecond));

    wordHighlightIntervalRef.current = setInterval(() => {
      setCurrentWordIndex((prev) => {
        if (prev >= words.length - 1) {
          // Clear interval when word highlighting is complete
          if (wordHighlightIntervalRef.current) {
            clearInterval(wordHighlightIntervalRef.current);
            wordHighlightIntervalRef.current = null;
          }
          
          // Move to next message after a brief pause
          setTimeout(() => {
            if (messageIndex < messages.length - 1) {
              setCurrentMessageIndex(messageIndex + 1);
              setCurrentWordIndex(0);
              // Start highlighting for next message
              startWordHighlighting(messageIndex + 1);
            } else {
              // End of messages
              onStopImpersonation();
            }
          }, 1000);
          return prev;
        }
        return prev + 1;
      });
    }, wordInterval);
  }, [messages, onStopImpersonation]);

  // Start/stop word highlighting based on playback state with fallback
  useEffect(() => {
    if (isPlaying && isImpersonating) {
      // Use audio-aware timing if audio is playing, otherwise use fallback timing
      if (isAudioCurrentlyPlaying) {
        startWordHighlighting(currentMessageIndex);
      } else {
        // Fallback: start highlighting even without audio for better UX
        console.log("Audio not detected, using fallback word highlighting");
        startWordHighlighting(currentMessageIndex);
      }
    } else {
      // Stop highlighting when not playing
      if (wordHighlightIntervalRef.current) {
        clearInterval(wordHighlightIntervalRef.current);
        wordHighlightIntervalRef.current = null;
      }
      setCurrentWordIndex(0);
    }

    return () => {
      if (wordHighlightIntervalRef.current) {
        clearInterval(wordHighlightIntervalRef.current);
        wordHighlightIntervalRef.current = null;
      }
    };
  }, [isPlaying, isImpersonating, isAudioCurrentlyPlaying, currentMessageIndex, startWordHighlighting]);









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