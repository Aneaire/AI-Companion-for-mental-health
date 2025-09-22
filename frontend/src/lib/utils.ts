import type { Message } from "@/types/chat";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared thread utilities

export interface ConversationPreferences {
  briefAndConcise?: number;
  empatheticAndSupportive?: boolean;
  solutionFocused?: boolean;
  casualAndFriendly?: boolean;
  professionalAndFormal?: boolean;
}

/**
 * Convert conversation preferences to system instructions
 */
export function getPreferencesInstruction(
  preferences: ConversationPreferences
): string {
  const instructions: string[] = [];

  if (preferences.briefAndConcise && preferences.briefAndConcise > 0) {
    const level = preferences.briefAndConcise;
    if (level <= 25) {
      instructions.push("Keep responses somewhat concise");
    } else if (level <= 50) {
      instructions.push("Keep responses moderately concise");
    } else if (level <= 75) {
      instructions.push("Keep responses quite concise");
    } else {
      instructions.push("Keep responses very brief and concise");
    }
  }
  if (preferences.empatheticAndSupportive) {
    instructions.push("Be empathetic and emotionally supportive");
  }
  if (preferences.solutionFocused) {
    instructions.push("Focus on providing practical solutions and advice");
  }
  if (preferences.casualAndFriendly) {
    instructions.push("Use a casual and friendly tone");
  }
  if (preferences.professionalAndFormal) {
    instructions.push("Maintain a professional and formal approach");
  }

  return instructions.length > 0 ? instructions.join(". ") + "." : "";
}

/**
 * Clean up temporary/empty impersonate messages
 */
export function cleanUpImpersonateTempMessages(
  messages: Message[],
  updateMessages: (msgs: Message[]) => void
): void {
  const filtered = messages.filter(
    (m) => !(m.contextId === "impersonate" && (!m.text || m.text.trim() === ""))
  );
  if (filtered.length !== messages.length) {
    updateMessages(filtered);
  }
}

/**
 * Process streaming response and update message
 */
export async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  updateLastMessage: (text: string) => void,
  patchMarkdown: (text: string) => string
): Promise<string> {
  const decoder = new TextDecoder();
  let fullResponse = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);

    let lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete last line in buffer

    for (const line of lines) {
      if (line.startsWith("event: crisis")) {
        // Crisis event received
        const crisisDataMatch = line.match(/^data: (.*)$/);
        if (crisisDataMatch) {
          const crisisMsg = crisisDataMatch[1];
          updateLastMessage(crisisMsg);
        }
        return fullResponse;
      }
      if (line.startsWith("data: ")) {
        const content = line.substring("data: ".length);
        // Skip session_id events and empty content
        if (
          content.trim() === "" ||
          (!isNaN(Number(content.trim())) && content.trim().length < 10)
        ) {
          continue;
        }
        fullResponse += content + "\n";
      }
    }

    updateLastMessage(patchMarkdown(fullResponse));
  }

  // After the loop, the last chunk might not have ended with a newline
  if (buffer) {
    fullResponse += buffer;
  }

  // Clean up leading/trailing punctuation and whitespace
  fullResponse = fullResponse.replace(/\n+/g, "\n").replace(/^\n+|\n+$/g, "");
  // Normalize multiple newlines to a single newline
  fullResponse = fullResponse.replace(/\n{2,}/g, "\n");
  // Ensure the message ends with a newline for markdown rendering
  if (!fullResponse.endsWith("\n")) {
    fullResponse += "\n";
  }

  updateLastMessage(patchMarkdown(fullResponse));
  return fullResponse;
}

/**
 * Convert raw messages to Message format
 */
export function convertRawMessagesToMessages(
  rawMessages: any[],
  isImpersonateMode: boolean
): Message[] {
  const fetchedMessages = rawMessages.map((msg: any) => ({
    role: msg.sender === "ai" ? "model" : "user",
    text: msg.text,
    timestamp: msg.timestamp,
  }));

  // Sort messages by timestamp to ensure correct order
  return fetchedMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((msg) => ({
      sender: (msg.role === "model" ? "ai" : "user") as "user" | "ai",
      text: msg.text,
      timestamp: new Date(msg.timestamp),
      contextId: isImpersonateMode ? "impersonate" : "default",
    }));
}

/**
 * Build messages array for observer
 */
export function buildMessagesForObserver(
  messages: Message[],
  additionalMessage?: string
): { sender: "user" | "ai"; text: string }[] {
  const baseMessages = messages
    .filter((msg) => msg.sender === "user" || msg.sender === "ai")
    .map((msg) => ({
      sender: (msg.sender === "user" ? "user" : "ai") as "user" | "ai",
      text: msg.text,
    }));

  if (additionalMessage) {
    return [
      ...baseMessages,
      { sender: "user" as "user", text: additionalMessage },
    ];
  }

  return baseMessages;
}

/**
 * Validate and sanitize initial form data
 */
export function sanitizeInitialForm(initialForm: any): any {
  if (Array.isArray(initialForm)) {
    console.error(
      "initialForm is an array, this should not happen:",
      initialForm
    );
    // Try to get the first item if it's an array
    const firstItem = initialForm[0];
    if (firstItem && typeof firstItem === "object") {
      return firstItem;
    } else {
      return undefined;
    }
  }
  return initialForm;
}

