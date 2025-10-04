import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { impersonateChatApi, impostorApi, impersonateObserverApi } from "@/lib/client";
import { useImpostorProfile, useUserProfile, usePersona } from "@/lib/queries/user";
import {
  cleanUpImpersonateTempMessages,
  convertRawMessagesToMessages,
  getPreferencesInstruction,
  processStreamingResponse,
  sanitizeInitialForm,
} from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import { Brain, Loader2, Settings, Radio, MessageSquare } from "lucide-react";
import { memo, Suspense, useCallback, useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { ImpersonateInput } from "./ImpersonateInput";
import { MessageFormattingUtils, StreamingMessageProcessor } from "@/lib/messageFormatter";
import { ThreadSettingsDialog } from "./ThreadSettingsDialog";
import { PodcastPlayer } from "./PodcastPlayer";
import { ConversationDevTools } from "./ConversationDevTools";
import { conversationLogger } from "@/lib/conversationLogger";
import textToSpeech from "@/services/elevenlabs/textToSpeech";
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
  const [currentTurn, setCurrentTurn] = useState<"therapist" | "impostor" | null>(null);
  const conversationTurnRef = useRef<"therapist" | "impostor" | null>(null);
  
  // Additional state for observer and conversation tracking
  const [agentStrategy, setAgentStrategy] = useState("");
  const [agentRationale, setAgentRationale] = useState("");
  const [agentNextSteps, setAgentNextSteps] = useState<string[]>([]);
  const [lastImpersonationSender, setLastImpersonationSender] = useState<"user" | "ai" | null>(null);
  
  // Conversation state tracking for loop detection
  const [conversationThemes, setConversationThemes] = useState<Set<string>>(new Set());
  const [repetitionCount, setRepetitionCount] = useState<Map<string, number>>(new Map());
  const [lastIntervention, setLastIntervention] = useState<number>(0);
  
  // Story-driven conversation phases
  const [conversationPhase, setConversationPhase] = useState<"diagnosis" | "story_development" | "resolution">("diagnosis");
  const [turnCount, setTurnCount] = useState(0);
  const [sharedStories, setSharedStories] = useState<string[]>([]);
  const [resolutionElements, setResolutionElements] = useState<string[]>([]);

  // Conversation completion detection
  const [conversationCompleted, setConversationCompleted] = useState(false);
  const [completionReason, setCompletionReason] = useState<string>("");
  
  // TTS function for generating audio from text
  const generateTTS = async (text: string, voiceId: string, modelId?: string) => {
    if (!conversationPreferences.enableTTS) return;
    try {
      const shouldAutoPlay = conversationPreferences.ttsAutoPlay ?? false;
      const audioUrl = await textToSpeech(text, voiceId, shouldAutoPlay, modelId);
      // The audio will autoplay from the textToSpeech function if auto-play is enabled
      console.log("TTS generated for voice:", voiceId, "model:", modelId, "autoPlay:", shouldAutoPlay);
    } catch (error) {
      console.error("TTS generation failed:", error);
      // Don't show error toast as it might interrupt the conversation
    }
  };


  // Helper function to fetch thread initial form data
  const fetchThreadInitialForm = async (threadId: number) => {
    try {
      // For impersonate threads, fetch from impostor API
      const response = await fetch(
        `/api/impostor/threads/${threadId}`
      );
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
      "walking on eggshells", "exhausting", "draining", "tiring",
      "it sounds like", "that must feel", "it's like", "it's understandable",
      "i guess", "honestly", "it's just"
    ];
    
    recentMessages.forEach(msg => {
      const text = msg.text.toLowerCase();
      
      // Track repetitive phrases
      repetitivePhrases.forEach(phrase => {
        if (text.includes(phrase)) {
          const count = repetitions.get(phrase) || 0;
          repetitions.set(phrase, count + 1);
        }
      });
      
      // Extract themes (simplified)
      if (text.includes("family") || text.includes("parents") || text.includes("brother")) {
        themes.add("family conflict");
      }
      if (text.includes("exhaust") || text.includes("tired") || text.includes("drain")) {
        themes.add("exhaustion");
      }
      if (text.includes("argu") || text.includes("fight") || text.includes("bicker")) {
        themes.add("arguments");
      }
    });
    
    // Check for loops
    const hasLoop = Array.from(repetitions.values()).some(count => count >= 2);
    const themeRepetition = themes.size <= 2 && recentMessages.length >= 4; // Stuck on same themes
    
    return {
      hasLoop,
      themeRepetition,
      repetitions: Object.fromEntries(repetitions),
      themes: Array.from(themes),
      needsIntervention: hasLoop || themeRepetition
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
      const hasFamilyMentions = background.toLowerCase().includes('family') || background.toLowerCase().includes('parents') || background.toLowerCase().includes('mother') || background.toLowerCase().includes('father');
      const hasWorkMentions = background.toLowerCase().includes('work') || background.toLowerCase().includes('job') || background.toLowerCase().includes('career') || background.toLowerCase().includes('startup');
      const hasRelationshipMentions = background.toLowerCase().includes('partner') || background.toLowerCase().includes('relationship') || background.toLowerCase().includes('friend');
      const hasChildhoodMentions = background.toLowerCase().includes('childhood') || background.toLowerCase().includes('grew up') || background.toLowerCase().includes('young');

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
          `If you could give your younger self advice about dealing with ${problemDescription.toLowerCase().split(' ').slice(0, 3).join(' ')}, what would you say?`
        ];
      }
    return [];
  };

  // Helper function to detect conversation completion
  const detectConversationCompletion = (messages: Message[], currentPhase: string, turnCount: number): { completed: boolean; reason: string } => {
    if (turnCount < 8) return { completed: false, reason: "" }; // Need minimum turns

    const recentMessages = messages.slice(-4); // Last 4 exchanges
    const impostorMessages = recentMessages.filter(m => m.sender === "impostor");

    if (impostorMessages.length < 2) return { completed: false, reason: "" };

    // Check for resolution indicators in recent impostor messages
    const resolutionIndicators = [
      "feel hopeful", "things will be different", "learned from this", "moving forward",
      "feel better", "see a path", "grateful for", "proud of myself", "stronger now",
      "different approach", "new perspective", "growth", "healing", "progress",
      "looking forward", "excited about", "confident that", "believe in myself"
    ];

    const hopeIndicators = [
      "hope", "future", "tomorrow", "next week", "next month", "six months",
      "year from now", "imagine", "picture", "envision", "see myself"
    ];

    let resolutionScore = 0;
    let hopeScore = 0;

    impostorMessages.forEach(msg => {
      const text = msg.text.toLowerCase();

      // Count resolution indicators
      resolutionIndicators.forEach(indicator => {
        if (text.includes(indicator)) resolutionScore++;
      });

      // Count hope indicators
      hopeIndicators.forEach(indicator => {
        if (text.includes(indicator)) hopeScore++;
      });
    });

    // Check for explicit completion signals
    const completionSignals = [
      "i think that helps", "i feel better", "that makes sense", "thank you for listening",
      "i've got what i needed", "that was helpful", "i feel understood", "i can work with this"
    ];

    const hasCompletionSignal = recentMessages.some(msg =>
      completionSignals.some(signal => msg.text.toLowerCase().includes(signal))
    );

    // Completion conditions
    const hasEnoughResolution = resolutionScore >= 2;
    const hasEnoughHope = hopeScore >= 2;
    const inResolutionPhase = currentPhase === "resolution";
    const sufficientTurns = turnCount >= 10;

    if (hasCompletionSignal && (hasEnoughResolution || hasEnoughHope)) {
      return { completed: true, reason: "Natural completion with resolution indicators" };
    }

    if (inResolutionPhase && sufficientTurns && (hasEnoughResolution || hasEnoughHope)) {
      return { completed: true, reason: "Resolution phase completed with hope elements" };
    }

    if (turnCount >= 12 && (resolutionScore >= 3 || hopeScore >= 3)) {
      return { completed: true, reason: "Extended conversation reached resolution" };
    }

    return { completed: false, reason: "" };
  };

  // Helper function to control conversation flow with proper state management
   const executeConversationTurn = async (
     turnType: "therapist" | "impostor",
     lastMessage: string,
     userProfileData: any
   ): Promise<{ response: string; nextTurn: "therapist" | "impostor" }> => {
     console.log(`[CONVERSATION CONTROL] Starting ${turnType} turn with message: "${lastMessage.substring(0, 50)}..."`);
     
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
           const loopAnalysis = analyzeConversationForLoops(currentContext.messages);
           console.log("[LOOP DETECTION]", loopAnalysis);

           // Check if therapist is using banned phrases in recent responses
           const recentTherapistMessages = currentContext.messages.filter(m => m.sender === "ai").slice(-2);
           const therapistUsingBannedPhrases = recentTherapistMessages.some(msg => {
             const text = msg.text.toLowerCase();
             return ["it sounds like", "that must feel", "heavy load", "draining", "exhausting", "overwhelming", "understandable", "takes courage", "incredibly draining"].some(phrase =>
               text.includes(phrase)
             );
           });

           // Add intervention if needed - enhanced for current loop patterns
           let interventionInstruction = "";
           if ((loopAnalysis.needsIntervention || therapistUsingBannedPhrases) && Date.now() - lastIntervention > 30000) { // Max once per 30 seconds
             interventionInstruction = `
               🚨 CRITICAL LOOP DETECTED - IMMEDIATE INTERVENTION REQUIRED:

               CURRENT LOOP PATTERN: ${therapistUsingBannedPhrases ? 'THERAPIST IS USING BANNED PHRASES + ' : ''}Client repeatedly describes feeling "drained", "stuck", "overwhelming", "tired" without specific stories or examples.

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
            const messagesForObserver = currentContext.messages.slice(-5).map(msg => ({
              text: msg.text,
              sender: msg.sender === "ai" ? "ai" : "user"
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
            if (therapistVoiceId?.includes("adam") || therapistVoiceId?.includes("male")) {
              voiceInstructions = `
                VOICE STYLE: You are speaking with a calm, warm male voice.
                - Use a slightly deeper, more measured pace
                - Be reassuring and steady, like a compassionate male therapist
                - Use phrases like "I understand," "Let's work through this," "I'm here to help"
                - Tone should be supportive and grounding
                - Avoid overly emotional language - be the stable presence
              `;
            } else if (therapistVoiceId?.includes("rachel") || therapistVoiceId?.includes("bella") || therapistVoiceId?.includes("female")) {
              voiceInstructions = `
                VOICE STYLE: You are speaking with a warm, empathetic female voice.
                - Use a gentle, nurturing tone
                - Be more expressive in your empathy
                - Use phrases like "I hear you," "That sounds so difficult," "You're doing great"
                - Tone should be warm and validating
                - Can be more emotionally expressive and comforting
              `;
            } else if (therapistVoiceId?.includes("sam") || therapistVoiceId?.includes("androgynous")) {
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
             const storyPrompts = generateStoryPrompts(userProfileData, conversationPhase);
             
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
                 
                 GOALS: Share specific stories, explore emotional depth, create narrative richness
                 
                 STORY PROMPTS TO USE:
                 ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n                 ')}
                 
                 NARRATIVE TECHNIQUES:
                 - "Paint me a picture of that moment. What did you see, hear, feel?"
                 - "Tell me the story of what happened, from beginning to end."
                 - "What was the dialogue in that situation? What did you say vs. what you thought?"
                 - "How did that story change you or your perspective?"
                 
                 FOCUS AREAS:
                 - Extract detailed, specific stories from their background
                 - Explore the emotional impact of these experiences
                 - Connect stories to their current struggles
                 - Identify patterns and themes in their narratives
                 - Build a rich tapestry of their life experience
                 
                 EXAMPLE RESPONSES:
                 "Tell me a specific story from your childhood that shaped how you approach challenges today."
                 "Paint me a picture of the most recent time this happened. What were the specific details?"
                 "What's the story behind that relationship? How did it evolve over time?"
               `;
             } else {
               return `
                 PHASE 3: RESOLUTION & HOPE (Turns 9-12)
                 
                 GOALS: Problem-solving, breakthrough moments, happy ending development
                 
                 RESOLUTION PROMPTS:
                 ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n                 ')}
                 
                 SOLUTION-FOCUSED TECHNIQUES:
                 - "Imagine your life six months from now. What's different?"
                 - "Tell me about a time you felt proud of how you handled a similar situation."
                 - "What would your future self, who has overcome this, tell you today?"
                 - "What's one small step you could take this week that would move you forward?"
                 
                 FOCUS AREAS:
                 - Co-create solutions and strategies
                 - Highlight strengths and resources they already have
                 - Develop a hopeful vision for the future
                 - Create concrete action steps
                 - Ensure the conversation ends with empowerment and hope
                 
                 HAPPY ENDING ELEMENTS:
                 - Specific positive changes they've made
                 - New coping strategies they've discovered
                 - Improved relationships or situations
                 - A clear vision for their continued growth
                 - Feelings of hope, capability, and optimism
                 
                 EXAMPLE RESPONSES:
                 "Tell me about a moment recently when you felt hopeful or proud of your progress."
                 "Paint a picture of your life a year from now, having worked through this challenge."
                 "What strengths have you discovered in yourself through this process?"
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
             PERSONA: ${userProfileData?.fullName || 'Unknown'}, Age ${userProfileData?.age || 'Unknown'}
             BACKGROUND: ${userProfileData?.background || 'Not specified'}
             PROBLEM: ${userProfileData?.problemDescription || 'Not specified'}
             
             ${getTherapistVoiceInstructions()}
           `;
          
          const therapistResponse = await impersonateChatApi.sendMessage({
            message: lastMessage,
            threadId: selectedThreadId!,
            userId: String(userProfile.id),
            sender: "therapist",
            signal: abortController.signal,
            context: contextData,
            ...(observerStrategy ? { systemInstruction: observerStrategy } : {}),
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
             console.log("[CONVERSATION CONTROL] Impersonation stopped during therapist response - will complete current response");
           }
           
            addMessage(tempAiMessage);
            response = await processStreamingResponse(reader, updateLastMessage);

            // Post-process response to check for banned phrases
            const bannedPhrases = [
              "it sounds like", "that must feel", "heavy load", "draining", "exhausting",
              "overwhelming", "understandable", "takes courage", "incredibly draining",
              "wading through mud", "stuck in mud", "paralyzed", "walking on eggshells"
            ];

            const containsBannedPhrases = bannedPhrases.some(phrase =>
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
              ["walking on eggshells", "navigating carefully"]
            ];

            // Apply replacements to the response
            phraseReplacements.forEach(([banned, replacement]) => {
              const regex = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
              response = response.replace(regex, replacement);
            });

            if (containsBannedPhrases) {
              console.log("[RESPONSE FILTER] Applied banned phrase replacements to automated response");
            }
         }
        
        // Update state
        setLastImpersonationSender("ai");
        console.log(`[CONVERSATION CONTROL] Therapist completed, response length: ${response.length}`);
        
        // Generate TTS
        if (response.trim()) {
          generateTTS(response.trim(), conversationPreferences.therapistVoiceId, conversationPreferences.therapistModel);
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
            if (impostorVoiceId?.includes("adam") || impostorVoiceId?.includes("male")) {
              voiceInstructions = `
                VOICE STYLE: You are speaking with a male voice that may sound tense, anxious, or struggling.
                - Use a slightly hesitant or measured pace when discussing difficult topics
                - Be more reserved emotionally, typical of men sharing vulnerability
                - Use phrases like "I guess," "It's just that," "I don't know how to explain it"
                - Can be more direct and less emotionally expressive
                - Show vulnerability through careful word choice rather than emotional language
                - Sound like someone who's trying to open up but finds it difficult
              `;
            } else if (impostorVoiceId?.includes("rachel") || impostorVoiceId?.includes("bella") || impostorVoiceId?.includes("female")) {
              voiceInstructions = `
                VOICE STYLE: You are speaking with a female voice that may sound emotional, worried, or overwhelmed.
                - Use a more expressive and emotional tone
                - Be comfortable sharing feelings and vulnerabilities
                - Use phrases like "I just feel so..." "It's overwhelming when..." "I can't help but think..."
                - Show emotion through your word choice and pacing
                - Can be more open about fears and anxieties
                - Sound like someone who processes emotions verbally
              `;
            } else if (impostorVoiceId?.includes("sam") || impostorVoiceId?.includes("androgynous")) {
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
          
           // Check for conversational loops before proceeding
           if (detectConversationalLoop()) {
             console.log("[LOOP DETECTION] Conversational loop detected, applying intervention");
             
             const interventionMsg: Message = {
               sender: "impostor",
               text: "You know what? I realize I've been repeating myself. Let me be more specific. Yesterday at 2:30 PM, during the budget review meeting, my heart was racing so fast I could feel it in my throat when my director asked me to present the Q3 projections. I had to grip the table to stop my hands from shaking, and I could barely read my own notes. That's the kind of specific moment that's been happening almost daily.",
               timestamp: new Date(),
               contextId: "impersonate",
             };
             addMessage(interventionMsg);
             setLastImpersonationSender("impostor");
             
             return {
               response: interventionMsg.text,
               nextTurn: "therapist",
             };
           }

            // Story-driven persona instructions based on conversation phase
            const getPersonaPhaseInstructions = () => {
              const storyPrompts = generateStoryPrompts(userProfileData, conversationPhase);
              
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
                  ${userProfileData?.background ? `Background: ${userProfileData.background}` : ''}
                  ${userProfileData?.problemDescription ? `Problem: ${userProfileData.problemDescription}` : ''}
                  ${userProfileData?.personality ? `Personality: ${userProfileData.personality}` : ''}
                  
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
                  ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n                  ')}
                  
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
                  ${storyPrompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n                  ')}
                  
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
               PERSONA: ${userProfileData?.fullName || 'Unknown'}, Age ${userProfileData?.age || 'Unknown'}
               BACKGROUND: ${userProfileData?.background || 'Not specified'}
               PROBLEM: ${userProfileData?.problemDescription || 'Not specified'}
               PERSONALITY: ${userProfileData?.personality || 'Not specified'}

               STORIES SHARED SO FAR: ${sharedStories.join(', ') || 'None'}
               RESOLUTION ELEMENTS: ${resolutionElements.join(', ') || 'None yet'}

               ${getImpostorVoiceInstructions()}
             `;
          
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
             console.log("[CONVERSATION CONTROL] Impersonation stopped during impostor response - will complete current response");
           }
           
           addMessage(tempImpostorMessage);
           response = await processStreamingResponse(reader, updateLastMessage);
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
        
         // Track stories and resolution elements
         if (response.trim()) {
           if (conversationPhase === "story_development") {
             setSharedStories(prev => [...prev, response.substring(0, 50) + "..."]);
           } else if (conversationPhase === "resolution") {
             setResolutionElements(prev => [...prev, response.substring(0, 50) + "..."]);
           }
         }
         
         // Update state
         setLastImpersonationSender("user");
         console.log(`[CONVERSATION CONTROL] Impostor completed, response length: ${response.length}`);
         
         // Generate TTS
         if (response.trim()) {
           generateTTS(response.trim(), conversationPreferences.impostorVoiceId, conversationPreferences.impostorModel);
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
          const threadResponse = await fetch(`/api/impostor/threads/${selectedThreadId}`);
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
           const contextData = currentContext.messages.slice(0, -1).map((msg) => ({ // Exclude the last message to avoid duplication
             role: msg.sender === "ai" ? "model" : "user",
             text: msg.text,
             timestamp: msg.timestamp.getTime(),
             ...(msg.contextId ? { contextId: msg.contextId } : {}),
           }));

            console.log("[THERAPIST CALL] contextData length:", contextData.length);
            console.log("[THERAPIST CALL] lastMessage:", lastMessage);
            console.log("[THERAPIST CALL] currentContext.messages length:", currentContext.messages.length);
            console.log("[THERAPIST CALL] last message in context:", currentContext.messages[currentContext.messages.length - 1]?.text?.substring(0, 50));
            console.log("[THERAPIST CALL] full context messages:", currentContext.messages.map(m => ({ sender: m.sender, text: m.text.substring(0, 30) + "..." })));
       // Apply story-driven instructions even for manual messages
       const currentPhase = conversationPhase;
       const currentTurnCount = turnCount;
       
        const getManualTherapistInstructions = () => {
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
         
          if (currentPhase === "diagnosis") {
            return `
              ${bannedPhrases}

              PHASE 1: DIAGNOSIS & CONNECTION (Turn ${currentTurnCount + 1})

              🎯 PRIMARY OBJECTIVE: BREAK THE VAGUE FEELINGS LOOP
              The client is stuck describing feelings like "drained", "stuck", "overwhelming" without specifics.
              Your job is to IMMEDIATELY pivot to concrete examples and stories.

              REQUIRED APPROACH:
              1. Acknowledge briefly (1 sentence max)
              2. IMMEDIATELY ask for a SPECIFIC STORY or EXAMPLE
              3. Focus on WHEN, WHERE, WHO, WHAT happened

              FORBIDDEN: Generic empathy responses like "That sounds difficult" or "I understand"
              REQUIRED: Story-extraction questions like "Tell me about a time when..." or "What's an example of..."

              ALTERNATIVE PHRASES (USE THESE INSTEAD):
              - "Help me understand what that's like for you..."
              - "Tell me more about your experience with that..."
              - "What's your perspective on this situation?"
              - "How did that affect you personally?"
              - "What was going through your mind at the time?"

              SPECIFIC STORY PROMPTS TO USE:
              - "Can you tell me about a recent time when you felt this way?"
              - "What's an example of when this started feeling worse?"
              - "Tell me about your typical day - what happens that makes it hard?"
              - "Who have you talked to about this, and what did they say?"

              CURRENT LOOP DETECTED: Client keeps saying they're "drained", "stuck", "tired" without specifics
              BREAK THE LOOP: Force them to tell a specific story from their life
            `;
          } else if (currentPhase === "story_development") {
            return `
              ${bannedPhrases}

              PHASE 2: STORY DEVELOPMENT & EXPLORATION (Turn ${currentTurnCount + 1})

              🎯 PRIMARY OBJECTIVE: EXTRACT RICH, DETAILED STORIES
              The client has been giving vague descriptions. Now you MUST get specific, vivid stories.

              STORY EXTRACTION PROTOCOL:
              1. Choose ONE story prompt per response
              2. Ask for sensory details: sights, sounds, smells, physical sensations
              3. Ask for dialogue: exact words spoken
              4. Ask for internal experience: thoughts, feelings moment-by-moment
              5. Ask for context: time, place, people, circumstances

              REQUIRED STORY ELEMENTS (Must include at least 3):
              - Specific time period ("Last Tuesday at 3pm")
              - Physical location ("In the break room at work")
              - People involved ("My boss and two colleagues")
              - Sensory details ("The fluorescent lights were buzzing")
              - Dialogue ("He said 'We need this done by Friday'")
              - Internal thoughts ("I thought 'I can't handle this'")
              - Physical sensations ("My heart started racing")

              FORBIDDEN: Vague questions like "How do you feel about that?"
              REQUIRED: Specific prompts like "Paint me a picture of that meeting - what did you see, hear, and feel?"

              STORY PROMPTS TO ROTATE THROUGH:
              - "Tell me the story of the last time this happened. Start from the beginning and walk me through each moment."
              - "Paint me a detailed picture of a typical day when you're struggling. What happens from morning to night?"
              - "Share a specific memory from your past that feels connected to this. Make it vivid with details."
              - "Tell me about an interaction with someone close to you that shows this pattern. Include the exact conversation."
              - "Describe a time you tried to break this cycle. What did you do, and what happened next?"

              SUCCESS CRITERIA: Response should contain at least 150 words of specific story details
            `;
          } else {
            return `
              ${bannedPhrases}

              PHASE 3: RESOLUTION & HOPE (Turn ${currentTurnCount + 1})

              🎯 PRIMARY OBJECTIVE: BUILD HOPE AND CONCRETE SOLUTIONS
              The client has shared their stories. Now focus on strength, hope, and actionable change.

              RESOLUTION FRAMEWORK:
              1. Highlight existing strengths they've demonstrated
              2. Identify small wins and successes they've had
              3. Co-create specific, actionable next steps
              4. Paint a vivid picture of positive change
              5. End with empowerment and hope

              REQUIRED ELEMENTS (Include at least 2 per response):
              - Specific strength identification ("You've shown real resilience by...")
              - Concrete action step ("This week, try...")
              - Hopeful vision ("Imagine feeling...")
              - Resource identification ("You have support from...")
              - Success prediction ("When you try this, you'll likely...")

              SOLUTION-FOCUSED QUESTIONS:
              - "What's one small thing you've already done that helped, even a little?"
              - "Who in your life has been supportive, and how can you lean on them more?"
              - "If you could try one new approach this week, what would it be?"
              - "What's a time in your past when you successfully handled something difficult?"
              - "Imagine three months from now - what's one thing you'd be proud of accomplishing?"

              FORBIDDEN: Vague encouragement like "Things will get better"
              REQUIRED: Specific hope like "When you try calling a friend each day, you'll likely feel more connected"

              CONVERSATION ENDING CRITERIA:
              - Client shows signs of hope and agency
              - Specific action steps have been identified
              - Strengths have been acknowledged
              - Future vision includes positive change

              SUCCESS MARKERS: Client expresses hope, identifies next steps, acknowledges their own strength
            `;
          }
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
          const errorText = MessageFormattingUtils.extractErrorMessage(error.message);
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
          // Response filtering: Replace banned phrases with approved alternatives
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
            ["that sounds really challenging", "help me understand what that's like"],
            ["it's completely understandable", "many people feel this way"],
            ["it sounds incredibly draining", "that seems particularly depleting"]
          ];

          // Apply replacements
          phraseReplacements.forEach(([banned, replacement]) => {
            // Use word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            filteredText = filteredText.replace(regex, replacement);
          });

          // Additional pattern replacements for common variations
          filteredText = filteredText.replace(/\bit sounds\b/gi, "help me understand");
          filteredText = filteredText.replace(/\bthat must be\b/gi, "what's that like");
          filteredText = filteredText.replace(/\bso draining\b/gi, "so depleting");
          filteredText = filteredText.replace(/\bso exhausting\b/gi, "so wearying");

          // Check if any significant changes were made
          const hasChanges = filteredText !== finalText;

          if (hasChanges) {
            console.log("[RESPONSE FILTER] Applied banned phrase replacements");
            console.log(`Original: "${finalText.substring(0, 100)}..."`);
            console.log(`Filtered: "${filteredText.substring(0, 100)}..."`);
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
      conversationLogger.logConversation(
        selectedThreadId,
        currentContext.messages,
        threadData?.sessionName || personaData?.name
      );
    }
  }, [currentContext.messages, selectedThreadId, threadData, personaData]);

  // Detect conversational loops and repetitive patterns
  const detectConversationalLoop = (): boolean => {
    const recentMessages = currentContext.messages.slice(-8); // Last 8 messages for better detection
    const therapistMessages = recentMessages.filter(m => m.sender === "ai");

    if (therapistMessages.length < 3) return false;

    // Check for banned repetitive phrases in therapist responses
    const bannedPhrases = [
      "it sounds like", "that must feel", "heavy load", "draining", "exhausting",
      "overwhelming", "understandable", "takes courage", "incredibly draining",
      "stuck in mud", "wading through mud", "paralyzed", "walking on eggshells",
      "heavy is a good word", "that sounds difficult", "i understand", "i hear you"
    ];

    const lastThreeTherapistMessages = therapistMessages.slice(-3);
    const phraseUsage = bannedPhrases.filter(phrase =>
      lastThreeTherapistMessages.some(msg =>
        msg.text.toLowerCase().includes(phrase.toLowerCase())
      )
    );

    // If more than 1 banned phrase used in last 3 therapist messages, it's a loop
    if (phraseUsage.length > 1) return true;
    
    // Check for repetitive sentence patterns
    const sentencePatterns = lastThreeImpostorMessages.map(msg => {
      const sentences = msg.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return sentences.map(s => s.trim().toLowerCase().replace(/\s+/g, ' '));
    });
    
    // Look for similar sentence structures across messages
    let patternMatches = 0;
    for (let i = 0; i < sentencePatterns.length - 1; i++) {
      for (let j = i + 1; j < sentencePatterns.length; j++) {
        const similarities = sentencePatterns[i].filter(s1 => 
          sentencePatterns[j].some(s2 => 
            s1.length > 10 && s2.length > 10 && 
            (s1.includes(s2.substring(0, 10)) || s2.includes(s1.substring(0, 10)))
          )
        );
        if (similarities.length > 0) patternMatches++;
      }
    }
    
    return patternMatches > 2;
  };



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
      if (startFromMessageIndex !== undefined && startFromMessageIndex >= 0 && startFromMessageIndex < currentContext.messages.length) {
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
        const hasPreviousMessages = currentContext.messages.some(m => m.text && m.text.trim() !== "");
        if (!hasPreviousMessages) {
          currentTurnType = "impostor"; // Impostor starts first in new conversations
          console.log("[CONVERSATION CONTROL] New conversation detected - impostor will start first");
        } else if (lastImpersonationSender === "user" || lastImpersonationSender === null) {
         currentTurnType = "therapist";
        } else {
         currentTurnType = "impostor";
        }
         
        console.log(`[CONVERSATION CONTROL] Starting conversation with ${currentTurnType} turn (lastSender: ${lastImpersonationSender}, hasPreviousMessages: ${hasPreviousMessages})`);
      
      console.log(`[CONVERSATION CONTROL] Starting conversation with ${currentTurnType} turn`);
      
       // Controlled conversation loop with proper state management
       while (
         exchanges < impersonateMaxExchanges &&
         isImpersonatingRef.current &&
         !isProcessingTurn
       ) {
         checkShouldStop();
         
         console.log(`[CONVERSATION CONTROL] Exchange ${exchanges + 1}/${impersonateMaxExchanges}, ${currentTurnType}'s turn`);
         
         try {
           // Execute the current turn with proper control
           const result = await executeConversationTurn(
             currentTurnType,
             lastMessage,
             userProfileData
           );
           
           // Check if impersonation was stopped during streaming
           if (!isImpersonatingRef.current) {
             console.log("[CONVERSATION CONTROL] Conversation stopped during streaming, exiting gracefully");
             break;
           }
           
            // Update for next iteration
            lastMessage = result.response;
            currentTurnType = result.nextTurn;
            exchanges++;

            // Check for conversation completion after each turn
            const completionCheck = detectConversationCompletion(
              currentContext.messages,
              conversationPhase,
              turnCount + exchanges
            );

            if (completionCheck.completed) {
              console.log(`[CONVERSATION CONTROL] Conversation completed: ${completionCheck.reason}`);
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
           console.error(`[CONVERSATION CONTROL] Error in ${currentTurnType} turn:`, error);
           // Try to continue with the next turn
           currentTurnType = currentTurnType === "therapist" ? "impostor" : "therapist";
         }
       }
      
      console.log(`[CONVERSATION CONTROL] Conversation completed after ${exchanges} exchanges`);
      
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
    console.log("[CONVERSATION CONTROL] Stop requested, current turn:", currentTurn, "loadingState:", loadingState);
    
    // If we're currently streaming, let it complete naturally but stop the conversation loop
    if (loadingState === "streaming" || isProcessingTurn) {
      console.log("[CONVERSATION CONTROL] Stop requested during streaming - will let current response complete");
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
    console.log("[CONVERSATION CONTROL] Stopping during turn:", currentTurnType);
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Check if we're stopping during an incomplete response
    const lastMessage = currentContext.messages[currentContext.messages.length - 1];
    const wasTherapistInterrupted = lastMessage && 
      lastMessage.sender === "ai" && 
      (!lastMessage.text || lastMessage.text.trim() === "");
    const wasImpostorInterrupted = lastMessage && 
      lastMessage.sender === "impostor" && 
      (!lastMessage.text || lastMessage.text.trim() === "");
    
    // Only clean up truly empty messages, preserve partial responses
    const filteredMessages = currentContext.messages.filter(
      (m) => !(m.contextId === "impersonate" && (!m.text || m.text.trim() === "" || m.text.trim().length < 3))
    );
    
    if (filteredMessages.length !== currentContext.messages.length) {
      console.log("[CONVERSATION CONTROL] Cleaning up", currentContext.messages.length - filteredMessages.length, "empty messages");
      clearMessages();
      filteredMessages.forEach((msg) => addMessage(msg));
    }
    
    // Update the last sender based on the cleaned messages and current turn
    const cleanedMessages = currentContext.messages.filter(
      (m) => !(m.contextId === "impersonate" && (!m.text || m.text.trim() === ""))
    );
    const lastValidMessage = cleanedMessages[cleanedMessages.length - 1];
    
    if (lastValidMessage) {
      let nextSender = lastValidMessage.sender;
      
      // If we interrupted a specific turn, the OTHER should go next
      if (wasTherapistInterrupted || currentTurnType === "therapist") {
        // Therapist was interrupted, so therapist should continue when restarted
        nextSender = "user"; // "user" means therapist's turn in our logic
        console.log("[CONVERSATION CONTROL] Therapist was interrupted, setting therapist's turn");
      } else if (wasImpostorInterrupted || currentTurnType === "impostor") {
        // Impostor was interrupted, so therapist should go next
        nextSender = "user"; // "user" means therapist's turn in our logic
        console.log("[CONVERSATION CONTROL] Impostor was interrupted, setting therapist's turn");
      }
      
      setLastImpersonationSender(nextSender);
      console.log("[CONVERSATION CONTROL] Updated lastSender to:", nextSender, "(currentTurn:", currentTurnType, ")");
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
                    {lastImpersonationSender === "user" || lastImpersonationSender === null ? "Therapist Turn" : "Impostor Turn"}
                  </div>
                )}
                <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                  conversationPhase === "diagnosis" ? "bg-blue-100 text-blue-700" :
                  conversationPhase === "story_development" ? "bg-purple-100 text-purple-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {conversationPhase === "diagnosis" ? "Phase 1: Diagnosis" :
                   conversationPhase === "story_development" ? "Phase 2: Stories" :
                   "Phase 3: Resolution"} (Turn {turnCount})
                </div>
                {conversationCompleted && (
                  <div className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    ✅ Conversation Complete
                  </div>
                )}
                {isProcessingTurn && (
                  <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full animate-pulse">
                    {currentTurn === "therapist" ? "Therapist Speaking..." : "Impostor Speaking..."}
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
               onClick={() => setConversationPreferences({
                 ...preferences,
                 podcastMode: !preferences?.podcastMode
               })}
               className={`p-2 rounded-lg transition-colors ${
                 preferences?.podcastMode
                   ? "text-purple-600 bg-purple-100/50 hover:bg-purple-200/50"
                   : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
               }`}
               title={preferences?.podcastMode ? "Switch to Chat View" : "Switch to Podcast View"}
             >
               {preferences?.podcastMode ? <MessageSquare size={20} /> : <Radio size={20} />}
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
