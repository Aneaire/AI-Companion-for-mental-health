/**
 * MessageFormatter - Handles formatting and processing of streaming messages
 * Provides clean separation between streaming logic and message formatting
 */

export interface StreamingChunk {
  data: string;
  isComplete: boolean;
}

export interface FormattedMessage {
  text: string;
  isComplete: boolean;
  needsUpdate: boolean;
}

export class MessageFormatter {
  private buffer: string = '';
  private currentText: string = '';
  private isComplete: boolean = false;

  /**
   * Process a streaming chunk and return formatted message state
   */
  processChunk(chunk: StreamingChunk): FormattedMessage {
    if (chunk.isComplete) {
      this.isComplete = true;
      this.buffer += chunk.data;
      this.currentText = this.formatText(this.buffer);
      return {
        text: this.currentText,
        isComplete: true,
        needsUpdate: true
      };
    }

    // Accumulate chunk data
    this.buffer += chunk.data;

    // Only format if we have meaningful content to avoid redundant processing
    const newFormattedText = this.formatText(this.buffer);
    const needsUpdate = newFormattedText !== this.currentText;

    if (needsUpdate) {
      this.currentText = newFormattedText;
    }

    return {
      text: this.currentText,
      isComplete: false,
      needsUpdate
    };
  }

  /**
   * Format text with markdown processing and cleanup
   */
  private formatText(text: string): string {
    if (!text.trim()) return text;

    let formatted = text;

    // Handle incomplete code blocks
    const codeBlockMatches = (formatted.match(/```/g) || []).length;
    if (codeBlockMatches % 2 !== 0) {
      formatted += "\n```";
    }

    // Handle incomplete lists
    const lines = formatted.split("\n");
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine.match(/^\s*[-+*]\s+\S+.*$/) && !lastLine.endsWith("\n")) {
        formatted += "\n";
      }
    }

    // Remove 4-space indents for non-code content
    let inCodeBlock = false;
    const processedLines: string[] = [];
    for (const line of formatted.split("\n")) {
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        processedLines.push(line);
      } else if (!inCodeBlock && line.startsWith("    ")) {
        processedLines.push(line.substring(4));
      } else {
        processedLines.push(line);
      }
    }
    formatted = processedLines.join("\n");

    return formatted;
  }

  /**
   * Finalize the message with proper cleanup
   */
  finalize(): string {
    if (!this.isComplete) {
      this.isComplete = true;
    }

    let finalText = this.currentText;

    // Clean up leading/trailing whitespace
    finalText = finalText.trim();

    // Normalize multiple newlines to double newlines for paragraphs
    finalText = finalText.replace(/\n{3,}/g, "\n\n");

    // Ensure the message ends with a newline for markdown rendering
    if (!finalText.endsWith("\n")) {
      finalText += "\n";
    }

    return finalText;
  }

  /**
   * Reset the formatter for a new message
   */
  reset(): void {
    this.buffer = '';
    this.currentText = '';
    this.isComplete = false;
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      buffer: this.buffer,
      currentText: this.currentText,
      isComplete: this.isComplete,
      bufferLength: this.buffer.length
    };
  }
}

/**
 * StreamingMessageProcessor - Handles the streaming logic with proper error handling
 */
export class StreamingMessageProcessor {
  private formatter: MessageFormatter;
  private onUpdate: (text: string, isComplete: boolean) => void;
  private onError: (error: Error) => void;
  private onComplete: (finalText: string) => void;
  private onPersonaSelected?: (personaData: any) => void;

  constructor(
    onUpdate: (text: string, isComplete: boolean) => void,
    onError: (error: Error) => void,
    onComplete: (finalText: string) => void,
    onPersonaSelected?: (personaData: any) => void
  ) {
    this.formatter = new MessageFormatter();
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.onComplete = onComplete;
    this.onPersonaSelected = onPersonaSelected;
  }

