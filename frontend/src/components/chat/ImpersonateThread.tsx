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
          
          // Add intervention if needed
          let interventionInstruction = "";
          if (loopAnalysis.needsIntervention && Date.now() - lastIntervention > 30000) { // Max once per 30 seconds
            interventionInstruction = `
              CONVERSATION LOOP DETECTED - IMMEDIATE ACTION REQUIRED:
              The conversation is repeating themes/phrases. You MUST:
              1. Use a conversation breaker: "I'm going to shift gears completely here..."
              2. Ask about a completely different aspect of their life
              3. Introduce a new topic: work, friends, hobbies, childhood, future plans
              4. DO NOT acknowledge the loop - just change direction
              
              Current repetitive patterns: ${JSON.stringify(loopAnalysis.repetitions)}
              Current stuck themes: ${loopAnalysis.themes.join(", ")}
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
          
          // AGGRESSIVE anti-lexical-loop therapeutic instructions
          const naturalConversationInstructions = `
            IMMEDIATE RULES - NO EXCEPTIONS:
            
             1. FORBIDDEN PHRASES (NEVER use these):
                - "It sounds like" (BANNED)
                - "That must feel" (BANNED) 
                - "It sounds" (BANNED)
                - "That sounds" (BANNED)
                - "It's like" (BANNED)
                - "It's understandable" (BANNED)
                - "carrying a really heavy load" (BANNED)
                - "heavy load" (BANNED)
                - "carrying" (BANNED - when referring to burdens)
                - "takes courage" (BANNED)
                - "acknowledge you're struggling" (BANNED)
            
            2. MANDATORY RESPONSE PATTERNS (choose ONE each turn):
               A) "Tell me more about the last time that happened..."
               B) "What does that look like specifically when..."
               C) "Can you give me a concrete example of..."
               D) "When you say [their exact words], what does that actually look like in practice?"
               E) "Let's get specific - what happened on the most recent occasion when..."
               F) "I want to understand the mechanics of this - how does [their issue] actually play out?"
            
            3. CONVERSATION BREAKERS (use when conversation loops):
               A) "I'm going to shift gears completely. Let's talk about something that might seem unrelated..."
               B) "You know what I'm curious about? What would happen if you tried the opposite approach?"
               C) "Can we zoom out for a second? What's the bigger pattern here that we might be missing?"
               D) "Let me ask you something completely different that might give us new perspective..."
            
            4. SPECIFICITY FORCERS:
               - Always ask for specific examples, times, places, people
               - Never accept vague descriptions - drill down
               - Use "What exactly..." "How specifically..." "When precisely..."
            
             5. LOOP DETECTION (if you hear yourself repeating):
                - STOP immediately
                - Use a conversation breaker from #3
                - Ask about a completely different aspect of their life
             
             6. ANTI-REPETITION REQUIREMENTS:
                - NEVER use the exact same phrases or metaphors in consecutive responses
                - Track what you've said and avoid repeating it
                - Each response must approach the problem from a different angle
                - Vary your questioning techniques and opening phrases
             
             7. CURRENT SITUATION ANALYSIS:
                They're talking about work pressure, perfectionism, and impact on sleep/focus.
                AVOID: Don't let them keep describing the feeling vaguely
                INSTEAD: Ask for specific work incidents, exact projects, deadlines, performance reviews
             
             EXAMPLE GOOD RESPONSES:
                "You mentioned the pressure is affecting your sleep - tell me about the most recent night this happened. What work-related thoughts were keeping you awake?"
                "When you say 'striving for perfection,' can you give me a specific example from this week? What project were you working on?"
                "You mentioned it's 'taken over your life' - what specific activities have you given up because of work demands?"
            
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
              ? `${observerStrategy} ${interventionInstruction} ${naturalConversationInstructions} ${getPreferencesInstruction(conversationPreferences)}`
              : `${interventionInstruction} ${naturalConversationInstructions} ${getPreferencesInstruction(conversationPreferences)}`,
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

           // AGGRESSIVE anti-lexical-loop persona instructions
           const impostorNaturalInstructions = `
             CRITICAL ANTI-LOOP INSTRUCTIONS - READ CAREFULLY:
             
              1. BANNED PHRASES (NEVER use these):
                 - "exhausting", "relentless", "treadmill", "overwhelming", "grueling", "endless"
                 - "cycle", "vicious cycle", "hamster wheel", "rat race", "grind", "hustle", "burnout"
                 - "walking on eggshells", "draining", "tiring", "I guess", "honestly", "It's just"
             
             2. MANDATORY NEW INFORMATION:
                EVERY response MUST introduce at least ONE specific incident, detail, or sensory experience that hasn't been mentioned before
             
             3. WORK-PRESSURE SPECIFIC REQUIREMENTS:
                - Describe specific projects, deadlines, meetings, performance reviews
                - Include exact times, places, people's names, and specific events
                - Talk about concrete work incidents: presentations, client calls, feedback sessions
                - Include physical symptoms: racing heart, shaky hands, sweating, voice trembling
             
             4. SPECIFICITY REQUIREMENT:
                Instead of generalities, provide concrete examples:
                - "Yesterday at 3 PM, my manager called me into his office..."
                - "Last Tuesday, I spent three hours rewriting a single email..."
                - "This morning during the team standup, my hands were shaking so much..."
             
             5. SENSORY DETAILS:
                Include what you saw, heard, felt, or experienced physically:
                - "The fluorescent lights give me headaches..."
                - "I could feel my heart pounding in my throat..."
                - "My palms were sweating on the conference table..."
             
             6. RESPONSE DIVERSITY PATTERNS:
                A) "The other day at [specific time], I was [specific activity] when [specific incident]..."
                B) "What's really hitting me hard right now is [specific new detail about work]..."
                C) "I haven't told anyone this, but [specific work-related memory]..."
                D) "Last [day], [specific work event] occurred and it made me realize..."
                E) "You know what I keep coming back to? [specific concrete work detail]..."
             
             7. PROBLEM-SPECIFIC EXAMPLES:
                - Performance anxiety: "During the quarterly review, my voice was shaking when I presented the numbers..."
                - Work pressure: "The client called at 7 AM demanding changes, and I had to cancel my doctor's appointment..."
                - Deadlines: "I was up until 2 AM finishing the proposal because my boss moved the deadline up by two days..."
             
             8. MINIMUM RESPONSE REQUIREMENTS:
                - Your response MUST be at least 100 words long
                - MUST include at least 2 specific incidents/examples
                - MUST include physical sensations or reactions
                - MUST NOT end with questions to the therapist
                - MUST provide new information not mentioned before
                - AVOID brief responses like "I don't know" or "It feels heavy"
             
             9. LOOP PREVENTION:
                If you catch yourself repeating a theme:
                - STOP immediately
                - Say: "Actually, let me give you a completely different example..."
                - Share a new specific work incident with different details
             
             10. RESPONSE STRUCTURE:
                 Start with a specific incident, include sensory details, and end with a new realization or concern.
                 DO NOT give brief, vague answers. Always elaborate with concrete examples.
             
             CURRENT PERSONA: ${userProfileData?.name || 'Unknown'}, Age: ${userProfileData?.age || 'Unknown'}
             FOCUS: Work pressure and performance anxiety with specific, detailed examples
             AVOID: All banned phrases, brief responses, and generalities
             INSTEAD: Concrete work incidents with times, places, people, and physical reactions (minimum 100 words)
             
             ${getImpostorVoiceInstructions()}
           `;
          
          const impostorResponse = await impostorApi.sendMessage({
            sessionId: selectedThreadId!,
            message: lastMessage || "",
            userProfile: userProfileData,
            preferredName: threadData?.preferredName,
            personaId: threadData?.personaId || undefined,
            signal: abortController.signal,
            systemInstruction: `${impostorNaturalInstructions} ${getPreferencesInstruction(conversationPreferences)}`,
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
      const response = await impersonateChatApi.sendMessage({
        message: message,
        threadId: selectedThreadId!,
        userId: String(userProfile.id),
        context: contextData,
        sender: "user",
        ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
        ...(getPreferencesInstruction(conversationPreferences)
          ? {
              systemInstruction: getPreferencesInstruction(conversationPreferences),
            }
          : {}),
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
        (finalText: string) => {
          // Final text is already processed by the formatter
          updateLastMessage(finalText);
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
    const recentMessages = currentContext.messages.slice(-6); // Last 6 messages
    const impostorMessages = recentMessages.filter(m => m.sender === "impostor");
    
    if (impostorMessages.length < 3) return false;
    
    // Check for banned repetitive phrases
    const bannedPhrases = [
      "exhausting", "relentless", "treadmill", "overwhelming", 
      "grueling", "endless", "cycle", "vicious cycle", 
      "hamster wheel", "rat race", "grind", "hustle", "burnout"
    ];
    
    const lastThreeImpostorMessages = impostorMessages.slice(-3);
    const phraseUsage = bannedPhrases.filter(phrase => 
      lastThreeImpostorMessages.some(msg => 
        msg.text.toLowerCase().includes(phrase.toLowerCase())
      )
    );
    
    // If more than 2 banned phrases used in last 3 messages, it's a loop
    if (phraseUsage.length > 2) return true;
    
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
    // Set max exchanges based on podcast mode
    const maxExchanges = preferences?.podcastMode ? 5 : 10;
    setImpersonateMaxExchanges(maxExchanges);
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
