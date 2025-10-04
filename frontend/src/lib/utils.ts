import type { Message } from "@/types/chat";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MessageFormattingUtils } from "./messageFormatter";

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
  
  // Response Style Controls
  responseStyle?: {
    questioningStyle?: "open-ended" | "closed" | "direct" | "mixed";
    emotionalTone?: "analytical" | "emotional" | "balanced" | "adaptive";
    interventionTiming?: "immediate" | "delayed" | "minimal" | "opportunistic";
  };
  
  // Therapeutic Approach
  therapeuticApproach?: {
    focusAreas?: ("cognitive" | "behavioral" | "humanistic" | "integrative" | "psychodynamic")[];
    sessionPace?: number;
    depthLevel?: "surface" | "deep" | "progressive" | "adaptive";
    goalOrientation?: "exploratory" | "solution-focused" | "psychoeducational" | "process-oriented";
  };
  
  // Impostor Behavior
  impostorBehavior?: {
    detailLevel?: number;
    emotionalExpression?: "reserved" | "expressive" | "variable" | "contextual";
    responsePattern?: "direct" | "indirect" | "mixed" | "situational";
    informationSharing?: "cautious" | "open" | "selective" | "progressive";
    specificityEnforcement?: number;
    exampleFrequency?: "rare" | "occasional" | "frequent" | "consistent";
    sensoryDetailLevel?: number;
    timelineReferences?: "vague" | "specific" | "mixed" | "flexible";
  };
}

/**
 * Convert conversation preferences to system instructions
 */