  /**
   * Process a raw streaming response
   */
  async processStream(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No reader available for streaming response");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let isAborted = false;
    let retryCount = 0;
    const maxRetries = 3;

    // Set up abort controller for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      isAborted = true;
    }, 30000); // 30 second timeout

    try {
      while (!isAborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete last line

        for (const line of lines) {
          try {
            await this.processLine(line);
          } catch (lineError) {
            console.warn("Error processing line, continuing:", lineError);
            // Continue processing other lines
          }
        }
      }

      // Process any remaining buffer content
      if (buffer && !isAborted) {
        try {
          await this.processLine(buffer);
        } catch (bufferError) {
          console.warn("Error processing remaining buffer:", bufferError);
        }
      }

      // Finalize the message only if not aborted
      if (!isAborted) {
        const finalText = this.formatter.finalize();
        this.onComplete(finalText);
      }

    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error && error.name === 'AbortError') {
        this.onError(new Error("Request timed out. Please try again."));
      } else if (error instanceof Error && error.message.includes('network')) {
        // Network error - could retry
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`Network error, retrying (${retryCount}/${maxRetries})`);
          // In a real implementation, you might want to retry the request
          this.onError(new Error("Network connection lost. Please check your connection and try again."));
        } else {
          this.onError(new Error("Network connection failed after multiple attempts."));
        }
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        this.onError(err);
      }
    } finally {
      clearTimeout(timeoutId);
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.warn("Error releasing reader lock:", releaseError);
      }
    }
  }

  /**
   * Process a single line from the stream
   */
  private async processLine(line: string): Promise<void> {
    try {
      // Handle event lines
      if (line.startsWith("event: ")) {
        this.currentEvent = line.substring("event: ".length).trim();
        return;
      }

      // Handle data lines
      if (line.startsWith("data: ")) {
        const content = line.substring("data: ".length);

        // Handle persona selection events
        if (this.currentEvent === "persona_selected") {
          try {
            const personaData = JSON.parse(content);
            console.log("Persona selected:", personaData);
            // Call the persona callback if provided
            if (this.onPersonaSelected) {
              this.onPersonaSelected(personaData);
            }
          } catch (e) {
            console.error("Failed to parse persona selection:", e);
          }
          this.currentEvent = null;
          return;
        }



        // Handle crisis events
        if (this.currentEvent === "crisis") {
          this.onUpdate(content, true);
          this.currentEvent = null;
          return;
        }

        // Skip session_id events and empty content
        if (
          content.trim() === "" ||
          (!isNaN(Number(content.trim())) && content.trim().length < 10)
        ) {
          this.currentEvent = null;
          return;
        }

        const chunk: StreamingChunk = {
          data: content + "\n", // Add newline as messages are line-separated
          isComplete: false
        };

        const result = this.formatter.processChunk(chunk);

        if (result.needsUpdate) {
          this.onUpdate(result.text, result.isComplete);
        }
        this.currentEvent = null;
      }
    } catch (error) {
      console.warn("Error processing stream line:", error);
      // Continue processing other lines
    }
  }

  // Add currentEvent property to track SSE events
  private currentEvent: string | null = null;

  /**
   * Reset for a new message stream
   */
  reset(): void {
    this.formatter.reset();
  }

  /**
   * Get formatter state for debugging
   */
  getDebugState() {
    return this.formatter.getState();
  }
}

/**
 * Rule-based persona selection logic
 */
