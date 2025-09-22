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

  constructor(
    onUpdate: (text: string, isComplete: boolean) => void,
    onError: (error: Error) => void,
    onComplete: (finalText: string) => void
  ) {
    this.formatter = new MessageFormatter();
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.onComplete = onComplete;
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
      // Handle special event types
      if (line.startsWith("event: crisis")) {
        // Crisis event - handle immediately
        const crisisDataMatch = line.match(/^event: crisis\s+data: (.*)$/);
        if (crisisDataMatch) {
          const crisisMsg = crisisDataMatch[1];
          this.onUpdate(crisisMsg, true);
          return;
        }
      }

      // Handle data lines
      if (line.startsWith("data: ")) {
        const content = line.substring("data: ".length);

        // Skip session_id events and empty content
        if (
          content.trim() === "" ||
          (!isNaN(Number(content.trim())) && content.trim().length < 10)
        ) {
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
      }
    } catch (error) {
      console.warn("Error processing stream line:", error);
      // Continue processing other lines
    }
  }

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