export function getPreferencesInstruction(
  preferences: ConversationPreferences
): string {
  const instructions: string[] = [];

  // Original preferences
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

  // Response Style Controls
  if (preferences.responseStyle) {
    const { questioningStyle, emotionalTone, interventionTiming } = preferences.responseStyle;
    
    if (questioningStyle) {
      switch (questioningStyle) {
        case "open-ended":
          instructions.push("Use open-ended questions that encourage exploration and reflection");
          break;
        case "closed":
          instructions.push("Use focused, closed questions to gather specific information");
          break;
        case "direct":
          instructions.push("Be direct and straightforward in your questioning approach");
          break;
        case "mixed":
          instructions.push("Vary your questioning style between open-ended, closed, and direct questions");
          break;
      }
    }
    
    if (emotionalTone) {
      switch (emotionalTone) {
        case "analytical":
          instructions.push("Maintain an analytical, objective tone focusing on patterns and insights");
          break;
        case "emotional":
          instructions.push("Use an emotionally expressive tone that validates feelings and experiences");
          break;
        case "balanced":
          instructions.push("Balance emotional validation with analytical insight in your responses");
          break;
        case "adaptive":
          instructions.push("Adapt your emotional tone based on the user's current state and needs");
          break;
      }
    }
    
    if (interventionTiming) {
      switch (interventionTiming) {
        case "immediate":
          instructions.push("Provide immediate interventions and guidance when issues are identified");
          break;
        case "delayed":
          instructions.push("Allow space for exploration before offering interventions and guidance");
          break;
        case "minimal":
          instructions.push("Use minimal interventions, focusing on listening and validation");
          break;
        case "opportunistic":
          instructions.push("Look for optimal moments to introduce interventions and insights");
          break;
      }
    }
  }

  // Therapeutic Approach
  if (preferences.therapeuticApproach) {
    const { focusAreas, sessionPace, depthLevel, goalOrientation } = preferences.therapeuticApproach;
    
    if (focusAreas && focusAreas.length > 0) {
      const focusInstructions = focusAreas.map(area => {
        switch (area) {
          case "cognitive":
            return "challenge unhelpful thought patterns and cognitive distortions";
          case "behavioral":
            return "focus on behavioral patterns and actionable changes";
          case "humanistic":
            return "emphasize personal growth, self-actualization, and human potential";
          case "integrative":
            return "integrate multiple therapeutic approaches based on client needs";
          case "psychodynamic":
            return "explore unconscious patterns and early life experiences";
          default:
            return "";
        }
      }).filter(instruction => instruction.length > 0);
      
      if (focusInstructions.length > 0) {
        instructions.push(`In your approach, ${focusInstructions.join(", ")}`);
      }
    }
    
    if (sessionPace !== undefined) {
      if (sessionPace <= 25) {
        instructions.push("Maintain a slow, deliberate pace allowing for deep reflection");
      } else if (sessionPace <= 50) {
        instructions.push("Use a moderate pace balancing exploration with progress");
      } else if (sessionPace <= 75) {
        instructions.push("Maintain a moderately brisk pace while ensuring understanding");
      } else {
        instructions.push("Use a faster, more dynamic pace to cover multiple areas efficiently");
      }
    }
    
    if (depthLevel) {
      switch (depthLevel) {
        case "surface":
          instructions.push("Focus on surface-level issues and immediate concerns");
          break;
        case "deep":
          instructions.push("Explore deep-rooted patterns and underlying issues");
          break;
        case "progressive":
          instructions.push("Begin with surface issues and progressively explore deeper layers");
          break;
        case "adaptive":
          instructions.push("Adapt the depth of exploration based on client readiness and needs");
          break;
      }
    }
    
    if (goalOrientation) {
      switch (goalOrientation) {
        case "exploratory":
          instructions.push("Prioritize exploration and self-discovery over specific outcomes");
          break;
        case "solution-focused":
          instructions.push("Focus on practical solutions and achieving specific therapeutic goals");
          break;
        case "psychoeducational":
          instructions.push("Provide educational content and teach therapeutic concepts and skills");
          break;
        case "process-oriented":
          instructions.push("Focus on the therapeutic process and the client-therapist relationship");
          break;
      }
    }
  }

  // Impostor Behavior (for persona responses)
  if (preferences.impostorBehavior) {
    const impostorInstructions: string[] = [];
    
    const { 
      detailLevel, 
      emotionalExpression, 
      responsePattern, 
      informationSharing,
      specificityEnforcement,
      exampleFrequency,
      sensoryDetailLevel,
      timelineReferences 
    } = preferences.impostorBehavior;
    
    if (detailLevel !== undefined) {
      if (detailLevel <= 25) {
        impostorInstructions.push("provide brief, minimal responses");
      } else if (detailLevel <= 50) {
        impostorInstructions.push("provide moderate detail in responses");
      } else if (detailLevel <= 75) {
        impostorInstructions.push("provide detailed, comprehensive responses");
      } else {
        impostorInstructions.push("provide extensive, highly detailed responses");
      }
    }
    
    if (emotionalExpression) {
      switch (emotionalExpression) {
        case "reserved":
          impostorInstructions.push("express emotions in a reserved, controlled manner");
          break;
        case "expressive":
          impostorInstructions.push("be emotionally expressive and open about feelings");
          break;
        case "variable":
          impostorInstructions.push("vary emotional expression based on context and topic");
          break;
        case "contextual":
          impostorInstructions.push("adapt emotional expression to match the situation");
          break;
      }
    }
    
    if (responsePattern) {
      switch (responsePattern) {
        case "direct":
          impostorInstructions.push("respond directly and straightforwardly");
          break;
        case "indirect":
          impostorInstructions.push("use indirect, circumstantial responses");
          break;
        case "mixed":
          impostorInstructions.push("mix direct and indirect response patterns");
          break;
        case "situational":
          impostorInstructions.push("adapt response pattern based on the specific situation");
          break;
      }
    }
    
    if (informationSharing) {
      switch (informationSharing) {
        case "cautious":
          impostorInstructions.push("be cautious and selective about sharing personal information");
          break;
        case "open":
          impostorInstructions.push("be open and willing to share personal experiences");
          break;
        case "selective":
          impostorInstructions.push("share information selectively based on relevance and trust");
          break;
        case "progressive":
          impostorInstructions.push("gradually share more information as trust builds");
          break;
      }
    }
    
    if (specificityEnforcement !== undefined) {
      if (specificityEnforcement <= 25) {
        impostorInstructions.push("general responses are acceptable");
      } else if (specificityEnforcement <= 50) {
        impostorInstructions.push("include some specific details and examples");
      } else if (specificityEnforcement <= 75) {
        impostorInstructions.push("include specific details and concrete examples");
      } else {
        impostorInstructions.push("must include highly specific details, examples, and sensory information");
      }
    }
    
    if (exampleFrequency) {
      switch (exampleFrequency) {
        case "rare":
          impostorInstructions.push("use examples rarely");
          break;
        case "occasional":
          impostorInstructions.push("use examples occasionally");
          break;
        case "frequent":
          impostorInstructions.push("use examples frequently to illustrate points");
          break;
        case "consistent":
          impostorInstructions.push("consistently use examples in every response");
          break;
      }
    }
    
    if (sensoryDetailLevel !== undefined) {
      if (sensoryDetailLevel <= 25) {
        impostorInstructions.push("minimal sensory details needed");
      } else if (sensoryDetailLevel <= 50) {
        impostorInstructions.push("include some sensory details");
      } else if (sensoryDetailLevel <= 75) {
        impostorInstructions.push("include rich sensory details");
      } else {
        impostorInstructions.push("include extensive sensory details and physical sensations");
      }
    }
    
    if (timelineReferences) {
      switch (timelineReferences) {
        case "vague":
          impostorInstructions.push("use vague timeline references (recently, sometimes, often)");
          break;
        case "specific":
          impostorInstructions.push("use specific timeline references (yesterday, last week, at 3 PM)");
          break;
        case "mixed":
          impostorInstructions.push("mix vague and specific timeline references");
          break;
        case "flexible":
          impostorInstructions.push("adapt timeline reference specificity based on context");
          break;
      }
    }
    
    if (impostorInstructions.length > 0) {
      instructions.push(`As the persona, ${impostorInstructions.join(", ")}`);
    }
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
  updateLastMessage: (text: string) => void
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

    updateLastMessage(MessageFormattingUtils.normalizeMessage(fullResponse));
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

  updateLastMessage(MessageFormattingUtils.normalizeMessage(fullResponse));
  return fullResponse;
}

/**
 * Convert raw messages to Message format
 */
export function convertRawMessagesToMessages(
  rawMessages: any[],
  isImpersonateMode: boolean
): Message[] {
  // Sort messages by timestamp to ensure correct order
  return rawMessages
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .map((msg: any) => {
      // Preserve the sender type from the database
      let sender: "user" | "ai" | "impostor" | "therapist" = msg.sender || "user";

      // Ensure sender is valid
      if (!["user", "ai", "impostor", "therapist"].includes(sender)) {
        sender = "user";
      }

      return {
        sender: sender as "user" | "ai" | "impostor" | "therapist",
        text: msg.text,
        timestamp: new Date(msg.timestamp),
        contextId: isImpersonateMode ? "impersonate" : "default",
      };
    });
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

