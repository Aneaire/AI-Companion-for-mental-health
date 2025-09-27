/**
 * Audio Cache Utility
 * Manages server-side storage and retrieval of TTS audio files
 */

interface AudioCacheEntry {
  url: string;
  timestamp: number;
  text: string;
  voiceId: string;
  modelId: string;
  filename: string;
}

class AudioCache {
  private cache = new Map<string, AudioCacheEntry>();
  private readonly CACHE_KEY = 'audio_cache';
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of cached audio files
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor() {
    this.loadFromLocalStorage();
    this.setupCleanupInterval();
  }

   /**
    * Generate a unique cache key for a text + voice + model combination
    */
    private generateCacheKey(text: string, voiceId: string, modelId: string = "eleven_flash_v2_5"): string {
      // Generate text hash using same method as server
      const textInput = text.trim().toLowerCase();
      let textHash = 0;
      for (let i = 0; i < textInput.length; i++) {
        const char = textInput.charCodeAt(i);
        textHash = ((textHash << 5) - textHash) + char;
        textHash = textHash & textHash; // Convert to 32-bit integer
      }
      const textHashStr = Math.abs(textHash).toString(36).substring(0, 16);

      // Create cache key in same format as server filename
      return `${textHashStr}_${voiceId}_${modelId}`;
    }

  /**
   * Generate text hash for server-side filename
   */
  private generateTextHash(text: string): string {
    // Use a simple hash function for filename generation
    const input = text.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }

  /**
   * Check if audio exists in cache
   */
  hasAudio(text: string, voiceId: string, modelId: string = "eleven_flash_v2_5"): boolean {
    const key = this.generateCacheKey(text, voiceId, modelId);
    const entry = this.cache.get(key);

    if (!entry) return false;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(key);
      this.saveToLocalStorage();
      return false;
    }

    return true;
  }

  /**
   * Get cached audio URL
   */
  getAudio(text: string, voiceId: string, modelId: string = "eleven_flash_v2_5"): string | null {
    const key = this.generateCacheKey(text, voiceId, modelId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(key);
      this.saveToLocalStorage();
      return null;
    }

    return entry.url;
  }

  /**
   * Manually cache a server URL without saving to server
   */
  cacheServerUrl(text: string, voiceId: string, serverUrl: string, filename: string, modelId: string = "eleven_flash_v2_5"): void {
    const key = this.generateCacheKey(text, voiceId, modelId);
    const entry: AudioCacheEntry = {
      url: serverUrl,
      timestamp: Date.now(),
      text: text.trim(),
      voiceId,
      modelId,
      filename,
    };

    this.cache.set(key, entry);

    // Clean up old entries if cache is too large
    this.cleanup();

    // Save to localStorage
    this.saveToLocalStorage();
  }

  /**
   * Store audio in server-side cache
   */
  async storeAudio(text: string, voiceId: string, audioBlob: Blob, modelId: string = "eleven_flash_v2_5"): Promise<string> {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Save to server
      const response = await fetch('/api/audio/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId,
          modelId,
          audioBlob: base64Audio,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save audio to server');
      }

      const result = await response.json();
      const serverUrl = result.url;

      // Cache locally
      const key = this.generateCacheKey(text, voiceId, modelId);
      const entry: AudioCacheEntry = {
        url: serverUrl,
        timestamp: Date.now(),
        text: text.trim(),
        voiceId,
        modelId,
        filename: result.filename,
      };

      this.cache.set(key, entry);

      // Clean up old entries if cache is too large
      this.cleanup();

      // Save to localStorage
      this.saveToLocalStorage();

      return serverUrl;
    } catch (error) {
      console.error('Failed to store audio:', error);
      // Fallback to browser storage if server save fails
      return URL.createObjectURL(audioBlob);
    }
  }

  /**
   * Remove expired entries and maintain cache size limit
   */
  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => {
        this.cache.delete(key);
      });
    }
  }

  /**
   * Save cache metadata to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        text: entry.text,
        voiceId: entry.voiceId,
        modelId: entry.modelId,
        timestamp: entry.timestamp,
        filename: entry.filename,
        url: entry.url,
      }));

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save audio cache to localStorage:', error);
    }
  }

  /**
   * Load cache metadata from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const cacheData = localStorage.getItem(this.CACHE_KEY);
      if (!cacheData) return;

      const parsed = JSON.parse(cacheData);
      let hasOldEntries = false;

      // Check for old cache entries with base64-encoded filenames
      for (const item of parsed) {
        if (item.filename && (item.filename.includes('_') && item.filename.includes('.'))) {
          const filenameParts = item.filename.split('_');
          if (filenameParts.length >= 2) {
            const textHash = filenameParts[0];
            // Old base64 hashes contain +, /, = characters or are not exactly 16 chars
            if (/[+/=]/.test(textHash) || textHash.length !== 16) {
              hasOldEntries = true;
              break;
            }
          }
        }
      }

      // If we detected old entries, clear the entire cache to prevent conflicts
      if (hasOldEntries) {
        console.log('Detected old cache format (base64 filenames), clearing cache to prevent conflicts');
        this.clear();
        return;
      }

      // Load valid entries
      parsed.forEach((item: any) => {
        this.cache.set(item.key, {
          url: item.url,
          timestamp: item.timestamp,
          text: item.text,
          voiceId: item.voiceId,
          modelId: item.modelId || "eleven_flash_v2_5", // Default for backward compatibility
          filename: item.filename,
        });
      });

      console.log(`Loaded ${parsed.length} audio cache entries from localStorage`);
    } catch (error) {
      console.warn('Failed to load audio cache from localStorage:', error);
    }
  }

  /**
   * Set up periodic cleanup
   */
  private setupCleanupInterval(): void {
    // Clean up every hour
    setInterval(() => {
      this.cleanup();
      this.saveToLocalStorage();
    }, 60 * 60 * 1000);
  }

  /**
   * Clear all cached audio
   */
  clear(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number } {
    return {
      size: this.cache.size,
    };
  }
}

// Export singleton instance
export const audioCache = new AudioCache();
export default audioCache;