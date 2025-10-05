import { ChatInterface } from "@/components/chat/ChatInterface";
import {
  impersonateChatApi,
  impersonateObserverApi,
  impostorApi,
} from "@/lib/client";
import { conversationLogger } from "@/lib/conversationLogger";
import {
  MessageFormattingUtils,
  StreamingMessageProcessor,
} from "@/lib/messageFormatter";
import {
  useImpostorProfile,
  usePersona,
  useUserProfile,
} from "@/lib/queries/user";
import {
  cleanUpImpersonateTempMessages,
  convertRawMessagesToMessages,
  getPreferencesInstruction,
  processStreamingResponse,
  sanitizeInitialForm,
} from "@/lib/utils";
import textToSpeech from "@/services/elevenlabs/textToSpeech";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import { Brain, Loader2, MessageSquare, Radio, Settings } from "lucide-react";
import { memo, Suspense, useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { ConversationDevTools } from "./ConversationDevTools";
import { ImpersonateInput } from "./ImpersonateInput";
import { PodcastPlayer } from "./PodcastPlayer";
import { ThreadSettingsDialog } from "./ThreadSettingsDialog";
interface ErrorResponse {
  error: string;
}
interface FetchedMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}
export interface ImpersonateThreadProps {
  selectedThreadId: number | null;
  onSendMessage?: (message: string) => Promise<void>;
  onThreadActivity?: (threadId: number) => void;
  preferences?: ConversationPreferences;
  onPreferencesChange?: (preferences: ConversationPreferences) => void;
}
// Enhanced Loading Fallback Component
function EnhancedLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-indigo-50/30 p-8">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 animate-pulse">
          <Brain size={32} className="text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
          <Loader2 size={14} className="text-indigo-600 animate-spin" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Loading conversation...
      </h3>
      <p className="text-gray-500 text-sm text-center max-w-sm">
        Please wait while we prepare your chat experience.
      </p>
    </div>
  );
}
// Enhanced Dev Tools Toggle Button
function DevToolsToggle({
  showDevTools,
  onToggle,
}: {
  showDevTools: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-6 right-6 z-50 group transition-all duration-300 ${
        showDevTools
          ? "bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg"
          : "bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 shadow-md hover:shadow-lg"
      }`}
      style={{
        borderRadius: "16px",
        padding: "12px 16px",
      }}
    >
      <div className="flex items-center gap-2 text-white">
        <Settings
          size={16}
          className={`transition-transform duration-300 ${showDevTools ? "rotate-180" : "group-hover:rotate-90"}`}
        />
        <span className="text-sm font-medium">
          {showDevTools ? "Hide" : "Show"} Dev Tools
        </span>
      </div>
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl"></div>
    </button>
  );
}
export function ImpersonateThread({
  selectedThreadId,
  onSendMessage,
  onThreadActivity,
  preferences,
  onPreferencesChange,
}: ImpersonateThreadProps): JSX.Element {
  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );
  const { data: impostorProfile, isLoading: impostorProfileLoading } =
    useImpostorProfile(userProfile?.id ? Number(userProfile.id) : null);
  // State to store thread data and persona data
  const [threadData, setThreadData] = useState<any>(null);
  const { data: personaData, isLoading: personaLoading } = usePersona(
    threadData?.personaId || null
  );
  const {
    currentContext,
    addMessage,
    updateLastMessage,
    setSessionId,
    setThreadId,
    clearMessages,
    setInitialForm,
    getInitialForm,
    loadingState,
    setLoadingState,
    impersonateMaxExchanges,
    setImpersonateMaxExchanges,
    conversationPreferences,
    setConversationPreferences,
  } = useChatStore();
  const [showChat, setShowChat] = useState(currentContext.messages.length > 0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const isImpersonatingRef = useRef(isImpersonating);
  const [mode, setMode] = useState<"impersonate" | "chat">("impersonate");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Conversation flow control
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<
    "therapist" | "impostor" | null
  >(null);
  const conversationTurnRef = useRef<"therapist" | "impostor" | null>(null);

  // Additional state for observer and conversation tracking
  const [agentStrategy, setAgentStrategy] = useState("");
  const [agentRationale, setAgentRationale] = useState("");
  const [agentNextSteps, setAgentNextSteps] = useState<string[]>([]);
  const [lastImpersonationSender, setLastImpersonationSender] = useState<
    "user" | "ai" | null
  >(null);

  // Conversation state tracking for loop detection
  const [conversationThemes, setConversationThemes] = useState<Set<string>>(
    new Set()
  );
  const [repetitionCount, setRepetitionCount] = useState<Map<string, number>>(
    new Map()
  );
  const [lastIntervention, setLastIntervention] = useState<number>(0);

  // Story-driven conversation phases
  const [conversationPhase, setConversationPhase] = useState<
    "diagnosis" | "story_development" | "resolution"
  >("diagnosis");
  const [turnCount, setTurnCount] = useState(0);
  const [sharedStories, setSharedStories] = useState<string[]>([]);
  const [resolutionElements, setResolutionElements] = useState<string[]>([]);

  // Multi-turn story tracking
  const [storyElements, setStoryElements] = useState<Map<string, any>>(
    new Map()
  );
  const [storyProgression, setStoryProgression] = useState<{
    depth: number;
    completeness: number;
    emotionalRange: string[];
    patternRecognition: string[];
  }>({
    depth: 0,
    completeness: 0,
    emotionalRange: [],
    patternRecognition: [],
  });

  // Conversation quality scoring
  const [conversationQuality, setConversationQuality] = useState<{
    storyExtractionScore: number;
    loopBreakingScore: number;
    phaseProgressionScore: number;
    overallQuality: number;
    qualityHistory: Array<{ turn: number; scores: any }>;
  }>({
    storyExtractionScore: 0,
    loopBreakingScore: 0,
    phaseProgressionScore: 0,
    overallQuality: 0,
    qualityHistory: [],
  });

  // User feedback system
  const [responseFeedback, setResponseFeedback] = useState<
    Map<
      string,
      {
        messageId: string;
        rating: "good" | "needs_improvement" | "poor";
        feedback?: string;
        timestamp: number;
      }
    >
  >(new Map());

  // Conversation completion detection
  const [conversationCompleted, setConversationCompleted] = useState(false);
  const [completionReason, setCompletionReason] = useState<string>("");

  // TTS function for generating audio from text
  const generateTTS = async (
    text: string,
    voiceId: string,
    modelId?: string
  ) => {
    if (!conversationPreferences.enableTTS) return;
    try {
      const shouldAutoPlay = conversationPreferences.ttsAutoPlay ?? false;
      const speed = conversationPreferences.ttsSpeed ?? 1.0;
      const audioUrl = await textToSpeech(
        text,
        voiceId,
        shouldAutoPlay,
        modelId,
        speed
      );
      // The audio will autoplay from the textToSpeech function if auto-play is enabled
      console.log(
        "TTS generated for voice:",
        voiceId,
        "model:",
        modelId,
        "autoPlay:",
        shouldAutoPlay,
        "speed:",
        speed
      );
    } catch (error) {
      console.error("TTS generation failed:", error);
      // Don't show error toast as it might interrupt the conversation
    }
  };

  // Helper function to fetch thread initial form data
  const fetchThreadInitialForm = async (threadId: number) => {
    try {
      // For impersonate threads, fetch from impostor API
      const response = await fetch(`/api/impostor/threads/${threadId}`);
      if (response.ok) {
        const threadData = await response.json();
        // Convert impersonate thread data to FormData format
        const formData: import("@/lib/client").FormData = {
          preferredName: threadData.preferredName || "",
          reasonForVisit: threadData.reasonForVisit || "",
          // Add other fields as needed for impersonate threads
        };
        setInitialForm(formData, threadId);
        return formData;
      }
    } catch (error) {
      console.error("Error fetching thread initial form:", error);
    }
    return undefined;
  };

  // Helper function to detect conversation loops and themes
  const analyzeConversationForLoops = (messages: Message[]) => {
    const recentMessages = messages.slice(-6); // Last 3 exchanges
    const themes = new Set<string>();
    const repetitions = new Map<string, number>();

    // Common repetitive phrases to track
    const repetitivePhrases = [
      "walking on eggshells",
      "exhausting",
      "draining",
      "tiring",
      "it sounds like",
      "that must feel",
      "it's like",
      "it's understandable",
      "i guess",
      "honestly",
      "it's just",
    ];

    recentMessages.forEach((msg) => {
      const text = msg.text.toLowerCase();

      // Track repetitive phrases
      repetitivePhrases.forEach((phrase) => {
        if (text.includes(phrase)) {
          const count = repetitions.get(phrase) || 0;
          repetitions.set(phrase, count + 1);
        }
      });

      // Extract themes (simplified)
      if (
        text.includes("family") ||
        text.includes("parents") ||
        text.includes("brother")
      ) {
        themes.add("family conflict");
      }
      if (
        text.includes("exhaust") ||
        text.includes("tired") ||
        text.includes("drain")
      ) {
        themes.add("exhaustion");
      }
      if (
        text.includes("argu") ||
        text.includes("fight") ||
        text.includes("bicker")
      ) {
        themes.add("arguments");
      }
    });

    // Check for loops
    const hasLoop = Array.from(repetitions.values()).some(
      (count) => count >= 2
    );
    const themeRepetition = themes.size <= 2 && recentMessages.length >= 4; // Stuck on same themes

    return {
      hasLoop,
      themeRepetition,
      repetitions: Object.fromEntries(repetitions),
      themes: Array.from(themes),
      needsIntervention: hasLoop || themeRepetition,
    };
  };

  // Helper function to determine conversation phase based on turn count
  const updateConversationPhase = (currentTurn: number) => {
    if (currentTurn <= 4) {
      setConversationPhase("diagnosis");
    } else if (currentTurn <= 8) {
      setConversationPhase("story_development");
    } else {
      setConversationPhase("resolution");
    }
  };

  // Helper function to generate detailed story prompts based on persona background
  const generateStoryPrompts = (persona: any, phase: string) => {
    const background = persona?.background || "";
    const problemDescription = persona?.problemDescription || "";
    const age = parseInt(persona?.age) || 25;
    const personality = persona?.personality || "";
    const fullName = persona?.fullName || "the person";

    // Extract key elements from background for personalized prompts
    const hasFamilyMentions =
      background.toLowerCase().includes("family") ||
      background.toLowerCase().includes("parents") ||
      background.toLowerCase().includes("mother") ||
      background.toLowerCase().includes("father");
    const hasWorkMentions =
      background.toLowerCase().includes("work") ||
      background.toLowerCase().includes("job") ||
      background.toLowerCase().includes("career") ||
      background.toLowerCase().includes("startup");
    const hasRelationshipMentions =
      background.toLowerCase().includes("partner") ||
      background.toLowerCase().includes("relationship") ||
      background.toLowerCase().includes("friend");
    const hasChildhoodMentions =
      background.toLowerCase().includes("childhood") ||
      background.toLowerCase().includes("grew up") ||
      background.toLowerCase().includes("young");

    if (phase === "story_development") {
      const personalizedPrompts = [];

      // Childhood/family focused prompts if relevant
      if (hasFamilyMentions || hasChildhoodMentions || age < 35) {
        personalizedPrompts.push(
          `Tell me about a specific moment from your childhood or family life that you think planted the seeds for your current struggles. Make it vivid - what were you doing, who was there, what did you feel in that moment?`
        );
      } else {
        personalizedPrompts.push(
          `Share a memory from your past that feels connected to what you're experiencing now. Paint a detailed picture of that moment - the setting, the people involved, your thoughts and feelings.`
        );
      }

      // Work/school focused prompts if relevant
      if (hasWorkMentions || age >= 22) {
        personalizedPrompts.push(
          `Describe a specific incident at work or in your professional life that really highlighted your challenges. Include the exact situation, what happened, and how it made you feel afterward.`
        );
      } else {
        personalizedPrompts.push(
          `Tell me about a recent experience in your daily life that exemplified your struggles. Be specific about what happened, when it occurred, and the immediate aftermath.`
        );
      }

      // Relationship focused prompts if relevant
      if (hasRelationshipMentions) {
        personalizedPrompts.push(
          `Share a story about an interaction with someone close to you that showed your patterns in action. Include what was said, what you thought but didn't say, and how the moment felt.`
        );
      } else {
        personalizedPrompts.push(
          `Describe a moment when you tried to connect with someone but your usual patterns got in the way. What happened in that interaction, and what went through your mind?`
        );
      }

      // Attempted solution prompts
      personalizedPrompts.push(
        `Tell me about a time when you tried to address this problem yourself. What did you do, what were you hoping would happen, and what actually occurred instead?`
      );

      // Age-appropriate additional prompts
      if (age < 30) {
        personalizedPrompts.push(
          `As someone in your ${age}s, tell me about a recent experience with friends or social situations that triggered your struggles. What made that moment particularly challenging?`
        );
      } else if (age >= 40) {
        personalizedPrompts.push(
          `With your life experience, share a story about a situation where you recognized your patterns but still couldn't break free. What wisdom have you gained from that experience?`
        );
      }

      return personalizedPrompts.slice(0, 4); // Return up to 4 prompts
    } else if (phase === "resolution") {
      return [
        `Share a small but meaningful moment recently when you felt a spark of hope or noticed something positive changing. What happened, and why did it matter to you?`,
        `Imagine ${fullName}'s life six months from now, having made progress on these challenges. Paint a detailed picture of a typical day - what would be different, what would feel better?`,
        `Tell me about someone in your life (past or present) who has shown you what positive change looks like. What did they do or say that inspired you?`,
        `Describe a future scenario where you handle a challenging situation with confidence and skill. Walk me through exactly what you would do differently and how it would feel.`,
        `What's one small victory or moment of pride you've experienced recently, even if it seems insignificant? Why did that moment stand out to you?`,
        `If you could give your younger self advice about dealing with ${problemDescription.toLowerCase().split(" ").slice(0, 3).join(" ")}, what would you say?`,
      ];
    }
    return [];
  };

  // Helper function to validate and enhance story responses
  const validateAndEnhanceStoryResponse = (
    response: string,
    phase: string
  ): { isValid: boolean; enhancedResponse?: string } => {
    const text = response.toLowerCase();

    // Story validation criteria based on phase
    if (phase === "diagnosis") {
      // Phase 1: Should contain story-extraction questions
      const storyIndicators = [
        "tell me about",
        "what happened",
        "can you describe",
        "walk me through",
        "give me an example",
        "share a story",
        "what was that like",
        "when did this start",
        "how did it begin",
        "what changed",
      ];

      const hasStoryExtraction = storyIndicators.some((indicator) =>
        text.includes(indicator)
      );

      // Should NOT contain vague empathy patterns
      const vagueEmpathyPatterns = [
        "i understand",
        "that sounds",
        "i hear you",
        "that must be",
        "it's understandable",
        "many people",
        "it's normal",
      ];

      const hasVagueEmpathy = vagueEmpathyPatterns.some((pattern) =>
        text.includes(pattern)
      );

      // Valid if it has story extraction AND doesn't rely on vague empathy
      return { isValid: hasStoryExtraction && !hasVagueEmpathy };
    } else if (phase === "story_development") {
      // Phase 2: Should contain specific story elements
      const storyElements = [
        "when",
        "where",
        "who",
        "what happened",
        "what did",
        "what were",
        "describe",
        "tell me",
        "paint a picture",
        "walk me through",
        "specific",
        "example",
        "time",
        "place",
        "person",
      ];

      const hasStoryElements = storyElements.some((element) =>
        text.includes(element)
      );

      // Should ask for sensory details or dialogue
      const detailIndicators = [
        "see",
        "hear",
        "feel",
        "smell",
        "taste",
        "said",
        "told",
        "asked",
        "dialogue",
        "conversation",
        "words",
        "exactly",
      ];

      const hasDetailFocus = detailIndicators.some((detail) =>
        text.includes(detail)
      );

      return { isValid: hasStoryElements || hasDetailFocus };
    } else if (phase === "resolution") {
      // Phase 3: Should contain hope, action steps, or strength identification
      const resolutionElements = [
        "hope",
        "future",
        "next week",
        "try",
        "step",
        "strength",
        "proud",
        "imagine",
        "when you",
        "you could",
        "you might",
        "possible",
        "support",
        "resource",
        "help",
        "change",
        "progress",
      ];

      const hasResolutionElements = resolutionElements.some((element) =>
        text.includes(element)
      );

      // Should be specific, not vague
      const specificIndicators = [
        "this week",
        "tomorrow",
        "call",
        "talk to",
        "try",
        "practice",
        "notice",
        "pay attention",
        "reach out",
        "specific",
      ];

      const hasSpecificity = specificIndicators.some((specific) =>
        text.includes(specific)
      );

      return { isValid: hasResolutionElements && hasSpecificity };
    }

    return { isValid: true }; // Default to valid for other cases
  };

  // Multi-turn story building logic
  const trackStoryProgression = (
    message: string,
    phase: string,
    turnNumber: number
  ) => {
    const text = message.toLowerCase();

    // Extract story elements from the message
    const storyElementsDetected = {
      timeReferences:
        text.match(
          /\b(last week|last month|yesterday|today|this morning|last night|three years ago|when i was|at age|during|while|after|before)\b/gi
        ) || [],
      locationReferences:
        text.match(
          /\b(at work|at home|in the car|at school|in bed|kitchen|office|meeting room|restaurant|park|store)\b/gi
        ) || [],
      peopleReferences:
        text.match(
          /\b(my (mother|father|boss|friend|partner|wife|husband|son|daughter|sister|brother)|he said|she said|i told|they asked)\b/gi
        ) || [],
      sensoryDetails:
        text.match(
          /\b(saw|heard|felt|smelled|tasted|looked|felt like|heard the|smelled|the sound|the feeling)\b/gi
        ) || [],
      dialogueElements: text.match(/[""']([^""']+)[""']/g) || [],
      emotionalStates:
        text.match(
          /\b(felt (scared|angry|sad|happy|anxious|nervous|excited|proud|ashamed|guilty|overwhelmed|confused))\b/gi
        ) || [],
      internalThoughts:
        text.match(
          /\b(i thought|i felt|i realized|i wondered|i decided|i knew)\b/gi
        ) || [],
      physicalSensations:
        text.match(
          /\b(heart (racing|pounding)|hands (shaking|trembling)|stomach (churning|knot)|sweating|breathing (heavy|fast)|tense|tight)\b/gi
        ) || [],
    };

    // Calculate story depth and completeness
    const elementCounts = Object.values(storyElementsDetected).map(
      (arr) => arr.length
    );
    const totalElements = elementCounts.reduce((sum, count) => sum + count, 0);
    const uniqueElementTypes = elementCounts.filter(
      (count) => count > 0
    ).length;

    // Update story progression state
    setStoryProgression((prev) => ({
      depth: Math.max(prev.depth, uniqueElementTypes),
      completeness: Math.max(prev.completeness, totalElements),
      emotionalRange: [
        ...new Set([
          ...prev.emotionalRange,
          ...storyElementsDetected.emotionalStates,
        ]),
      ],
      patternRecognition: prev.patternRecognition, // This would be updated by analyzing patterns across messages
    }));

    // Store story elements for cross-turn reference
    const storyKey = `turn_${turnNumber}_${phase}`;
    setStoryElements(
      (prev) =>
        new Map(
          prev.set(storyKey, {
            elements: storyElementsDetected,
            depth: uniqueElementTypes,
            completeness: totalElements,
            phase,
            turnNumber,
          })
        )
    );

    return {
      depth: uniqueElementTypes,
      completeness: totalElements,
      elements: storyElementsDetected,
      needsDeepening: uniqueElementTypes < 3 || totalElements < 5,
    };
  };

  // Helper function to generate deepening prompts based on story progression
  const generateDeepeningPrompt = (
    currentStoryElements: any,
    phase: string
  ): string => {
    const missingElements = [];

    if (currentStoryElements.timeReferences.length === 0) {
      missingElements.push("specific timing (when did this happen?)");
    }
    if (currentStoryElements.locationReferences.length === 0) {
      missingElements.push("physical location (where were you?)");
    }
    if (currentStoryElements.peopleReferences.length === 0) {
      missingElements.push("people involved (who was there?)");
    }
    if (currentStoryElements.sensoryDetails.length === 0) {
      missingElements.push("sensory details (what did you see/hear/feel?)");
    }
    if (currentStoryElements.dialogueElements.length === 0) {
      missingElements.push("exact dialogue (what was said?)");
    }
    if (currentStoryElements.emotionalStates.length === 0) {
      missingElements.push("emotional experience (how did you feel?)");
    }

    if (missingElements.length > 0) {
      return `To help me understand better, could you add some ${missingElements.slice(0, 2).join(" and ")} to that story?`;
    }

    // If story is complete, suggest deepening based on phase
    if (phase === "story_development") {
      return "That's a vivid story. What was going through your mind during that moment? How did that experience change you?";
    } else if (phase === "resolution") {
      return "That's powerful. What strength did you discover in yourself through that experience? How might that help you moving forward?";
    }

    return "";
  };

  // Conversation quality scoring system
  const evaluateConversationQuality = (
    messages: Message[],
    currentPhase: string,
    turnCount: number
  ) => {
    const recentMessages = messages.slice(-6); // Last 3 exchanges
    const therapistMessages = recentMessages.filter((m) => m.sender === "ai");
    const impostorMessages = recentMessages.filter(
      (m) => m.sender === "impostor"
    );

    // Story Extraction Score (0-100)
    let storyExtractionScore = 0;
    if (therapistMessages.length > 0) {
      const storyPrompts = therapistMessages.filter((msg) => {
        const text = msg.text.toLowerCase();
        return [
          "tell me about",
          "what happened",
          "can you describe",
          "walk me through",
          "give me an example",
          "share a story",
          "what was that like",
          "paint me a picture",
          "what did you see",
          "what did you hear",
          "what did you feel",
        ].some((prompt) => text.includes(prompt));
      }).length;

      storyExtractionScore = Math.min(
        100,
        (storyPrompts / therapistMessages.length) * 100
      );
    }

    // Loop Breaking Score (0-100)
    let loopBreakingScore = 100; // Start with perfect score
    const bannedPhrases = [
      "it sounds like",
      "that must feel",
      "heavy load",
      "draining",
      "exhausting",
      "overwhelming",
      "understandable",
      "takes courage",
      "incredibly draining",
    ];

    therapistMessages.forEach((msg) => {
      const text = msg.text.toLowerCase();
      bannedPhrases.forEach((phrase) => {
        if (text.includes(phrase)) {
          loopBreakingScore -= 20; // Penalty for each banned phrase
        }
      });
    });

    loopBreakingScore = Math.max(0, loopBreakingScore);

    // Phase Progression Score (0-100)
    let phaseProgressionScore = 0;
    if (impostorMessages.length > 0) {
      let storyDepthScore = 0;
      let resolutionProgressScore = 0;

      impostorMessages.forEach((msg) => {
        const analysis = trackStoryProgression(
          msg.text,
          currentPhase,
          turnCount
        );
        storyDepthScore += Math.min(100, analysis.depth * 25); // Max 25 points per message for depth
        storyDepthScore += Math.min(50, analysis.completeness * 5); // Max 50 points for completeness
      });

      if (currentPhase === "resolution") {
        const resolutionIndicators = [
          "hope",
          "future",
          "next week",
          "try",
          "step",
          "strength",
          "proud",
          "imagine",
          "when you",
          "you could",
          "you might",
          "possible",
        ];

        impostorMessages.forEach((msg) => {
          const text = msg.text.toLowerCase();
          resolutionIndicators.forEach((indicator) => {
            if (text.includes(indicator)) resolutionProgressScore += 10;
          });
        });
      }

      phaseProgressionScore = Math.min(
        100,
        storyDepthScore / impostorMessages.length + resolutionProgressScore
      );
    }

    // Overall Quality Score (weighted average)
    const overallQuality = Math.round(
      storyExtractionScore * 0.4 +
        loopBreakingScore * 0.4 +
        phaseProgressionScore * 0.2
    );

    // Update quality state
    const newQualityScores = {
      storyExtractionScore: Math.round(storyExtractionScore),
      loopBreakingScore: Math.round(loopBreakingScore),
      phaseProgressionScore: Math.round(phaseProgressionScore),
      overallQuality,
      qualityHistory: [
        ...conversationQuality.qualityHistory,
        {
          turn: turnCount,
          scores: {
            storyExtraction: Math.round(storyExtractionScore),
            loopBreaking: Math.round(loopBreakingScore),
            phaseProgression: Math.round(phaseProgressionScore),
            overall: overallQuality,
          },
        },
      ].slice(-10), // Keep last 10 turns
    };

    setConversationQuality(newQualityScores);

    return newQualityScores;
  };

  // User feedback system for response quality
  const submitResponseFeedback = (
    messageId: string,
    rating: "good" | "needs_improvement" | "poor",
    feedback?: string
  ) => {
    const feedbackEntry = {
      messageId,
      rating,
      feedback,
      timestamp: Date.now(),
    };

    setResponseFeedback((prev) => new Map(prev.set(messageId, feedbackEntry)));

    // Log feedback for system learning
    console.log("[FEEDBACK SUBMITTED]", {
      messageId,
      rating,
      feedback,
      context: {
        phase: conversationPhase,
        turnCount,
        qualityScores: conversationQuality,
      },
    });

    // Could send to backend for ML training
    // feedbackApi.submitFeedback(feedbackEntry);
  };

  const getFeedbackStats = () => {
    const feedbackArray = Array.from(responseFeedback.values());
    const stats = {
      total: feedbackArray.length,
      good: feedbackArray.filter((f) => f.rating === "good").length,
      needs_improvement: feedbackArray.filter(
        (f) => f.rating === "needs_improvement"
      ).length,
      poor: feedbackArray.filter((f) => f.rating === "poor").length,
      averageRating: 0,
    };

    // Calculate average rating (good=3, needs_improvement=2, poor=1)
    const ratingSum = feedbackArray.reduce((sum, f) => {
      const ratingValue =
        f.rating === "good" ? 3 : f.rating === "needs_improvement" ? 2 : 1;
      return sum + ratingValue;
    }, 0);

    stats.averageRating = stats.total > 0 ? ratingSum / stats.total : 0;

    return stats;
  };

  // Helper function to detect conversation completion
  const detectConversationCompletion = (
    messages: Message[],
    currentPhase: string,
    turnCount: number
  ): { completed: boolean; reason: string } => {
    if (turnCount < 8) return { completed: false, reason: "" }; // Need minimum turns

    const recentMessages = messages.slice(-4); // Last 4 exchanges
    const impostorMessages = recentMessages.filter(
      (m) => m.sender === "impostor"
    );

    if (impostorMessages.length < 2) return { completed: false, reason: "" };

    // Check for resolution indicators in recent impostor messages
    const resolutionIndicators = [
      "feel hopeful",
      "things will be different",
      "learned from this",
      "moving forward",
      "feel better",
      "see a path",
      "grateful for",
      "proud of myself",
      "stronger now",
      "different approach",
      "new perspective",
      "growth",
      "healing",
      "progress",
      "looking forward",
      "excited about",
      "confident that",
      "believe in myself",
    ];

    const hopeIndicators = [
      "hope",
      "future",
      "tomorrow",
      "next week",
      "next month",
      "six months",
      "year from now",
      "imagine",
      "picture",
      "envision",
      "see myself",
    ];

    let resolutionScore = 0;
    let hopeScore = 0;

    impostorMessages.forEach((msg) => {
      const text = msg.text.toLowerCase();

      // Count resolution indicators
      resolutionIndicators.forEach((indicator) => {
        if (text.includes(indicator)) resolutionScore++;
      });

      // Count hope indicators
      hopeIndicators.forEach((indicator) => {
        if (text.includes(indicator)) hopeScore++;
      });
    });

    // Check for explicit completion signals
    const completionSignals = [
      "i think that helps",
      "i feel better",
      "that makes sense",
      "thank you for listening",
      "i've got what i needed",
      "that was helpful",
      "i feel understood",
      "i can work with this",
    ];

    const hasCompletionSignal = recentMessages.some((msg) =>
      completionSignals.some((signal) =>
        msg.text.toLowerCase().includes(signal)
      )
    );

    // Completion conditions
    const hasEnoughResolution = resolutionScore >= 2;
    const hasEnoughHope = hopeScore >= 2;
    const inResolutionPhase = currentPhase === "resolution";
    const sufficientTurns = turnCount >= 10;

    if (hasCompletionSignal && (hasEnoughResolution || hasEnoughHope)) {
      return {
        completed: true,
        reason: "Natural completion with resolution indicators",
      };
    }

    if (
      inResolutionPhase &&
      sufficientTurns &&
      (hasEnoughResolution || hasEnoughHope)
    ) {
      return {
        completed: true,
        reason: "Resolution phase completed with hope elements",
      };
    }

    if (turnCount >= 12 && (resolutionScore >= 3 || hopeScore >= 3)) {
      return {
        completed: true,
        reason: "Extended conversation reached resolution",
      };
    }

    return { completed: false, reason: "" };
  };

  // Helper function to control conversation flow with proper state management
  const executeConversationTurn = async (
    turnType: "therapist" | "impostor",
    lastMessage: string,
    userProfileData: any
  ): Promise<{ response: string; nextTurn: "therapist" | "impostor" }> => {
    console.log(
      `[CONVERSATION CONTROL] Starting ${turnType} turn with message: "${lastMessage.substring(0, 50)}..."`
    );

    setIsProcessingTurn(true);
    setCurrentTurn(turnType);
    conversationTurnRef.current = turnType;

    // Update turn count and phase
    const newTurnCount = turnCount + 1;
    setTurnCount(newTurnCount);
    updateConversationPhase(newTurnCount);

    try {
      let response = "";

      if (turnType === "therapist") {
        // Therapist's turn - analyze for loops and get observer strategy
        let observerStrategy = "";
        let observerRationale = "";
        let observerNextSteps: string[] = [];
        let observerSentiment = "";

        // Analyze conversation for loops
        const loopAnalysis = analyzeConversationForLoops(
          currentContext.messages
        );
        console.log("[LOOP DETECTION]", loopAnalysis);

        // Check if therapist is using banned phrases in recent responses
        const recentTherapistMessages = currentContext.messages
          .filter((m) => m.sender === "ai")
          .slice(-2);
        const therapistUsingBannedPhrases = recentTherapistMessages.some(
          (msg) => {
            const text = msg.text.toLowerCase();
            return [
              "it sounds like",
              "that must feel",
              "heavy load",
              "draining",
              "exhausting",
              "overwhelming",
              "understandable",
              "takes courage",
              "incredibly draining",
            ].some((phrase) => text.includes(phrase));
          }
        );

        // Add intervention if needed - enhanced for current loop patterns
        let interventionInstruction = "";
        if (
          (loopAnalysis.needsIntervention || therapistUsingBannedPhrases) &&
          Date.now() - lastIntervention > 30000
        ) {
          // Max once per 30 seconds
          interventionInstruction = `
               🚨 CRITICAL LOOP DETECTED - IMMEDIATE INTERVENTION REQUIRED:

               CURRENT LOOP PATTERN: ${therapistUsingBannedPhrases ? "THERAPIST IS USING BANNED PHRASES + " : ""}Client repeatedly describes feeling "drained", "stuck", "overwhelming", "tired" without specific stories or examples.

               FORBIDDEN RESPONSES:
               - "It sounds incredibly draining"
               - "That must feel overwhelming"
               - "I understand you're stuck"
               - Any variation of acknowledging vague feelings

               REQUIRED INTERVENTION STRATEGY:
               1. BREAK THE PATTERN: Use an immediate pivot - "Let's talk about something specific..."
               2. FORCE A STORY: Ask for ONE concrete example from their actual life
               3. SPECIFIC PROMPTS ONLY:
                  - "Tell me about the last time you felt this way. What exactly happened?"
                  - "What's one specific thing that happened yesterday that made you feel drained?"
                  - "Can you walk me through a recent day when this was really bad?"
                  - "Tell me about an interaction with someone that triggered this feeling."

               4. NO EMPATHY FIRST: Skip the "I hear you" - go straight to story extraction
               5. MAKE IT CONCRETE: Ask for times, places, people, exact words spoken

               LOOP PATTERNS DETECTED: ${JSON.stringify(loopAnalysis.repetitions)}
               THEMES: ${loopAnalysis.themes.join(", ")}

               SUCCESS: Next response must contain a specific story prompt, not vague empathy.
             `;
          setLastIntervention(Date.now());
        }

        try {
          const messagesForObserver = currentContext.messages
            .slice(-5)
            .map((msg) => ({
              text: msg.text,
              sender: msg.sender === "ai" ? "ai" : "user",
            }));

          const sessionInitialForm = selectedThreadId
            ? getInitialForm(selectedThreadId)
            : undefined;

          const observerRes = await impersonateObserverApi.getSuggestion({
            messages: messagesForObserver,
            ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
          });
          observerStrategy = observerRes.strategy || "";
          observerRationale = observerRes.rationale || "";
          observerNextSteps = observerRes.next_steps || [];
          observerSentiment = observerRes.sentiment || "";
          setAgentStrategy(observerStrategy);
          setAgentRationale(observerRationale);
          setAgentNextSteps(observerNextSteps);
        } catch (e) {
          console.warn("Observer analysis failed:", e);
        }

        // Get therapist response
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const contextData = currentContext.messages.map((msg) => ({
          role: msg.sender === "ai" ? "model" : "user",
          text: msg.text,
          timestamp: msg.timestamp.getTime(),
          ...(msg.contextId ? { contextId: msg.contextId } : {}),
        }));

        // Voice-specific instructions for therapist
        const getTherapistVoiceInstructions = () => {
          if (!conversationPreferences.enableTTS) return "";

          const therapistVoiceId = conversationPreferences.therapistVoiceId;
          let voiceInstructions = "";

          // Match voice characteristics to response style
          if (
            therapistVoiceId?.includes("adam") ||
            therapistVoiceId?.includes("male")
          ) {
            voiceInstructions = `
                 VOICE STYLE: You are speaking with a calm, warm male voice.
                 - Use a slightly deeper, more measured pace
                 - Be reassuring and steady, like a compassionate male therapist
                 - Use phrases like "I understand," "Let's work through this," "I'm here to help"
                 - Tone should be supportive and grounding
                 - Avoid overly emotional language - be the stable presence
               `;
          } else if (
            therapistVoiceId?.includes("rachel") ||
            therapistVoiceId?.includes("bella") ||
            therapistVoiceId?.includes("female")
          ) {
            voiceInstructions = `
                 VOICE STYLE: You are speaking with a warm, empathetic female voice.
                 - Use a gentle, nurturing tone
                 - Be more expressive in your empathy
                 - Use phrases like "I hear you," "That sounds so difficult," "You're doing great"
                 - Tone should be warm and validating
                 - Can be more emotionally expressive and comforting
               `;
          } else if (
            therapistVoiceId?.includes("sam") ||
            therapistVoiceId?.includes("androgynous")
          ) {
            voiceInstructions = `
                 VOICE STYLE: You are speaking with a balanced, neutral voice.
                 - Use a calm, professional tone
                 - Be direct but compassionate
                 - Focus on clarity and understanding
                 - Tone should be supportive yet objective
                 - Balance warmth with professional boundaries
               `;
          } else {
            voiceInstructions = `
                 VOICE STYLE: Adapt your speaking style to match the voice characteristics.
                 - Be warm and authentic to the voice's natural tone
                 - Match the energy and pacing of the selected voice
                 - Sound like a real therapist speaking naturally
               `;
          }

          return voiceInstructions;
        };

        // Story-driven therapeutic instructions based on conversation phase
        const getPhaseSpecificInstructions = () => {
          const storyPrompts = generateStoryPrompts(
            userProfileData,
            conversationPhase
          );

          if (conversationPhase === "diagnosis") {
            return `
                  PHASE 1: DIAGNOSIS & CONNECTION (Turns 1-4)

                  GOALS: Build therapeutic alliance, understand core issues, establish context

                  ALLOWED PHRASES (use these instead of banned ones):
                  - "Help me understand what that's like for you..."
                  - "What's your experience with that?"
                  - "Tell me about a time when..."
                  - "How did that affect you?"
                  - "What was going through your mind?"

                  FOCUS AREAS:
                  - Build rapport and trust
                  - Understand the problem's impact on daily life
                  - Explore when this started and how it evolved
                  - Identify what they've tried before
                  - Establish their goals for therapy

                  STORY PREPARATION:
                  - Ask about their background, family, work situation
                  - Inquire about specific instances that illustrate the problem
                  - Explore their support system and coping mechanisms

                  EXAMPLE RESPONSES:
                  "Tell me about when you first noticed this becoming a problem. What was happening in your life at that time?"
                  "Help me understand how this affects your day-to-day. Can you walk me through a typical day?"
                  "What does your support system look like? Who do you turn to when things get difficult?"
                `;
          } else if (conversationPhase === "story_development") {
            return `
                  PHASE 2: STORY DEVELOPMENT & EXPLORATION (Turns 5-8)

                  YOUR ROLE: Guide the client to share rich, detailed stories that illustrate their struggles and personality

                  STORY PROMPTS TO CHOOSE FROM:
                  ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join("\n                  ")}

                  STORYTELLING REQUIREMENTS:
                  - Choose ONE prompt per response and develop it fully
                  - Include specific details: times, places, people, dialogue
                  - Share sensory details and internal thoughts
                  - Show emotions through actions and words, not just descriptions
                  - Connect the story to their current struggles
                  - Be vulnerable and authentic

                  NARRATIVE TECHNIQUES:
                  - "Let me tell you about the time that [specific incident]..."
                  - "I'll never forget when [event] happened. I was [age/place] and..."
                  - "The other day, [specific situation] occurred, and it reminded me of..."
                  - "Growing up, my [family member] always used to say [quote], and that shaped..."

                  PERSONA CONSISTENCY:
                  - Stay true to your established personality and background
                  - Show how your problem manifests in different contexts
                  - Reveal deeper layers of your character through stories
                  - Demonstrate your coping mechanisms and defense patterns

                  MINIMUM REQUIREMENTS:
                  - 150+ words per response
                  - At least 2 specific details or anecdotes
                  - Emotional depth and vulnerability
                  - Clear connection to your therapeutic goals
                `;
          } else {
            return `
                  PHASE 3: RESOLUTION & HOPE (Turns 9-12)

                  YOUR ROLE: Guide the client toward positive change and hope

                  RESOLUTION STORY PROMPTS:
                  ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join("\n                  ")}

                  BREAKTHROUGH ELEMENTS:
                  - Share "aha!" moments and new insights
                  - Describe trying new behaviors and having success
                  - Talk about hope and future possibilities
                  - Show how your perspective has shifted
                  - Demonstrate increased self-awareness and agency

                  POSITIVE CHANGE INDICATORS:
                  - "For the first time, I tried [new behavior] and..."
                  - "I realized that [insight] changes everything because..."
                  - "What gives me hope now is [specific reason]..."
                  - "I can see a future where I'm [positive outcome]..."
                  - "The difference between last week and now is [specific change]..."

                  HAPPY ENDING DEVELOPMENT:
                  - Show concrete improvements in daily life
                  - Describe better relationships or communication
                  - Share new coping strategies that work
                  - Express optimism about the future
                  - Demonstrate self-compassion and growth

                  CLOSING ELEMENTS:
                  - Gratitude for the therapeutic process
                  - Specific plans for continued growth
                  - Recognition of your own strength and resilience
                  - Hopeful vision for your future
                  - Sense of closure and empowerment

                  MINIMUM REQUIREMENTS:
                  - 150+ words per response
                  - At least 2 examples of positive change
                  - Genuine hope and optimism
                  - Clear demonstration of growth
                `;
          }
        };

        const storyDrivenInstructions = `
              STORY-DRIVEN CONVERSATION SYSTEM

              ${getPhaseSpecificInstructions()}

              UNIVERSAL RULES:
              1. NEVER use these phrases: "It sounds like", "That must feel", "heavy load", "takes courage"
              2. ALWAYS adapt your approach to the current conversation phase
              3. FOCUS on stories and specific examples, not vague feelings
              4. BUILD toward a hopeful resolution by the final phase
              5. TRACK what stories have been shared and don't repeat them

              CURRENT PHASE: ${conversationPhase.toUpperCase()} (Turn ${newTurnCount})
              PERSONA: ${userProfileData?.fullName || "Unknown"}, Age ${userProfileData?.age || "Unknown"}
              BACKGROUND: ${userProfileData?.background || "Not specified"}
              PROBLEM: ${userProfileData?.problemDescription || "Not specified"}

              ${getTherapistVoiceInstructions()}
            `;

        try {
          const therapistResponse = await impersonateChatApi.sendMessage({
            message: lastMessage,
            threadId: selectedThreadId!,
            userId: String(userProfile.id),
            sender: "therapist",
            signal: abortController.signal,
            context: contextData,
            ...(observerStrategy
              ? { systemInstruction: observerStrategy }
              : {}),
            ...(observerRationale ? { observerRationale } : {}),
            ...(observerNextSteps.length > 0 ? { observerNextSteps } : {}),
            ...(observerSentiment ? { sentiment: observerSentiment } : {}),
            systemInstruction: observerStrategy
              ? `${observerStrategy} ${interventionInstruction} ${storyDrivenInstructions} ${getPreferencesInstruction(conversationPreferences)}`
              : `${interventionInstruction} ${storyDrivenInstructions} ${getPreferencesInstruction(conversationPreferences)}`,
            ...(conversationPreferences ? { conversationPreferences } : {}),
          });

          const reader = therapistResponse.body?.getReader();
          if (reader) {
            const tempAiMessage = {
              sender: "ai" as const,
              text: "",
              timestamp: new Date(),
              tempId: Date.now(),
              contextId: "impersonate" as const,
            };

            // Don't throw error - let the current response complete naturally
            if (!isImpersonatingRef.current) {
              console.log(
                "[CONVERSATION CONTROL] Impersonation stopped during therapist response - will complete current response"
              );
            }

            addMessage(tempAiMessage);
            response = await processStreamingResponse(
              reader,
              updateLastMessage
            );

            // Post-process response to check for banned phrases
            const bannedPhrases = [
              "it sounds like",
              "that must feel",
              "heavy load",
              "draining",
              "exhausting",
              "overwhelming",
              "understandable",
              "takes courage",
              "incredibly draining",
              "wading through mud",
              "stuck in mud",
              "paralyzed",
              "walking on eggshells",
            ];

            const containsBannedPhrases = bannedPhrases.some((phrase) =>
              response.toLowerCase().includes(phrase.toLowerCase())
            );

            // Apply response filtering instead of rejection
            const phraseReplacements = [
              ["it sounds like", "help me understand"],
              ["that must feel", "what's that like for you"],
              ["heavy load", "significant challenge"],
              ["draining", "depleting"],
              ["exhausting", "wearying"],
              ["overwhelming", "intense"],
              ["understandable", "many people experience this"],
              ["takes courage", "requires strength"],
              ["incredibly draining", "particularly depleting"],
              ["wading through mud", "moving through resistance"],
              ["stuck in mud", "facing resistance"],
              ["paralyzed", "feeling stuck"],
              ["walking on eggshells", "navigating carefully"],
            ];

            // Apply replacements to the response
            phraseReplacements.forEach(([banned, replacement]) => {
              const regex = new RegExp(
                `\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                "gi"
              );
              response = response.replace(regex, replacement);
            });

            if (containsBannedPhrases) {
              console.log(
                "[RESPONSE FILTER] Applied banned phrase replacements to automated response"
              );
            }
          } else {
            // API call succeeded but returned no body - provide fallback response
            console.warn(
              "[CONVERSATION CONTROL] Therapist API returned no response body, using fallback"
            );
            response =
              "I hear you sharing that specific experience. Can you tell me more about how that moment affected you afterward?";
          }
        } catch (error) {
          console.error(
            "[CONVERSATION CONTROL] Therapist API call failed:",
            error
          );
          // Provide a fallback response when API fails
          response =
            "Thank you for sharing that experience. What was most challenging about that situation for you?";
        }

        // Update state
        setLastImpersonationSender("ai");
        console.log(
          `[CONVERSATION CONTROL] Therapist completed, response length: ${response.length}`
        );

        // Generate TTS
        if (response.trim()) {
          generateTTS(
            response.trim(),
            conversationPreferences.therapistVoiceId,
            conversationPreferences.therapistModel
          );
        }

        // Ensure we have a valid response before continuing
        if (!response.trim()) {
          console.warn(
            "[CONVERSATION CONTROL] Therapist response is empty, providing fallback"
          );
          response =
            "I appreciate you sharing that with me. Can you tell me more about what that experience was like for you?";
        }

        return { response: response.trim(), nextTurn: "impostor" };
      } else {
        // Impostor's turn - go directly to streaming
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Voice-specific instructions for impostor
        const getImpostorVoiceInstructions = () => {
          if (!conversationPreferences.enableTTS) return "";

          const impostorVoiceId = conversationPreferences.impostorVoiceId;
          let voiceInstructions = "";

          // Match voice characteristics to response style
          if (
            impostorVoiceId?.includes("adam") ||
            impostorVoiceId?.includes("male")
          ) {
            voiceInstructions = `
                VOICE STYLE: You are speaking with a male voice that may sound tense, anxious, or struggling.
                - Use a slightly hesitant or measured pace when discussing difficult topics
                - Be more reserved emotionally, typical of men sharing vulnerability
                - Use phrases like "I guess," "It's just that," "I don't know how to explain it"
                - Can be more direct and less emotionally expressive
                - Show vulnerability through careful word choice rather than emotional language
                - Sound like someone who's trying to open up but finds it difficult
              `;
          } else if (
            impostorVoiceId?.includes("rachel") ||
            impostorVoiceId?.includes("bella") ||
            impostorVoiceId?.includes("female")
          ) {
            voiceInstructions = `
                VOICE STYLE: You are speaking with a female voice that may sound emotional, worried, or overwhelmed.
                - Use a more expressive and emotional tone
                - Be comfortable sharing feelings and vulnerabilities
                - Use phrases like "I just feel so..." "It's overwhelming when..." "I can't help but think..."
                - Show emotion through your word choice and pacing
                - Can be more open about fears and anxieties
                - Sound like someone who processes emotions verbally
              `;
          } else if (
            impostorVoiceId?.includes("sam") ||
            impostorVoiceId?.includes("androgynous")
          ) {
            voiceInstructions = `
                VOICE STYLE: You are speaking with a balanced voice that sounds thoughtful and introspective.
                - Use a measured, thoughtful pace
                - Be analytical about your feelings
                - Use phrases like "I've been thinking about..." "It seems to me that..." "I notice that..."
                - Show vulnerability through reflection rather than raw emotion
                - Sound like someone who's trying to understand their own experiences
                - Balance emotional expression with thoughtful observation
              `;
          } else {
            voiceInstructions = `
                VOICE STYLE: Adapt your speaking style to match the voice characteristics.
                - Sound like a real person sharing their authentic thoughts and feelings
                - Match the emotional tone and pacing of the selected voice
                - Be genuine and vulnerable in a way that feels natural for the voice
              `;
          }

          return voiceInstructions;
        };

        // Story-driven persona instructions based on conversation phase
        const getPersonaPhaseInstructions = () => {
          const storyPrompts = generateStoryPrompts(
            userProfileData,
            conversationPhase
          );

          if (conversationPhase === "diagnosis") {
            return `
                  PHASE 1: DIAGNOSIS & CONNECTION (Turns 1-4)
                  
                  YOUR ROLE: Establish your character and share initial context about your struggles
                  
                  STORY ELEMENTS TO INTRODUCE:
                  - Your background and how the problem developed
                  - When you first noticed this becoming an issue
                  - How it affects your daily life and relationships
                  - What you've tried before and what hasn't worked
                  - Your hopes for therapy
                  
                  COMMUNICATION STYLE:
                  - Be somewhat reserved but willing to share
                  - Show vulnerability but maintain some defenses
                  - Use specific examples from your life
                  - Express genuine concern about your situation
                  
                  BASED ON YOUR PERSONA:
                  ${userProfileData?.background ? `Background: ${userProfileData.background}` : ""}
                  ${userProfileData?.problemDescription ? `Problem: ${userProfileData.problemDescription}` : ""}
                  ${userProfileData?.personality ? `Personality: ${userProfileData.personality}` : ""}
                  
                  EXAMPLE OPENINGS:
                  "I've been dealing with this for about [time] now. It started when [specific event]..."
                  "In my family, we always [pattern], and I think that's why I struggle with [problem]..."
                  "At work, I'm known as [reputation], but internally I feel [contradiction]..."
                `;
          } else if (conversationPhase === "story_development") {
            return `
                  PHASE 2: STORY DEVELOPMENT & EXPLORATION (Turns 5-8)
                  
                  YOUR ROLE: Share rich, detailed stories that illustrate your struggles and personality
                  
                  STORY PROMPTS TO CHOOSE FROM:
                  ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join("\n                  ")}
                  
                  STORYTELLING REQUIREMENTS:
                  - Choose ONE prompt per response and develop it fully
                  - Include specific details: times, places, people, dialogue
                  - Share sensory details and internal thoughts
                  - Show emotions through actions and words, not just descriptions
                  - Connect the story to your current struggles
                  - Be vulnerable and authentic
                  
                  NARRATIVE TECHNIQUES:
                  - "Let me tell you about the time that [specific incident]..."
                  - "I'll never forget when [event] happened. I was [age/place] and..."
                  - "The other day, [specific situation] occurred, and it reminded me of..."
                  - "Growing up, my [family member] always used to say [quote], and that shaped..."
                  
                  PERSONA CONSISTENCY:
                  - Stay true to your established personality and background
                  - Show how your problem manifests in different contexts
                  - Reveal deeper layers of your character through stories
                  - Demonstrate your coping mechanisms and defense patterns
                  
                  MINIMUM REQUIREMENTS:
                  - 150+ words per response
                  - At least 2 specific details or anecdotes
                  - Emotional depth and vulnerability
                  - Clear connection to your therapeutic goals
                `;
          } else {
            return `
                  PHASE 3: RESOLUTION & HOPE (Turns 9-12)
                  
                  YOUR ROLE: Show growth, insight, and movement toward positive change
                  
                  RESOLUTION STORY PROMPTS:
                  ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join("\n                  ")}
                  
                  BREAKTHROUGH ELEMENTS:
                  - Share "aha!" moments and new insights
                  - Describe trying new behaviors and having success
                  - Talk about hope and future possibilities
                  - Show how your perspective has shifted
                  - Demonstrate increased self-awareness and agency
                  
                  POSITIVE CHANGE INDICATORS:
                  - "For the first time, I tried [new behavior] and..."
                  - "I realized that [insight] changes everything because..."
                  - "What gives me hope now is [specific reason]..."
                  - "I can see a future where I'm [positive outcome]..."
                  - "The difference between last week and now is [specific change]..."
                  
                  HAPPY ENDING DEVELOPMENT:
                  - Show concrete improvements in daily life
                  - Describe better relationships or communication
                  - Share new coping strategies that work
                  - Express optimism about the future
                  - Demonstrate self-compassion and growth
                  
                  CLOSING ELEMENTS:
                  - Gratitude for the therapeutic process
                  - Specific plans for continued growth
                  - Recognition of your own strength and resilience
                  - Hopeful vision for your future
                  - Sense of closure and empowerment
                  
                  MINIMUM REQUIREMENTS:
                  - 150+ words per response
                  - At least 2 examples of positive change
                  - Genuine hope and optimism
                  - Clear demonstration of growth
                `;
          }
        };

        const storyDrivenPersonaInstructions = `
               STORY-DRIVEN PERSONA SYSTEM

               ${getPersonaPhaseInstructions()}

               🚫 CRITICAL BANNED PHRASES FOR PERSONA (NEVER USE):
               - "exhausting", "overwhelming", "draining", "tiring"
               - "I guess", "honestly", "just", "like"
               - "wading through mud", "stuck", "paralyzed"
               - "don't know", "can't", "won't"

               ✅ REQUIRED ALTERNATIVE PHRASES:
               - Instead of "exhausting": "wearying", "depleting", "challenging"
               - Instead of "overwhelming": "intense", "significant", "substantial"
               - Instead of "I guess": "I've noticed", "I've found", "I've experienced"
               - Instead of "stuck": "facing resistance", "encountering obstacles", "navigating difficulty"

               UNIVERSAL RULES:
               1. ALWAYS tell specific stories with concrete details (times, places, people, dialogue)
               2. STAY IN CHARACTER consistently with your persona background
               3. SHOW emotions through actions and dialogue, not just labels
               4. PROGRESS naturally through the conversation phases
               5. NEVER repeat the same stories or examples
               6. RESPOND TO THERAPIST'S QUESTIONS WITH SPECIFIC EXAMPLES

               CURRENT PHASE: ${conversationPhase.toUpperCase()} (Turn ${newTurnCount})
               PERSONA: ${userProfileData?.fullName || "Unknown"}, Age ${userProfileData?.age || "Unknown"}
               BACKGROUND: ${userProfileData?.background || "Not specified"}
               PROBLEM: ${userProfileData?.problemDescription || "Not specified"}
               PERSONALITY: ${userProfileData?.personality || "Not specified"}

               STORIES SHARED SO FAR: ${sharedStories.join(", ") || "None"}
               RESOLUTION ELEMENTS: ${resolutionElements.join(", ") || "None yet"}

               ${getImpostorVoiceInstructions()}
             `;

        try {
          const impostorResponse = await impostorApi.sendMessage({
            sessionId: selectedThreadId!,
            message: lastMessage || "",
            userProfile: userProfileData,
            preferredName: threadData?.preferredName,
            personaId: threadData?.personaId || undefined,
            signal: abortController.signal,
            systemInstruction: `${storyDrivenPersonaInstructions} ${getPreferencesInstruction(conversationPreferences)}`,
            ...(conversationPreferences ? { conversationPreferences } : {}),
          });

          const reader = impostorResponse.body?.getReader();
          if (reader) {
            const tempImpostorMessage = {
              sender: "impostor" as const,
              text: "",
              timestamp: new Date(),
              tempId: Date.now(),
              contextId: "impersonate" as const,
            };

            // Don't throw error - let the current response complete naturally
            if (!isImpersonatingRef.current) {
              console.log(
                "[CONVERSATION CONTROL] Impersonation stopped during impostor response - will complete current response"
              );
            }

            addMessage(tempImpostorMessage);
            response = await processStreamingResponse(
              reader,
              updateLastMessage
            );
          } else {
            // API call succeeded but returned no body - provide fallback response
            console.warn(
              "[CONVERSATION CONTROL] Impostor API returned no response body, using fallback"
            );
            response =
              "I understand. Let me think about how to respond to that.";
          }
        } catch (error) {
          console.error(
            "[CONVERSATION CONTROL] Impostor API call failed:",
            error
          );
          // Provide a fallback response when API fails
          response =
            "I hear what you're saying. Can you help me understand that better?";
        }

        // Save the impostor response
        if (response.trim() && response.trim() !== lastMessage.trim()) {
          try {
            await impostorApi.postMessage({
              sessionId: selectedThreadId!,
              threadType: "impersonate",
              sender: "impostor",
              text: response.trim(),
            });
          } catch (error) {
            console.error("Error saving impostor message:", error);
          }
        }

        // Track stories and resolution elements with progression analysis
        if (response.trim()) {
          // Track story progression for impostor responses
          const storyAnalysis = trackStoryProgression(
            response,
            conversationPhase,
            turnCount
          );

          if (conversationPhase === "story_development") {
            const storySummary = `${response.substring(0, 50)}... (depth: ${storyAnalysis.depth}, elements: ${storyAnalysis.completeness})`;
            setSharedStories((prev) => [...prev, storySummary]);
          } else if (conversationPhase === "resolution") {
            setResolutionElements((prev) => [
              ...prev,
              response.substring(0, 50) + "...",
            ]);
          }
        }

        // Ensure we have a valid response before continuing
        if (!response.trim()) {
          console.warn(
            "[CONVERSATION CONTROL] Impostor response is empty, providing fallback"
          );
          response =
            "I hear you. Let me try to express what I'm feeling about this.";
        }

        // Update state
        setLastImpersonationSender("user");
        console.log(
          `[CONVERSATION CONTROL] Impostor completed, response length: ${response.length}`
        );

        // Generate TTS
        if (response.trim()) {
          generateTTS(
            response.trim(),
            conversationPreferences.impostorVoiceId,
            conversationPreferences.impostorModel
          );
        }

        return { response: response.trim(), nextTurn: "therapist" };
      }
    } catch (error) {
      console.error(`[CONVERSATION CONTROL] ${turnType} turn failed:`, error);
      throw error;
    } finally {
      setIsProcessingTurn(false);
      setCurrentTurn(null);
      conversationTurnRef.current = null;
    }
  };

  useEffect(() => {
    if (selectedThreadId) {
      setThreadId(selectedThreadId);
      const fetchThreadData = async () => {
        try {
          setLoadingHistory(true);
          // Fetch thread data to get personaId
          const threadResponse = await fetch(
            `/api/impostor/threads/${selectedThreadId}`
          );
          if (threadResponse.ok) {
            const thread = await threadResponse.json();
            setThreadData(thread);
          }
          // Fetch messages for this thread using the new impersonate chat API
          const rawMessages =
            await impersonateChatApi.getMessages(selectedThreadId);
          clearMessages();
          // Reset conversation state when loading thread
          setTurnCount(0);
          setConversationPhase("diagnosis");
          setSharedStories([]);
          setResolutionElements([]);
          // Convert and add messages
          const sortedMessages = convertRawMessagesToMessages(
            rawMessages,
            true // isImpersonateMode
          );
          sortedMessages.forEach((msg) => addMessage(msg));
          setShowChat(true);
          // Fetch and set the correct initial form for this thread
          await fetchThreadInitialForm(selectedThreadId);
        } catch (error) {
          console.error("Error fetching thread data:", error);
          setSessionId(null);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchThreadData();
    }
  }, [
    selectedThreadId,
    addMessage,
    updateLastMessage,
    setSessionId,
    setThreadId,
    clearMessages,
    setInitialForm,
  ]);
  const handleSendMessage = async (message: string): Promise<void> => {
    if (!message.trim() && !showChat) return;
    if (userProfileLoading || !userProfile?.id) {
      toast.error("User profile not loaded. Please wait.");
      return;
    }

    // Save user message to database
    if (message.trim() && selectedThreadId) {
      try {
        await impostorApi.postMessage({
          sessionId: selectedThreadId,
          threadType: "impersonate",
          sender: "user", // User messages in impersonate mode are from the therapist
          text: message.trim(),
        });
      } catch (error) {
        console.error("Error saving user message:", error);
      }
    }

    const userMessage: Message = {
      sender: "user",
      text: message,
      timestamp: new Date(),
      contextId: "impersonate",
    };
    if (message.trim()) {
      addMessage(userMessage);
    }
    // Get the correct initial form for this thread
    let sessionInitialForm = getInitialForm(selectedThreadId!);
    setLoadingState("generating");
    setIsStreaming(true);
    try {
      // Ensure initialForm is an object, not an array
      sessionInitialForm = sanitizeInitialForm(sessionInitialForm);
      // Use the new impersonate chat API
      const contextData = currentContext.messages.slice(0, -1).map((msg) => ({
        // Exclude the last message to avoid duplication
        role: msg.sender === "ai" ? "model" : "user",
        text: msg.text,
        timestamp: msg.timestamp.getTime(),
        ...(msg.contextId ? { contextId: msg.contextId } : {}),
      }));

      console.log("[THERAPIST CALL] contextData length:", contextData.length);
      console.log("[THERAPIST CALL] lastMessage:", lastMessage);
      console.log(
        "[THERAPIST CALL] currentContext.messages length:",
        currentContext.messages.length
      );
      console.log(
        "[THERAPIST CALL] last message in context:",
        currentContext.messages[
          currentContext.messages.length - 1
        ]?.text?.substring(0, 50)
      );
      console.log(
        "[THERAPIST CALL] full context messages:",
        currentContext.messages.map((m) => ({
          sender: m.sender,
          text: m.text.substring(0, 30) + "...",
        }))
      );
      // Apply story-driven instructions even for manual messages
      const currentPhase = conversationPhase;
      const currentTurnCount = turnCount;

      // Structured Response Template System
      const getStructuredResponseTemplate = () => {
        const bannedPhrases = `
            🚫 CRITICAL: IMMEDIATELY BANNED PHRASES - DO NOT USE ANY OF THESE UNDER ANY CIRCUMSTANCES:
            - "It sounds like" (BANNED - Use "Help me understand" instead)
            - "That must feel" (BANNED - Use "What's that like for you" instead)
            - "heavy load" (BANNED - Use "significant challenge" instead)
            - "draining" (BANNED - Use "depleting" instead)
            - "exhausting" (BANNED - Use "wearying" instead)
            - "walking on eggshells" (BANNED - Use "navigating carefully" instead)
            - "It's understandable" (BANNED - Use "Many people experience this" instead)
            - "takes courage" (BANNED - Use "requires strength" instead)
            - "overwhelming" (BANNED - Use "intense" instead)
            - "paralyzed" (BANNED - Use "feeling stuck" instead)
            - "stuck in mud" (BANNED - Use "moving through resistance" instead)

            PENALTY FOR VIOLATION: If you use any banned phrase, the response will be rejected and you must try again.
          `;

        // Get story tracking context
        const storyContext = `
            STORY TRACKING CONTEXT:
            - Stories shared so far: ${sharedStories.length > 0 ? sharedStories.join("; ") : "None yet"}
            - Resolution elements identified: ${resolutionElements.length > 0 ? resolutionElements.join("; ") : "None yet"}
            - Current turn: ${currentTurnCount + 1}
            - Conversation phase: ${conversationPhase.toUpperCase()}
          `;

        if (currentPhase === "diagnosis") {
          return `
              ${bannedPhrases}
              ${storyContext}

              📋 PHASE 1: DIAGNOSIS & CONNECTION (Turn ${currentTurnCount + 1})

              🎯 PRIMARY OBJECTIVE: BREAK THE VAGUE FEELINGS LOOP
              The client is stuck describing feelings like "drained", "stuck", "overwhelming" without specifics.
              Your job is to IMMEDIATELY pivot to concrete examples and stories.

              📝 REQUIRED RESPONSE FORMAT:
              1. BRIEF ACKNOWLEDGMENT (1 sentence max): Use approved phrases only
              2. IMMEDIATE STORY EXTRACTION: Ask for ONE specific story element
              3. SPECIFIC PROMPT: Include time/place/people details

              ✅ APPROVED PHRASES (USE THESE INSTEAD):
              - "Help me understand what that's like for you..."
              - "Tell me more about your experience with that..."
              - "What's your perspective on this situation?"
              - "How did that affect you personally?"
              - "What was going through your mind at the time?"

              🎭 STORY EXTRACTION TEMPLATES (CHOOSE ONE):

              TEMPLATE A - RECENT EXAMPLE:
              "Can you tell me about a recent time when you felt this way? What exactly happened, and when did it occur?"

              TEMPLATE B - TYPICAL SITUATION:
              "What's an example of when this started feeling worse? Tell me about that specific situation."

              TEMPLATE C - DAILY IMPACT:
              "Tell me about your typical day - what happens that makes it hard? Walk me through a recent example."

              TEMPLATE D - SOCIAL CONTEXT:
              "Who have you talked to about this, and what did they say? Tell me about that conversation."

              TEMPLATE E - FIRST OCCURRENCE:
              "When did you first notice this becoming a problem? What was happening in your life at that time?"

              🔄 LOOP BREAKING: If client repeats vague feelings, use this exact pivot:
              "Let's talk about something specific. Tell me about the last time you felt this way. What exactly happened?"

              SUCCESS CRITERIA: Response must contain a specific story prompt with time/place/people elements
            `;
        } else if (currentPhase === "story_development") {
          return `
              ${bannedPhrases}
              ${storyContext}

              📋 PHASE 2: STORY DEVELOPMENT & EXPLORATION (Turn ${currentTurnCount + 1})

              🎯 PRIMARY OBJECTIVE: EXTRACT RICH, DETAILED STORIES
              The client has been giving vague descriptions. Now you MUST get specific, vivid stories with sensory details.

              📝 REQUIRED RESPONSE FORMAT:
              1. REFERENCE PREVIOUS STORY (if applicable): "Building on what you shared about [story element]..."
              2. SPECIFIC STORY PROMPT: Choose ONE template below
              3. SENSORY DETAIL REQUIREMENTS: Ask for sights, sounds, physical sensations
              4. DIALOGUE REQUEST: Ask for exact words spoken
              5. EMOTIONAL DEPTH: Ask for thoughts and feelings moment-by-moment

              🎭 STORY DEVELOPMENT TEMPLATES (CHOOSE ONE BASED ON AVAILABLE STORIES):

              TEMPLATE A - DEEPEN EXISTING STORY:
              "You mentioned [reference previous story element]. Tell me more about that moment. What did you see, hear, and feel? What was going through your mind?"

              TEMPLATE B - CHILDHOOD/ORIGINS:
              "Tell me about a specific moment from your childhood or early life that planted the seeds for your current struggles. Make it vivid - what were you doing, who was there, what did you feel?"

              TEMPLATE C - RECENT INCIDENT:
              "Describe a specific incident from the past week that really highlighted your challenges. Include the exact situation, what happened, and how it made you feel afterward."

              TEMPLATE D - RELATIONSHIP PATTERN:
              "Share a story about an interaction with someone close to you that showed your patterns in action. Include what was said, what you thought but didn't say, and how the moment felt."

              TEMPLATE E - ATTEMPTED SOLUTION:
              "Tell me about a time when you tried to address this problem yourself. What did you do, what were you hoping would happen, and what actually occurred instead?"

              TEMPLATE F - SENSORY RECOLLECTION:
              "Paint me a picture of a time when this feeling was really strong. What did you see around you? What sounds were there? What physical sensations did you notice?"

              🔍 SPECIFIC ELEMENTS TO REQUEST (Include at least 3):
              - Time period: "Last Tuesday at 3pm", "Three years ago", "This morning"
              - Physical location: "In the break room at work", "Driving home", "At the kitchen table"
              - People involved: "My boss and two colleagues", "My partner", "My mother"
              - Sensory details: "The fluorescent lights were buzzing", "I could smell coffee brewing"
              - Dialogue: "He said 'We need this done by Friday'", "I told myself 'I can't do this'"
              - Physical sensations: "My heart started racing", "My hands were shaking"
              - Internal thoughts: "I thought 'I can't handle this'", "I felt like giving up"

              SUCCESS CRITERIA: Response must contain specific sensory/dialogue requests and reference at least one story element
            `;
        } else {
          return `
              ${bannedPhrases}
              ${storyContext}

              📋 PHASE 3: RESOLUTION & HOPE (Turn ${currentTurnCount + 1})

              🎯 PRIMARY OBJECTIVE: BUILD HOPE AND CONCRETE SOLUTIONS
              The client has shared their stories. Now focus on strength, hope, and actionable change.

              📝 REQUIRED RESPONSE FORMAT:
              1. STRENGTH REFLECTION: Highlight specific strengths shown in their stories
              2. HOPEFUL VISION: Paint a concrete picture of positive change
              3. ACTIONABLE STEP: Identify one specific, measurable next action
              4. RESOURCE CONNECTION: Link to existing support systems
              5. OPTIMISTIC CLOSURE: End with specific hope markers

              💪 STRENGTH IDENTIFICATION TEMPLATES:
              - "You've shown real resilience by [specific action from their story]..."
              - "I notice your strength in [specific quality demonstrated]..."
              - "What you've already accomplished by [specific achievement] shows..."
              - "Your ability to [specific skill shown in stories] is a real asset..."

              🌟 HOPE BUILDING TEMPLATES (CHOOSE ONE):
              - "Imagine six months from now, having worked through this challenge. What's one thing you'd be doing differently?"
              - "Based on what you've shared, what small victory would mean the most to you right now?"
              - "Tell me about a moment recently when you felt a spark of hope or noticed something positive changing."
              - "What's one area where you've already made progress that we haven't discussed yet?"

              ✅ ACTION STEP TEMPLATES (MUST BE SPECIFIC AND MEASURABLE):
              - "This week, try [specific action] at [specific time/place]..."
              - "Tomorrow, reach out to [specific person] and share [specific thing]..."
              - "Notice when [specific trigger] happens and practice [specific response]..."
              - "Each day this week, spend [specific amount of time] doing [specific activity]..."

              🤝 RESOURCE CONNECTIONS:
              - "You mentioned [person from story] - how might they support you with this?"
              - "What strengths have you seen in [relationship mentioned] that could help?"
              - "Who in your life has helped you before? How can you reconnect with them?"

              🎯 SUCCESS MARKERS TO ACHIEVE:
              - Client expresses specific hope: "I can see myself..."
              - Identifies concrete next steps: "This week I will..."
              - Acknowledges their own strength: "I've already shown..."
              - Connects to support systems: "I can reach out to..."

              CONVERSATION ENDING CRITERIA:
              - Client shows signs of hope and agency (2+ markers)
              - Specific action steps have been identified
              - Strengths have been acknowledged from their stories
              - Future vision includes measurable positive change

              SUCCESS CRITERIA: Response must contain strength identification, specific action step, and hopeful vision
            `;
        }
      };

      const getManualTherapistInstructions = () => {
        return getStructuredResponseTemplate();
      };

      const response = await impersonateChatApi.sendMessage({
        message: message,
        threadId: selectedThreadId!,
        userId: String(userProfile.id),
        context: contextData,
        sender: "user",
        ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
        systemInstruction: `${getManualTherapistInstructions()} ${getPreferencesInstruction(conversationPreferences)}`,
        ...(conversationPreferences ? { conversationPreferences } : {}),
      });
      if (typeof onThreadActivity === "function" && selectedThreadId) {
        onThreadActivity(selectedThreadId);
      }
      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        console.error("Frontend received error data:", errorData);
        throw new Error(errorData.error || "Failed to get response");
      }
      if (message.trim() || currentContext.messages.length) {
        const tempId = Date.now();
        const aiMessage: Message = {
          sender: "ai",
          text: "",
          timestamp: new Date(),
          tempId,
          contextId: "impersonate",
        };
        addMessage(aiMessage);
      }
      // Set loading state to streaming when streaming starts
      setLoadingState("streaming");
      // Use the new StreamingMessageProcessor for cleaner streaming logic
      const processor = new StreamingMessageProcessor(
        (text: string, isComplete: boolean) => {
          updateLastMessage(text);
        },
        (error: Error) => {
          console.error("Streaming error:", error);
          const errorText = MessageFormattingUtils.extractErrorMessage(
            error.message
          );
          const errorMessage: Message = {
            sender: "ai",
            text: `I apologize, but I encountered an error: ${errorText}. Please try again.`,
            timestamp: new Date(),
            contextId: "impersonate",
            status: "failed",
            error: error.message,
          };
          addMessage(errorMessage);
        },
        async (finalText: string) => {
          // Step 1: Response filtering - Replace banned phrases with approved alternatives
          let filteredText = finalText;

          const phraseReplacements = [
            // Exact phrase replacements
            ["it sounds like", "help me understand"],
            ["that must feel", "what's that like for you"],
            ["heavy load", "significant challenge"],
            ["draining", "depleting"],
            ["exhausting", "wearying"],
            ["overwhelming", "intense"],
            ["understandable", "many people experience this"],
            ["takes courage", "requires strength"],
            ["incredibly draining", "particularly depleting"],
            ["wading through mud", "moving through resistance"],
            ["stuck in mud", "facing resistance"],
            ["paralyzed", "feeling stuck"],
            ["walking on eggshells", "navigating carefully"],
            ["I hear you", "I understand"],
            ["I understand", "Help me understand"],
            ["that sounds difficult", "that seems challenging"],
            [
              "that sounds really challenging",
              "help me understand what that's like",
            ],
            ["it's completely understandable", "many people feel this way"],
            [
              "it sounds incredibly draining",
              "that seems particularly depleting",
            ],
          ];

          // Apply replacements
          phraseReplacements.forEach(([banned, replacement]) => {
            // Use word boundaries to avoid partial matches
            const regex = new RegExp(
              `\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
              "gi"
            );
            filteredText = filteredText.replace(regex, replacement);
          });

          // Additional pattern replacements for common variations
          filteredText = filteredText.replace(
            /\bit sounds\b/gi,
            "help me understand"
          );
          filteredText = filteredText.replace(
            /\bthat must be\b/gi,
            "what's that like"
          );
          filteredText = filteredText.replace(
            /\bso draining\b/gi,
            "so depleting"
          );
          filteredText = filteredText.replace(
            /\bso exhausting\b/gi,
            "so wearying"
          );

          // Step 2: Story validation and enhancement with progression tracking
          const storyValidation = validateAndEnhanceStoryResponse(
            filteredText,
            conversationPhase
          );

          // Track story progression for therapist responses (to ensure they're asking for stories effectively)
          const therapistStoryAnalysis = trackStoryProgression(
            filteredText,
            conversationPhase,
            turnCount
          );

          if (
            !storyValidation.isValid ||
            therapistStoryAnalysis.needsDeepening
          ) {
            console.log(
              "[STORY VALIDATION] Response lacks story elements or needs deepening, enhancing..."
            );

            // Get deepening prompt based on current story elements
            const lastImpostorMessage =
              currentContext.messages
                .filter((m) => m.sender === "impostor")
                .slice(-1)[0]?.text || "";

            if (lastImpostorMessage) {
              const lastStoryAnalysis = trackStoryProgression(
                lastImpostorMessage,
                conversationPhase,
                turnCount - 1
              );
              const deepeningPrompt = generateDeepeningPrompt(
                lastStoryAnalysis.elements,
                conversationPhase
              );

              if (deepeningPrompt) {
                filteredText += `\n\n${deepeningPrompt}`;
              } else {
                // Fallback enhancement
                const enhancementNotice =
                  "\n\n💡 To help us understand better, could you share a specific example or story from your experience?";
                filteredText += enhancementNotice;
              }
            } else {
              // No previous story to deepen, use basic enhancement
              const enhancementNotice =
                "\n\n💡 To help us understand better, could you share a specific example or story from your experience?";
              filteredText += enhancementNotice;
            }
          }

          // Check if any significant changes were made
          const hasChanges = filteredText !== finalText;

          if (hasChanges) {
            console.log(
              "[RESPONSE ENHANCEMENT] Applied filtering and/or story enhancement"
            );
          }

          updateLastMessage(filteredText);
        }
      );
      await processor.processStream(response);
      if (typeof onThreadActivity === "function" && selectedThreadId) {
        onThreadActivity(selectedThreadId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        sender: "ai",
        text:
          error instanceof Error
            ? error.message
            : "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date(),
        contextId: "impersonate",
      };
      addMessage(errorMessage);
    } finally {
      setIsStreaming(false);
      setLoadingState("idle");

      // Update turn count and phase for manual messages
      const newTurnCount = turnCount + 1;
      setTurnCount(newTurnCount);
      updateConversationPhase(newTurnCount);

      // Evaluate conversation quality after manual therapist response
      setTimeout(() => {
        evaluateConversationQuality(
          currentContext.messages,
          conversationPhase,
          newTurnCount
        );
      }, 100);
    }
  };
  useEffect(() => {
    isImpersonatingRef.current = isImpersonating;
  }, [isImpersonating]);

  // Initialize conversation logger
  useEffect(() => {
    conversationLogger.loadFromStorage();
  }, []);

  // Auto-log conversation when messages change
  useEffect(() => {
    if (selectedThreadId && currentContext.messages.length > 0) {
      const feedbackStats = getFeedbackStats();

      conversationLogger.logConversation(
        selectedThreadId,
        currentContext.messages,
        threadData?.sessionName || personaData?.name,
        {
          qualityScores: conversationQuality,
          feedbackStats,
          storyProgression,
          conversationPhase,
          turnCount,
          sharedStories: sharedStories.length,
          resolutionElements: resolutionElements.length,
        }
      );
    }
  }, [
    currentContext.messages,
    selectedThreadId,
    threadData,
    personaData,
    conversationQuality,
    storyProgression,
    conversationPhase,
    turnCount,
    sharedStories,
    resolutionElements,
  ]);

  const handleStartImpersonation = async (startFromMessageIndex?: number) => {
    if (!userProfile?.id) {
      toast.error("User profile not loaded.");
      return;
    }
    if (!selectedThreadId) {
      toast.error("No thread selected. Please select or create a thread.");
      return;
    }
    if (personaLoading) {
      toast.error("Persona data is still loading. Please wait.");
      return;
    }
    if (!personaData && !impostorProfile) {
      toast.error("No persona data found. Please select a persona first.");
      return;
    }
    // Move thread to top immediately when roleplay starts
    if (typeof onThreadActivity === "function" && selectedThreadId) {
      onThreadActivity(selectedThreadId);
    }
    // Clean up temp/empty impersonate messages before starting
    cleanUpImpersonateTempMessages(currentContext.messages, (msgs) => {
      clearMessages();
      msgs.forEach((msg) => addMessage(msg));
    });
    // Set max exchanges based on podcast mode and story-driven approach
    const maxExchanges = preferences?.podcastMode ? 6 : 12; // Allow more turns for story development
    setImpersonateMaxExchanges(maxExchanges);

    // Reset conversation state for new session
    setTurnCount(0);
    setConversationPhase("diagnosis");
    setSharedStories([]);
    setResolutionElements([]);
    setConversationCompleted(false);
    setCompletionReason("");
    setIsImpersonating(true);
    isImpersonatingRef.current = true;
    setLoadingState("generating");
    const checkShouldStop = () => {
      if (!isImpersonatingRef.current) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        throw new Error("Impersonation stopped");
      }
    };
    try {
      const userProfileData = personaData || impostorProfile;
      let exchanges = 0;

      // Find starting message and determine who goes first
      let startingMessage;
      if (
        startFromMessageIndex !== undefined &&
        startFromMessageIndex >= 0 &&
        startFromMessageIndex < currentContext.messages.length
      ) {
        startingMessage = currentContext.messages[startFromMessageIndex];
      } else {
        startingMessage = [...currentContext.messages]
          .reverse()
          .find((m) => m.text && m.text.trim() !== "");
      }

      let lastMessage = startingMessage ? startingMessage.text : "";
      let currentTurnType: "therapist" | "impostor";

      // Determine who should start the conversation
      // For new conversations (no previous messages), always start with impostor
      const hasPreviousMessages = currentContext.messages.some(
        (m) => m.text && m.text.trim() !== ""
      );
      if (!hasPreviousMessages) {
        currentTurnType = "impostor"; // Impostor starts first in new conversations
        console.log(
          "[CONVERSATION CONTROL] New conversation detected - impostor will start first"
        );
      } else if (
        lastImpersonationSender === "user" ||
        lastImpersonationSender === null
      ) {
        currentTurnType = "therapist";
      } else {
        currentTurnType = "impostor";
      }

      console.log(
        `[CONVERSATION CONTROL] Starting conversation with ${currentTurnType} turn (lastSender: ${lastImpersonationSender}, hasPreviousMessages: ${hasPreviousMessages})`
      );

      console.log(
        `[CONVERSATION CONTROL] Starting conversation with ${currentTurnType} turn`
      );

      // Controlled conversation loop with proper state management
      while (
        exchanges < impersonateMaxExchanges &&
        isImpersonatingRef.current &&
        !isProcessingTurn
      ) {
        checkShouldStop();

        console.log(
          `[CONVERSATION CONTROL] Exchange ${exchanges + 1}/${impersonateMaxExchanges}, ${currentTurnType}'s turn`
        );

        try {
          // Execute the current turn with proper control
          const result = await executeConversationTurn(
            currentTurnType,
            lastMessage,
            userProfileData
          );

          // Check if impersonation was stopped during streaming
          if (!isImpersonatingRef.current) {
            console.log(
              "[CONVERSATION CONTROL] Conversation stopped during streaming, exiting gracefully"
            );
            break;
          }

          // Check for repetitive responses to prevent loops
          const recentResponses = currentContext.messages
            .slice(-4)
            .filter(
              (m) =>
                m.sender ===
                (currentTurnType === "therapist" ? "ai" : "impostor")
            )
            .map((m) => m.text.trim());

          const isRepetitive =
            recentResponses.length >= 3 &&
            recentResponses.every(
              (resp) =>
                resp === result.response.trim() ||
                (resp.length > 50 &&
                  result.response.trim().length > 50 &&
                  resp.substring(0, 50) ===
                    result.response.trim().substring(0, 50))
            );

          if (isRepetitive) {
            console.warn(
              `[CONVERSATION CONTROL] Detected repetitive ${currentTurnType} response, ending conversation`
            );
            setConversationCompleted(true);
            setCompletionReason(
              "Conversation became repetitive - ending gracefully"
            );
            break;
          }

          // Update for next iteration
          lastMessage = result.response;
          currentTurnType = result.nextTurn;
          exchanges++;

          // Evaluate conversation quality after each automated turn
          evaluateConversationQuality(
            currentContext.messages,
            conversationPhase,
            turnCount + exchanges
          );

          // Check for conversation completion after each turn
          const completionCheck = detectConversationCompletion(
            currentContext.messages,
            conversationPhase,
            turnCount + exchanges
          );

          if (completionCheck.completed) {
            console.log(
              `[CONVERSATION CONTROL] Conversation completed: ${completionCheck.reason}`
            );
            setConversationCompleted(true);
            setCompletionReason(completionCheck.reason);
            break; // Exit the conversation loop
          }

          // Add a small delay between turns to prevent race conditions
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Update thread activity
          if (typeof onThreadActivity === "function" && selectedThreadId) {
            onThreadActivity(selectedThreadId);
          }
        } catch (error) {
          if ((error as Error).message === "Impersonation stopped") {
            console.log("[CONVERSATION CONTROL] Conversation stopped by user");
            break;
          }
          console.error(
            `[CONVERSATION CONTROL] Error in ${currentTurnType} turn:`,
            error
          );
          // Try to continue with the next turn
          currentTurnType =
            currentTurnType === "therapist" ? "impostor" : "therapist";
        }
      }

      console.log(
        `[CONVERSATION CONTROL] Conversation completed after ${exchanges} exchanges`
      );
    } catch (error) {
      if ((error as Error).message !== "Impersonation stopped") {
        console.error("Error during impersonation:", error);
        toast.error("Failed to continue impersonation");
      }
    } finally {
      setLoadingState("idle");
      setIsImpersonating(false);
      isImpersonatingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Clean up temp/empty impersonate messages after stopping
      cleanUpImpersonateTempMessages(currentContext.messages, (msgs) => {
        clearMessages();
        msgs.forEach((msg) => addMessage(msg));
      });
    }
  };

  const handleStopImpersonation = async () => {
    console.log(
      "[CONVERSATION CONTROL] Stop requested, current turn:",
      currentTurn,
      "loadingState:",
      loadingState
    );

    // If we're currently streaming, let it complete naturally but stop the conversation loop
    if (loadingState === "streaming" || isProcessingTurn) {
      console.log(
        "[CONVERSATION CONTROL] Stop requested during streaming - will let current response complete"
      );
      setIsImpersonating(false);
      isImpersonatingRef.current = false;
      // Don't abort the controller - let the current streaming complete
      return;
    }

    // If we're not streaming, stop immediately
    performStop();
  };

  const performStop = async () => {
    setIsImpersonating(false);
    isImpersonatingRef.current = false;

    // Check what turn we're currently in before stopping
    const currentTurnType = conversationTurnRef.current;
    console.log(
      "[CONVERSATION CONTROL] Stopping during turn:",
      currentTurnType
    );

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Check if we're stopping during an incomplete response
    const lastMessage =
      currentContext.messages[currentContext.messages.length - 1];
    const wasTherapistInterrupted =
      lastMessage &&
      lastMessage.sender === "ai" &&
      (!lastMessage.text || lastMessage.text.trim() === "");
    const wasImpostorInterrupted =
      lastMessage &&
      lastMessage.sender === "impostor" &&
      (!lastMessage.text || lastMessage.text.trim() === "");

    // Only clean up truly empty messages, preserve partial responses
    const filteredMessages = currentContext.messages.filter(
      (m) =>
        !(
          m.contextId === "impersonate" &&
          (!m.text || m.text.trim() === "" || m.text.trim().length < 3)
        )
    );

    if (filteredMessages.length !== currentContext.messages.length) {
      console.log(
        "[CONVERSATION CONTROL] Cleaning up",
        currentContext.messages.length - filteredMessages.length,
        "empty messages"
      );
      clearMessages();
      filteredMessages.forEach((msg) => addMessage(msg));
    }

    // Update the last sender based on the cleaned messages and current turn
    const cleanedMessages = currentContext.messages.filter(
      (m) =>
        !(m.contextId === "impersonate" && (!m.text || m.text.trim() === ""))
    );
    const lastValidMessage = cleanedMessages[cleanedMessages.length - 1];

    if (lastValidMessage) {
      let nextSender = lastValidMessage.sender;

      // If we interrupted a specific turn, the OTHER should go next
      if (wasTherapistInterrupted || currentTurnType === "therapist") {
        // Therapist was interrupted, so therapist should continue when restarted
        nextSender = "user"; // "user" means therapist's turn in our logic
        console.log(
          "[CONVERSATION CONTROL] Therapist was interrupted, setting therapist's turn"
        );
      } else if (wasImpostorInterrupted || currentTurnType === "impostor") {
        // Impostor was interrupted, so therapist should go next
        nextSender = "user"; // "user" means therapist's turn in our logic
        console.log(
          "[CONVERSATION CONTROL] Impostor was interrupted, setting therapist's turn"
        );
      }

      setLastImpersonationSender(nextSender);
      console.log(
        "[CONVERSATION CONTROL] Updated lastSender to:",
        nextSender,
        "(currentTurn:",
        currentTurnType,
        ")"
      );
    }

    // Reset conversation control state
    setIsProcessingTurn(false);
    setCurrentTurn(null);
    conversationTurnRef.current = null;
  };
  // Get the correct initial form for the current session
  const currentSessionInitialForm = selectedThreadId
    ? getInitialForm(selectedThreadId)
    : currentContext.initialForm;
  return (
    <div className="flex flex-col min-h-screen h-full bg-gradient-to-br from-gray-50/50 via-white to-indigo-50/30 md:max-w-5xl md:mx-auto md:py-8 py-0 w-full max-w-full flex-1 relative">
      {/* Header */}
      <header className="relative overflow-hidden bg-white/90 backdrop-blur-sm border-b border-gray-200/60">
        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <Brain size={24} className="text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm">
                <div className="w-full h-full bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  AI Impersonation
                </h1>
                <div className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  Therapist & Patient
                </div>
                {isImpersonating && (
                  <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full animate-pulse">
                    {lastImpersonationSender === "user" ||
                    lastImpersonationSender === null
                      ? "Therapist Turn"
                      : "Impostor Turn"}
                  </div>
                )}
                <div
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    conversationPhase === "diagnosis"
                      ? "bg-blue-100 text-blue-700"
                      : conversationPhase === "story_development"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {conversationPhase === "diagnosis"
                    ? "Phase 1: Diagnosis"
                    : conversationPhase === "story_development"
                      ? "Phase 2: Stories"
                      : "Phase 3: Resolution"}{" "}
                  (Turn {turnCount})
                </div>
                {conversationCompleted && (
                  <div className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    ✅ Conversation Complete
                  </div>
                )}
                {isProcessingTurn && (
                  <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full animate-pulse">
                    {currentTurn === "therapist"
                      ? "Therapist Speaking..."
                      : "Impostor Speaking..."}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Interactive role-playing for therapeutic scenarios
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setConversationPreferences({
                  ...preferences,
                  podcastMode: !preferences?.podcastMode,
                })
              }
              className={`p-2 rounded-lg transition-colors ${
                preferences?.podcastMode
                  ? "text-purple-600 bg-purple-100/50 hover:bg-purple-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
              }`}
              title={
                preferences?.podcastMode
                  ? "Switch to Chat View"
                  : "Switch to Podcast View"
              }
            >
              {preferences?.podcastMode ? (
                <MessageSquare size={20} />
              ) : (
                <Radio size={20} />
              )}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 p-2 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>
      {/* Main Content Area with enhanced styling */}
      <main className="flex-1 overflow-hidden md:pb-0 w-full flex h-full flex-col relative bg-white/60 backdrop-blur-sm md:rounded-b-2xl md:border-x md:border-b border-gray-200/60 md:shadow-lg">
        <Suspense fallback={<EnhancedLoadingFallback />}>
          {/* Chat Interface or Podcast Player */}
          <div className="flex-1 flex flex-col h-full">
            {preferences?.podcastMode ? (
              <PodcastPlayer
                messages={currentContext.messages}
                isPlaying={isImpersonating}
                isImpersonating={isImpersonating}
                preferences={preferences}
                onStartImpersonation={handleStartImpersonation}
                onStopImpersonation={handleStopImpersonation}
                onSkipToMessage={(index) => {
                  // For now, this would need to be implemented to jump to specific messages
                  console.log("Skip to message:", index);
                }}
                onSettingsClick={() => setIsSettingsOpen(true)}
                onPreferencesChange={setConversationPreferences}
              />
            ) : (
              <ChatInterface
                messages={currentContext.messages}
                onSendMessage={onSendMessage || handleSendMessage}
                loadingState={loadingState}
                inputVisible={false}
                isImpersonateMode={true}
                onStartImpersonation={handleStartImpersonation}
                onStopImpersonation={handleStopImpersonation}
                isImpersonating={isImpersonating}
                voiceId={preferences?.therapistVoiceId}
                preferences={preferences}
                onFeedbackSubmit={submitResponseFeedback}
              />
            )}
          </div>
        </Suspense>
        {/* Custom input for impersonate/chat mode - hidden in podcast view */}
        {!preferences?.podcastMode && (
          <ImpersonateInput
            mode={mode}
            onModeChange={setMode}
            isImpersonating={isImpersonating}
            onStart={handleStartImpersonation}
            onStop={handleStopImpersonation}
            onSendMessage={handleSendMessage}
            disabled={
              (mode !== "impersonate" && loadingState !== "idle") ||
              (mode === "impersonate" && !selectedThreadId) // Disable if no thread selected in impersonate mode
            }
            hideModeSwitch={false} // Show switch on impersonate page
          />
        )}
      </main>
      {/* Subtle background pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.3) 1px, transparent 0)`,
            backgroundSize: "20px 20px",
          }}
        ></div>
      </div>
      {/* Settings Dialog */}
      <ThreadSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedThreadId={selectedThreadId}
        threadTitle={threadData?.sessionName || `Thread #${selectedThreadId}`}
        preferences={preferences || conversationPreferences}
        onPreferencesChange={onPreferencesChange || setConversationPreferences}
        context="impersonate"
      />

      {/* Conversation Dev Tools */}
      <ConversationDevTools
        threadId={selectedThreadId}
        personaName={threadData?.sessionName || personaData?.name}
      />
    </div>
  );
}
export default memo(ImpersonateThread);
