/**
 * Global audio queue manager to ensure sequential playback of TTS audio
 * Prevents multiple audio files from playing simultaneously
 */

interface AudioQueueItem {
  url: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

class AudioQueueManager {
  private queue: AudioQueueItem[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;

  /**
   * Add audio to the queue and start playing if not already playing
   */
  enqueue(audioItem: AudioQueueItem): void {
    this.queue.push(audioItem);

    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Stop current audio and clear the queue
   */
  stopAndClear(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.queue = [];
    this.isPlaying = false;
  }

  /**
   * Check if audio is currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the number of items in the queue
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift()!;

    try {
      // Call onStart callback
      item.onStart?.();

      // Create and play audio
      const audio = new Audio(item.url);
      this.currentAudio = audio;

      audio.onended = () => {
        this.currentAudio = null;
        item.onEnd?.();
        // Add 1 second pause before playing next audio
        setTimeout(() => {
          this.playNext(); // Play next item in queue
        }, 1000);
      };

      audio.onerror = (error) => {
        this.currentAudio = null;
        const audioError = new Error('Audio playback failed');
        item.onError?.(audioError);
        // Add 1 second pause before playing next audio even on error
        setTimeout(() => {
          this.playNext(); // Continue with next item even if this one failed
        }, 1000);
      };

      await audio.play();
    } catch (error) {
      this.currentAudio = null;
      const playError = error instanceof Error ? error : new Error('Unknown audio play error');
      item.onError?.(playError);
      // Add 1 second pause before playing next audio even on error
      setTimeout(() => {
        this.playNext(); // Continue with next item
      }, 1000);
    }
  }
}

// Create a singleton instance
export const audioQueue = new AudioQueueManager();

// Export convenience functions
export const playAudioSequentially = (
  url: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (error: Error) => void
): void => {
  audioQueue.enqueue({ url, onStart, onEnd, onError });
};

export const stopAllAudio = (): void => {
  audioQueue.stopAndClear();
};

export const isAudioPlaying = (): boolean => {
  return audioQueue.isCurrentlyPlaying();
};

export const getAudioQueueLength = (): number => {
  return audioQueue.getQueueLength();
};