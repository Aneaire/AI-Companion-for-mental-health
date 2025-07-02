// types.ts
export interface MentalHealthConcern {
  id: string;
  label: string;
  description: string;
  color: string;
  iconColor: string;
}

export interface ConversationContext {
  messages: Message[];
  summary?: string;
  lastUpdated: Date;
  sessionId?: number | null; // Add sessionId to the context
}

export interface Message {
  sender: "user" | "ai" | "impostor" | "therapist";
  text: string;
  timestamp: Date;
  tempId?: number; // Optional: for precise tracking
  contextId?: string; // To group messages in the same context
}

// Define the mental health concerns users can select from with added color themes
export const mentalHealthConcerns: MentalHealthConcern[] = [
  {
    id: "anxiety",
    label: "Anxiety",
    description: "Feelings of worry, nervousness, or unease",
    color: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200",
    iconColor: "text-blue-500",
  },
  {
    id: "depression",
    label: "Depression",
    description: "Persistent feelings of sadness and loss of interest",
    color:
      "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200",
    iconColor: "text-purple-500",
  },
  {
    id: "stress",
    label: "Stress",
    description: "Feeling overwhelmed or unable to cope",
    color: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200",
    iconColor: "text-amber-500",
  },
  {
    id: "grief",
    label: "Grief",
    description: "Emotional suffering after a loss",
    color: "bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200",
    iconColor: "text-teal-500",
  },
  {
    id: "anger",
    label: "Anger Issues",
    description: "Difficulty controlling anger responses",
    color: "bg-red-100 text-red-800 border-red-300 hover:bg-red-200",
    iconColor: "text-red-500",
  },
  {
    id: "other",
    label: "Other",
    description: "Another concern not listed here",
    color: "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200",
    iconColor: "text-gray-500",
  },
];