export const selectPersonaBasedOnRules = (
  messages: any[],
  currentMessage: string
): { persona: string; rationale: string } => {
  const allText = messages
    .map(msg => msg.text)
    .concat(currentMessage)
    .join(' ')
    .toLowerCase();
  
  // Crisis detection - highest priority (English + Filipino)
  const crisisKeywords = [
    'suicide', 'kill myself', 'want to die', 'end my life', 
    'hurt myself', 'self harm', 'can\'t go on', 'no reason to live',
    'better off dead', 'want to disappear',
    // Filipino crisis keywords
    'pakamatay', 'matatapos na buhay ko', 'gusto kong mamatay', 'kailangan kong mamatay',
    'sakit sa sarili', 'self harm tagalog', 'wala nang pag-asa', 'ayaw ko na mabuhay',
    'mas maganda kong patay', 'gusto kong mawala'
  ];
  
  if (crisisKeywords.some(keyword => allText.includes(keyword))) {
    return {
      persona: 'crisis_support',
      rationale: 'crisis'
    };
  }
  
  // Advice seeking (English + Filipino)
  const adviceKeywords = [
    'what should i do', 'advice', 'recommendation', 'help me decide',
    'what do you think', 'suggestion', 'guidance', 'opinion',
    // Filipino advice keywords
    'ano gagawin ko', 'payo', 'sugestion', 'tulong mo ako', 'ano ang dapat kong gawin',
    'ano sa tingin mo', 'paano mo ako matutulungan', 'kailangan ko ng payo',
    'ano ang iyong opinyon', 'gabay', 'pananaw'
  ];
  
  if (adviceKeywords.some(keyword => allText.includes(keyword))) {
    return {
      persona: 'wise_guide',
      rationale: 'advice'
    };
  }
  
  // Companion/conversation seeking (English + Filipino)
  const companionKeywords = [
    'chat', 'talk', 'conversation', 'discuss', 'tell me about',
    'what do you think about', 'let\'s talk', 'just want to chat',
    // Filipino companion keywords
    'kwentuhan', 'usap tayo', 'magtsismisan', 'pag-usapan', 'kwento',
    'ano ang balita', 'magkaibigan', 'kaibigan', 'talk tagalog', 'usap',
    'chikahan', 'tsismisan', 'maglaro', 'libang'
  ];
  
  if (companionKeywords.some(keyword => allText.includes(keyword))) {
    return {
      persona: 'friendly_companion',
      rationale: 'companion'
    };
  }
  
  // Emotional support (English + Filipino)
  const emotionalKeywords = [
    'sad', 'depressed', 'anxious', 'worried', 'stressed', 'overwhelmed',
    'feeling down', 'upset', 'hurt', 'confused', 'lonely',
    // Filipino emotional keywords
    'malungkot', 'lungkot', 'sad tagalog', 'depressed tagalog',
    'nababahala', 'aalala', 'stressed tagalog', 'pagod na pagod',
    'overwhelmed tagalog', 'hindi masaya', 'lungkot', 'sakit ng puso',
    'nalulungkot', 'problema', 'bigat ng dibdib', 'hirap', 'pag-asa',
    'naiiyak', 'iiyak', 'broken hearted', 'saktong puso'
  ];
  
  if (emotionalKeywords.some(keyword => allText.includes(keyword))) {
    return {
      persona: 'empathetic_listener',
      rationale: 'emotional'
    };
  }
  
  // Evasive/nonsensical response handling (English + Filipino)
  const evasiveKeywords = [
    'i don\'t know', 'maybe', 'whatever', 'nothing', 'fine',
    'it\'s nothing', 'never mind', 'forget it', 'doesn\'t matter',
    'i\'m good', 'no reason', 'just because', 'stuff', 'things',
    // Filipino evasive keywords
    'hindi ko alam', 'ewan', 'bahala na', 'wala', 'okay lang',
    'wala lang', 'huwag na lang', 'forget na', 'hindi na importante',
    'ayos lang', 'sige na', 'bahala ka', 'ano ba', 'ewan ko',
    'wala akong masabi', 'tama na', 'saka na', 'mamaya na',
    'hindi ko alam kung', 'basta', 'ganyan lang'
  ];
  
  // Check if user has been evasive multiple times or responses are very short
  const recentMessages = messages.slice(-3); // Last 3 messages
  const evasiveCount = recentMessages.filter(msg => 
    evasiveKeywords.some(keyword => msg.text.toLowerCase().includes(keyword)) ||
    msg.text.trim().length < 10 // Very short responses
  ).length;
  
  if (evasiveCount >= 2 && allText.length < 100) {
    return {
      persona: 'direct_engager',
      rationale: 'evasive'
    };
  }
  
  // Default persona
  return {
    persona: 'empathetic_listener',
    rationale: 'default'
  };
};

/**
 * Utility functions for message formatting
 */
export const MessageFormattingUtils = {
  /**
   * Clean and normalize message text
   */
  normalizeMessage(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/^\s+|\s+$/g, "") // Trim leading/trailing whitespace
      .replace(/\n+/g, "\n"); // Normalize multiple newlines to single
  },

  /**
   * Check if text contains incomplete markdown structures
   */
  hasIncompleteMarkdown(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const codeBlockMatches = (text.match(/```/g) || []).length;
    return codeBlockMatches % 2 !== 0;
  },

  /**
   * Validate message structure
   */
  validateMessage(message: any): boolean {
    if (!message || typeof message !== 'object') return false;

    return (
      typeof message.text === 'string' &&
      typeof message.sender === 'string' &&
      (message.timestamp instanceof Date || typeof message.timestamp === 'number')
    );
  },

  /**
   * Sanitize message for display (remove potentially harmful content)
   */
  sanitizeMessage(text: string): string {
    if (!text || typeof text !== 'string') return '';

    // Basic sanitization - remove script tags and other potentially harmful content
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  },

  /**
   * Check if a streaming response indicates an error
   */
  isErrorResponse(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const lowerText = text.toLowerCase();
    return lowerText.includes('error') ||
           lowerText.includes('failed') ||
           lowerText.includes('exception') ||
           lowerText.includes('timeout');
  },

  /**
   * Extract error message from response text
   */
  extractErrorMessage(text: string): string {
    if (!text || typeof text !== 'string') return 'Unknown error occurred';

    // Try to extract error details
    const errorMatch = text.match(/error:?\s*(.+)/i);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    // Fallback to first line if it looks like an error
    const lines = text.split('\n');
    if (lines.length > 0 && this.isErrorResponse(lines[0])) {
      return lines[0].trim();
    }

    return text.trim();
  }
};