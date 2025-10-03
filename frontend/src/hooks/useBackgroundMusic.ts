import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chatStore";

export function useBackgroundMusic(pageContext: "main" | "impersonate" | "podcast") {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { conversationPreferences } = useChatStore();
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  // Get the appropriate auto-play setting for the current page
  const shouldAutoPlay = (() => {
    switch (pageContext) {
      case "main":
        return conversationPreferences.autoPlayMusicOnMain ?? false;
      case "impersonate":
        return conversationPreferences.autoPlayMusicOnImpersonate ?? true;
      case "podcast":
        return conversationPreferences.autoPlayMusicOnPodcast ?? true;
      default:
        return false;
    }
  })();

  const selectedTrack = conversationPreferences.podcastMusicTrack ?? "ambient-piano";
  const volume = conversationPreferences.podcastMusicVolume ?? 0.3;

  // Detect user interaction to enable audio playback
  useEffect(() => {
    const handleUserInteraction = () => {
      setHasUserInteracted(true);
    };

    // Listen for various user interactions
    const events = ['click', 'keydown', 'touchstart', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, []);

  // Create audio element when settings change (excluding volume)
  useEffect(() => {
    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Create audio element if enabled and track is selected
    if (shouldAutoPlay && selectedTrack !== "none") {
      const audio = new Audio();
      audio.src = `/music/${selectedTrack}.mp3`;
      audio.volume = volume;
      audio.loop = true;
      
      // Store reference
      audioRef.current = audio;
    }
  }, [shouldAutoPlay, selectedTrack, pageContext]);

  // Update volume when it changes (without recreating audio element)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Play audio when user interaction is detected OR try immediately for podcast page
  useEffect(() => {
    if (audioRef.current && shouldAutoPlay && selectedTrack !== "none") {
      const shouldAttemptPlay = hasUserInteracted || pageContext === "podcast";
      
      if (shouldAttemptPlay) {
        audioRef.current.play().catch((error) => {
          // If it fails due to no user interaction, we'll try again when user interacts
        });
      }
    }
  }, [hasUserInteracted, shouldAutoPlay, selectedTrack, pageContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [pageContext]);

  // Function to manually stop music
  const stopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // Function to update volume
  const updateVolume = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return {
    stopMusic,
    updateVolume,
    isPlaying: audioRef.current !== null && !audioRef.current.paused,
  };
}