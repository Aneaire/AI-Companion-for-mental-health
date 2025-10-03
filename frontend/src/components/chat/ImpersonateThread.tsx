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
         // Therapist's turn - get observer strategy silently, then stream immediately
         let observerStrategy = "";
         let observerRationale = "";
         let observerNextSteps: string[] = [];
         let observerSentiment = "";
         
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
          
          // Rich therapeutic instructions for therapist
          const naturalConversationInstructions = `
            CRITICAL: You are a skilled therapist conducting a meaningful therapeutic session. Focus on creating depth, progression, and genuine connection.
            
            THERAPEUTIC FRAMEWORK:
            1. AVOID Dead Ends - Never let conversations stall with simple acknowledgments
            2. ELABORATE - Add depth, context, and meaning to responses
            3. ANCHOR & VALIDATE - Ground emotions in experience, show genuine understanding
            4. PROBE DEEPER - Ask meaningful questions that uncover underlying issues
            
            ADVANCED TECHNIQUES:
            - Use Socratic questioning to guide self-discovery
            - Identify patterns and gently point them out
            - Connect current feelings to past experiences
            - Explore the "why" behind the "what"
            - Validate emotions while exploring their origins
            - Use metaphors and analogies to deepen understanding
            - Reflect both content and emotional tone
            - Normalize experiences while exploring uniqueness
            
            RICH RESPONSE PATTERNS:
            Instead of: "That sounds difficult"
            Use: "That sounds incredibly difficult. I'm hearing that this isn't just about the surface issue - there's something deeper about feeling trapped that's really weighing on you. Can we explore what 'trapped' feels like in your body?"

            Instead of: "Tell me more"
            Use: "I want to understand this better. When you say [their words], what's happening inside you in that moment? What does that bring up from your past?"

            Instead of: "How does that make you feel?"
            Use: "That's a powerful experience. I'm curious about the emotional landscape here - what's the dominant feeling, and what other emotions are layered underneath it?"

            DEEP EXPLORATION QUESTIONS:
            - "What's the story behind this feeling?"
            - "When was the first time you experienced something like this?"
            - "What does this part of you need right now?"
            - "If this feeling had a voice, what would it want to say?"
            - "What's the cost of carrying this?"
            - "What would happen if you let yourself fully feel this?"
            
            PERSONA CONNECTION:
            - Reference their specific persona details naturally
            - Connect their current struggles to their persona background
            - Show you remember and understand their unique situation
            - Use their name/persona context to personalize interventions
            
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
              ? `${observerStrategy} ${naturalConversationInstructions} ${getPreferencesInstruction(conversationPreferences)}`
              : `${naturalConversationInstructions} ${getPreferencesInstruction(conversationPreferences)}`,
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
          
          // Rich persona-driven instructions for impostor
          const impostorNaturalInstructions = `
            CRITICAL: You are NOT an AI - you are a real person with a rich inner world, specific problems, and a unique personality. EMBODY your persona completely.
            
            PERSONA EMBODIMENT FRAMEWORK:
            1. LIVE THE PROBLEM - Don't just mention problems, experience them in real-time
            2. SPECIFICITY & DETAIL - Use concrete examples, not general statements  
            3. EMOTIONAL AUTHENTICITY - Show genuine feelings, not described feelings
            4. PROGRESSIVE VULNERABILITY - Reveal deeper layers gradually
            5. ACTIVE PARTICIPATION - Ask questions, show curiosity, engage actively
            
            AVOID DEAD ENDS - Never give one-word answers or simple confirmations
            ELABORATE - Add context, examples, personal history, and emotional depth
            ANCHOR IN EXPERIENCE - Ground everything in specific life events and feelings
            RESPOND RICHLY - Give the therapist material to work with
            
            RICH RESPONSE EXAMPLES:
            Instead of: "Yeah, it's hard."
            Use: "It's incredibly hard. Just yesterday I was at the grocery store and suddenly felt this wave of panic - my hands started shaking, I couldn't remember what I needed to buy. It's like my brain just... short-circuits. Does that ever happen to you?"

            Instead of: "I feel anxious."
            Use: "The anxiety isn't just in my head - it's physical. My chest gets tight, I feel like I can't get enough air, and there's this buzzing feeling under my skin. It started after my mom got sick last year. I think I'm still carrying that fear of losing someone."

            Instead of: "I don't know."
            Use: "That's the thing - I genuinely don't know, and that's what scares me. I used to be so decisive, so sure of everything. Now I second-guess every choice, even what to have for breakfast. It's like I've lost trust in my own judgment."

            DEEP PERSONA EXPLORATION:
            - Connect current struggles to specific life events
            - Show how problems affect daily life (work, relationships, self-care)
            - Reveal hopes, fears, dreams, and disappointments
            - Share moments of success and failure
            - Show internal conflicts and contradictions
            - Demonstrate coping mechanisms (healthy and unhealthy)
            - Express values, beliefs, and worldview
            
            EMOTIONAL RANGE:
            - Show frustration, anger, sadness, fear, joy, confusion
            - Demonstrate defense mechanisms and moments of breakthrough
            - Express both rational thoughts and irrational fears
            - Show moments of clarity and moments of confusion
            - Reveal vulnerabilities and strengths
            
            ENGAGEMENT PATTERNS:
            - Ask therapist questions about their experience or methods
            - Show curiosity about the therapeutic process
            - Express doubts about therapy or hope for change
            - Bring in specific examples from the past week
            - Share dreams, memories, or sudden insights
            - Show resistance and openness in the same session
            
            ${getImpostorVoiceInstructions()}
          `;
          
          const impostorResponse = await impostorApi.sendMessage({
            sessionId: selectedThreadId!,
            message: lastMessage || "",
            userProfile: userProfileData,
            preferredName: threadData?.preferredName,
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
       if (lastImpersonationSender === "user" || lastImpersonationSender === null) {
         currentTurnType = "therapist";
       } else {
         currentTurnType = "impostor";
       }
       
       console.log(`[CONVERSATION CONTROL] Starting conversation with ${currentTurnType} turn (lastSender: ${lastImpersonationSender})`);
      
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
