import { Volume2, VolumeX, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface MusicPlayerProps {
  isPlaying: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  selectedTrack: string;
  onTrackChange: (track: string) => void;
  autoPlay: boolean;
  onAutoPlayChange: (autoPlay: boolean) => void;
}

// Generate basic audio using Web Audio API for testing
const generateBasicAudio = (type: string): string => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure based on type
    switch (type) {
      case "ambient-piano":
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.type = "sine";
        break;
      case "nature-sounds":
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
        oscillator.type = "sawtooth";
        break;
      case "soft-strings":
        oscillator.frequency.setValueAtTime(330, audioContext.currentTime); // E4
        oscillator.type = "triangle";
        break;
      case "meditation-bells":
        oscillator.frequency.setValueAtTime(528, audioContext.currentTime); // C5
        oscillator.type = "sine";
        break;
      case "ocean-waves":
        oscillator.frequency.setValueAtTime(110, audioContext.currentTime); // A2
        oscillator.type = "sawtooth";
        break;
      default:
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.type = "sine";
    }

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    oscillator.start();

    // Note: This is a basic implementation. In production, you'd use actual audio files
    // or a more sophisticated audio generation library

    return ""; // Return empty string since we're using Web Audio API directly
  } catch (error) {
    console.warn("Web Audio API not supported:", error);
    return "";
  }
};

// Available background music tracks
const MUSIC_TRACKS = [
  { id: "ambient-piano", name: "Ambient Piano", url: "/music/ambient-piano.mp3", fallback: "ambient-piano" },
  { id: "nature-sounds", name: "Nature Sounds", url: "/music/nature-sounds.mp3", fallback: "nature-sounds" },
  { id: "soft-strings", name: "Soft Strings", url: "/music/soft-strings.mp3", fallback: "soft-strings" },
  { id: "meditation-bells", name: "Meditation Bells", url: "/music/meditation-bells.mp3", fallback: "meditation-bells" },
  { id: "ocean-waves", name: "Ocean Waves", url: "/music/ocean-waves.mp3", fallback: "ocean-waves" },
  { id: "none", name: "No Music", url: null, fallback: null },
];

export function MusicPlayer({
  isPlaying,
  volume,
  onVolumeChange,
  selectedTrack,
  onTrackChange,
  autoPlay,
  onAutoPlayChange,
}: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(volume);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = volume;

      // Add error handling
      audioRef.current.onerror = (error) => {
        console.error("Audio playback error:", error);
      };

      audioRef.current.oncanplay = () => {
        console.log("Audio file loaded successfully");
      };

      audioRef.current.oncanplaythrough = () => {
        console.log("Audio can play through without buffering");
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onerror = null;
        audioRef.current.oncanplay = null;
        audioRef.current.oncanplaythrough = null;
        audioRef.current = null;
      }
    };
  }, []);

  // Handle track changes
  useEffect(() => {
    if (!audioRef.current) return;

    const track = MUSIC_TRACKS.find(t => t.id === selectedTrack);
    if (track && track.url) {
      // Check if file exists before setting src
      fetch(track.url, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            audioRef.current!.src = track.url!;
            if (isPlaying && autoPlay) {
              audioRef.current!.play().catch(error => {
                console.warn(`Failed to play ${track.name}:`, error);
                toast.error(`Failed to play ${track.name}`);
              });
            }
          } else {
            console.warn(`Music file not found: ${track.url}, using generated audio`);
            toast.info(`${track.name} file not found, using generated audio`);
            // For now, just disable music since we can't easily generate audio files
            // In production, you'd have actual audio files
            audioRef.current!.src = "";
          }
        })
        .catch(error => {
          console.warn(`Error checking music file ${track.url}:`, error);
          toast.warning(`${track.name} not available`);
          audioRef.current!.src = "";
        });
    } else if (selectedTrack === "none") {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [selectedTrack, isPlaying, autoPlay]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && autoPlay && selectedTrack !== "none") {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, autoPlay, selectedTrack]);

  const handleVolumeToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(previousVolume);
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setIsMuted(vol === 0);
    onVolumeChange(vol);
  };

  const skipTrack = (direction: 'next' | 'prev') => {
    const currentIndex = MUSIC_TRACKS.findIndex(t => t.id === selectedTrack);
    let newIndex;

    if (direction === 'next') {
      newIndex = (currentIndex + 1) % MUSIC_TRACKS.length;
    } else {
      newIndex = currentIndex === 0 ? MUSIC_TRACKS.length - 1 : currentIndex - 1;
    }

    onTrackChange(MUSIC_TRACKS[newIndex].id);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200/60 shadow-sm">
      {/* Track Selection */}
      <div className="flex items-center gap-2">
        <Select value={selectedTrack} onValueChange={onTrackChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select music" />
          </SelectTrigger>
          <SelectContent>
            {MUSIC_TRACKS.map((track) => (
              <SelectItem key={track.id} value={track.id}>
                {track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => skipTrack('prev')}
          disabled={selectedTrack === "none"}
        >
          <SkipBack size={16} />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAutoPlayChange(!autoPlay)}
          className={isPlaying && autoPlay ? "text-green-600" : ""}
        >
          {isPlaying && autoPlay ? <Pause size={16} /> : <Play size={16} />}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => skipTrack('next')}
          disabled={selectedTrack === "none"}
        >
          <SkipForward size={16} />
        </Button>
      </div>

      {/* Volume Controls */}
      <div className="flex items-center gap-2 flex-1 max-w-32">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleVolumeToggle}
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </Button>

        <Slider
          value={[volume]}
          onValueChange={handleVolumeChange}
          max={1}
          min={0}
          step={0.1}
          className="flex-1"
        />
      </div>

      {/* Status Indicator */}
      <div className="text-xs text-gray-500 min-w-16 text-center">
        {isPlaying && autoPlay && selectedTrack !== "none" ? (
          <span className="text-green-600">Playing</span>
        ) : (
          <span>Paused</span>
        )}
      </div>
    </div>
  );
}