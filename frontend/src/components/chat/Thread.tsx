import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import DevToolsSidebar from "@/components/chat/DevToolsSidebar";
import { FormRequiredState } from "@/components/chat/FormRequiredState";
import { SessionManagementDialog } from "@/components/chat/SessionManagementDialog";
import client, { threadsApi, personaCardsApi } from "@/lib/client";
import { useMoveThreadToTop } from "@/lib/queries/threads";
import { useUserProfile } from "@/lib/queries/user";
import { sanitizeInitialForm } from "@/lib/utils";
import { StreamingMessageProcessor, MessageFormattingUtils, selectPersonaBasedOnRules } from "@/lib/messageFormatter";
import textToSpeech from "@/services/elevenlabs/textToSpeech";
import { useChatStore, type ConversationPreferences } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Lightbulb, Loader2, Settings, X } from "lucide-react";
import { memo, Suspense, useCallback, useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";

interface ErrorResponse {
  error: string;
}

interface FetchedMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

export interface ThreadProps {
  selectedThreadId: number | null;
  selectedSessionId?: number | null;
  onSendMessage?: (message: string) => Promise<void>;
  showFormIndicator?: boolean;
  onMessageSent?: (threadId: number) => void;
  onThreadDeleted?: () => void;
  onSessionSelected?: (sessionId: number) => void;
  conversationPreferences?: ConversationPreferences;
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

// Enhanced Progress Recommendation Component
function ProgressRecommendation({
  recommendation,
}: {
  recommendation: string;
}) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="mx-4 mb-4 animate-in slide-in-from-top-2 duration-500">
      <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lightbulb size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-blue-900">
                AI Suggestion
              </span>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
            <p className="text-blue-800 text-sm leading-relaxed">
              {recommendation}
            </p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded-full hover:bg-blue-100/60 transition-colors duration-200 flex-shrink-0"
            aria-label="Dismiss suggestion"
          >
            <X size={14} className="text-blue-600" />
          </button>
        </div>
      </div>
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

// Utility to clean up temp/empty impersonate messages
function cleanUpImpersonateTempMessages(
  messages: Message[],
  updateMessages: (msgs: Message[]) => void
) {
  const filtered = messages.filter(
    (m) => !(m.contextId === "impersonate" && (!m.text || m.text.trim() === ""))
  );
  if (filtered.length !== messages.length) {
    updateMessages(filtered);
  }
}

export function Thread({
  selectedThreadId,
  selectedSessionId,
  onSendMessage,
  showFormIndicator,
  onMessageSent,
  onThreadDeleted,
  onSessionSelected,
  conversationPreferences: propConversationPreferences,
}: ThreadProps): JSX.Element {
  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );
  const queryClient = useQueryClient();
  const moveThreadToTop = useMoveThreadToTop();
  const { setSelectedThread } = useThreadsStore();
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
    conversationPreferences: storeConversationPreferences,
    setConversationPreferences,
    setSelectedPersona,
    selectedPersona,
    personaRationale,
  } = useChatStore();

  // Use prop if provided, otherwise fall back to store
  const conversationPreferences = propConversationPreferences || storeConversationPreferences;
  const [showChat, setShowChat] = useState(currentContext.messages.length > 0);
  const [progressRecommendation, setProgressRecommendation] =
    useState<string>("");
  const lastSuggestionRef = useRef<string>("");
  const didMountRef = useRef(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const prevMessageCountRef = useRef<number>(0);
  
  const [showDevTools, setShowDevTools] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedSessionStatus, setSelectedSessionStatus] = useState<
    "active" | "finished" | undefined
  >(undefined);
  const [threadTitle, setThreadTitle] = useState<string>("");
  const [showPersonaInMessages, setShowPersonaInMessages] = useState(false); // Start with false

  // Handle persona display toggle from DevTools
  useEffect(() => {
    const handleTogglePersonaDisplay = (event: any) => {
      const newState = event.detail?.showPersona ?? !showPersonaInMessages;
      setShowPersonaInMessages(newState);
      // Notify DevTools of the new state
      window.dispatchEvent(new CustomEvent('personaDisplayState', { detail: { showPersona: newState } }));
    };

    window.addEventListener('togglePersonaDisplay', handleTogglePersonaDisplay);
    
    // Initialize DevTools with current state
    window.dispatchEvent(new CustomEvent('personaDisplayState', { detail: { showPersona: showPersonaInMessages } }));
    
    return () => {
      window.removeEventListener('togglePersonaDisplay', handleTogglePersonaDisplay);
    };
  }, [showPersonaInMessages]);

  // Auto-show persona badge when a persona is selected
  useEffect(() => {
    if (selectedPersona && !showPersonaInMessages) {
      setShowPersonaInMessages(true);
    }
  }, [selectedPersona, showPersonaInMessages]);

   
  // Session management state
  const [sessionManagementOpen, setSessionManagementOpen] = useState(false);
  const [sessionFormCompleted, setSessionFormCompleted] = useState<boolean | null>(null);
  const [currentSessionNumber, setCurrentSessionNumber] = useState(1);
  const [dialogSessionId, setDialogSessionId] = useState<number | null>(null);
  const [justCreatedNewSession, setJustCreatedNewSession] = useState(false);
  const [followupFormData, setFollowupFormData] = useState<Record<string, any> | null>(null);

  // Thread management functions (memoized to prevent recreating on every render)
  const handleDeleteThread = useCallback(async (threadId: number) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }

      // Remove from query cache
      queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
      queryClient.removeQueries({ queryKey: ["threadSessions", threadId] });
      
      // Clear current context
      clearMessages();
      setThreadId(null);
      setSelectedThread(null);
      
      // Notify parent component
      onThreadDeleted?.();
      
      toast.success("Thread deleted successfully");
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast.error("Failed to delete thread");
    }
  }, [queryClient, clearMessages, setThreadId, setSelectedThread, onThreadDeleted]);

  const handleArchiveThread = useCallback(async (threadId: number) => {
    try {
      const response = await fetch(`/api/threads/${threadId}/archive`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to archive thread');
      }

      // Invalidate query cache to refresh the thread list
      queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
      
      // Success toast will be shown by the dialog component
    } catch (error) {
      console.error("Error archiving thread:", error);
      toast.error("Failed to archive thread");
    }
  }, [queryClient]);

  // Helper function to fetch thread initial form data
  const fetchThreadInitialForm = async (threadId: number) => {
    try {
      // For main threads, fetch from main API
      const response = await client.api.threads[":threadId"].$get({
        param: { threadId: String(threadId) },
      });
      if (response.ok) {
        const threadData = await response.json();
        
        // Set thread title for the header
        const title = threadData.sessionName || 
                     threadData.reasonForVisit || 
                     `Thread #${threadId}`;
        setThreadTitle(title);
        
        // Convert main thread data to FormData format
        const formData: import("@/lib/client").FormData = {
          preferredName: threadData.preferredName || "",
          currentEmotions: threadData.currentEmotions || [],
          reasonForVisit: threadData.reasonForVisit || "",
          supportType: (threadData.supportType || []) as (
            | "listen"
            | "copingTips"
            | "encouragement"
            | "resources"
            | "other"
          )[],
          supportTypeOther: threadData.supportTypeOther || "",
          additionalContext: threadData.additionalContext || "",
          responseTone: (threadData.responseTone || undefined) as
            | "empathetic"
            | "practical"
            | "encouraging"
            | "concise"
            | undefined,
          imageResponse: threadData.imageResponse || "",
          responseCharacter: threadData.responseCharacter || "",
          responseDescription: threadData.responseDescription || "",
        };
        setInitialForm(formData);
        return formData;
      }
    } catch (error) {
      console.error("Error fetching thread initial form:", error);
    }
    return undefined;
  };



  useEffect(() => {
    if (selectedThreadId) {
      setThreadId(selectedThreadId);
      const fetchThreadData = async () => {
        try {
          setLoadingHistory(true);

          // First check session status and potentially create new session
          const sessionCheck = await threadsApi.checkSession(selectedThreadId);
          


          // Check if current session was completed and needs follow-up form
          if (sessionCheck.sessionCompleted && sessionCheck.latestSession) {

            setCurrentSessionNumber(sessionCheck.latestSession.sessionNumber);
            // Keep using the current (finished) session ID for form generation
            setDialogSessionId(sessionCheck.latestSession.id);
            
            // Load messages from the just-completed session for form generation but don't show dialog yet
            try {
              const rawMessages = await personaCardsApi.getMessages(sessionCheck.latestSession.id);
              const fetchedMessages = rawMessages.map((msg: any) => ({
                role: msg.sender === "ai" ? "model" : "user",
                text: msg.text,
                timestamp: msg.timestamp,
              }));
              
              const sortedMessages = fetchedMessages
                .sort((a: any, b: any) => a.timestamp - b.timestamp)
                .map((msg: any) => ({
                  sender: (msg.role === "model" ? "ai" : "user") as "user" | "ai",
                  text: msg.text,
                  timestamp: new Date(msg.timestamp),
                  contextId: "default",
                }));
              
              // Set messages from completed session
              clearMessages();
              
              if (sortedMessages.length === 0) {

                // Mark session form as completed since no form can be generated
                setSessionFormCompleted(true);
                setLoadingHistory(false);
                return;
              }
              
              sortedMessages.forEach((msg) => addMessage(msg));
            } catch (error) {
              console.error("Error loading messages for form generation:", error);
            }
            
            // Don't auto-open the dialog, just mark that form is required

            setSessionFormCompleted(false);
            setLoadingHistory(false);
            return;
          }

          // For existing sessions, determine if form is required
          if (sessionCheck.latestSession && sessionCheck.latestSession.sessionNumber > 1 && !justCreatedNewSession) {

            
            // Check if the PREVIOUS session has a completed form
            // Session N requires a form from Session N-1 to have been completed
            const threadSessions = await client.api.threads[":threadId"].sessions.$get({
              param: { threadId: String(selectedThreadId) },
            });
            
            if (threadSessions.ok) {
              const sessions = await threadSessions.json();
              const previousSession = sessions.find((s: any) => s.sessionNumber === sessionCheck.latestSession.sessionNumber - 1);
              
              if (previousSession) {

                const formStatus = await threadsApi.getSessionForm(previousSession.id);

                
                setSessionFormCompleted(formStatus.hasForm);
                setCurrentSessionNumber(sessionCheck.latestSession.sessionNumber);
                
                // If form exists, store the follow-up form data for observer
                if (formStatus.hasForm && formStatus.form?.answers) {
                  setFollowupFormData(formStatus.form.answers);

                } else {
                  setFollowupFormData(null);
                }
                
                // If previous session form is required but not completed, show form required state
                if (!formStatus.hasForm) {

                  setLoadingHistory(false);
                  return;
                } else {

                }
              } else {

                setSessionFormCompleted(true);
                setCurrentSessionNumber(sessionCheck.latestSession.sessionNumber);
                setFollowupFormData(null);
              }
            }
          } else if (justCreatedNewSession) {

            setSessionFormCompleted(true);
            setCurrentSessionNumber(sessionCheck.latestSession?.sessionNumber || 1);
          } else {

            setSessionFormCompleted(true); // Session 1 doesn't need a form
            setCurrentSessionNumber(sessionCheck.latestSession?.sessionNumber || 1);
          }

          // Fetch sessions for this thread
          const threadSessions = await client.api.threads[
            ":threadId"
          ].sessions.$get({
            param: { threadId: String(selectedThreadId) },
          });

          if (threadSessions.ok) {
            const sessions = await threadSessions.json();

            // Use the latest active session from the session check
            if (sessionCheck.latestSession) {
              setSessionId(sessionCheck.latestSession.id);

              // Fetch messages for this session
              const rawMessages = await personaCardsApi.getMessages(sessionCheck.latestSession.id);

              clearMessages();
              setProgressRecommendation("");
              lastSuggestionRef.current = "";

              // Convert and add messages
              const fetchedMessages: FetchedMessage[] = rawMessages.map(
                (msg: any) => ({
                  role: msg.sender === "ai" ? "model" : "user",
                  text: msg.text,
                  timestamp: msg.timestamp,
                })
              );

              // Sort messages by timestamp to ensure correct order
              const sortedMessages = fetchedMessages
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((msg) => ({
                  sender: (msg.role === "model" ? "ai" : "user") as
                    | "user"
                    | "ai",
                  text: msg.text,
                  timestamp: new Date(msg.timestamp),
                  contextId: "default",
                }));

              sortedMessages.forEach((msg) => addMessage(msg));
              setShowChat(true);

              // Fetch and set the correct initial form for this session
              await fetchThreadInitialForm(selectedThreadId);
            } else {
              // No sessions yet - this might be a new thread
              // Set showChat to true so the interface is visible
              setShowChat(true);
              setSessionId(null);
            }
          }
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
    justCreatedNewSession,
  ]);

  // Handle session switching
  useEffect(() => {
    if (selectedSessionId && selectedSessionId !== currentContext.sessionId) {
      setSessionId(selectedSessionId);
      const fetchSessionMessages = async () => {
        try {
          setLoadingHistory(true);
          // Fetch session status to determine input availability
          try {
            const sessions = await threadsApi.getSessions(
              selectedThreadId ?? selectedSessionId
            );
            const found = Array.isArray(sessions)
              ? sessions.find((s: any) => s.id === selectedSessionId)
              : undefined;
            setSelectedSessionStatus(
              found?.status === "finished" ? "finished" : "active"
            );
          } catch (e) {
            setSelectedSessionStatus(undefined);
          }
          const rawMessages = await personaCardsApi.getMessages(selectedSessionId);

          clearMessages();
          setProgressRecommendation("");
          lastSuggestionRef.current = "";

          // Convert and add messages
          const fetchedMessages: FetchedMessage[] = rawMessages.map(
            (msg: any) => ({
              role: msg.sender === "ai" ? "model" : "user",
              text: msg.text,
              timestamp: msg.timestamp,
            })
          );

          // Sort messages by timestamp to ensure correct order
          const sortedMessages = fetchedMessages
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((msg) => ({
              sender: (msg.role === "model" ? "ai" : "user") as "user" | "ai",
              text: msg.text,
              timestamp: new Date(msg.timestamp),
              contextId: "default",
            }));

          sortedMessages.forEach((msg) => addMessage(msg));
          setShowChat(true);

          // Fetch and set the correct initial form for this thread
          if (selectedThreadId) {
            await fetchThreadInitialForm(selectedThreadId);
          }
        } catch (error) {
          console.error("Error fetching session messages:", error);
          setSessionId(null);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchSessionMessages();
    }
  }, [
    selectedSessionId,
    currentContext.sessionId,
    selectedThreadId,
    addMessage,
    updateLastMessage,
    setSessionId,
    clearMessages,
    setInitialForm,
  ]);

  const handleFormSubmit = async (sessionId: number) => {
    setSessionId(sessionId);
    setShowChat(true);
    const response = await personaCardsApi.getMessages(sessionId);
    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }
    const rawMessages = await response.json();

    clearMessages();
    setProgressRecommendation("");
    lastSuggestionRef.current = "";

    // Convert and add messages
    const fetchedMessages: FetchedMessage[] = rawMessages.map((msg: any) => ({
      role: msg.sender === "ai" ? "model" : "user",
      text: msg.text,
      timestamp: msg.timestamp,
    }));

    // Sort messages by timestamp to ensure correct order
    const sortedMessages = fetchedMessages
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((msg) => ({
        sender: (msg.role === "model" ? "ai" : "user") as "user" | "ai",
        text: msg.text,
        timestamp: new Date(msg.timestamp),
        contextId: "default",
      }));
    sortedMessages.forEach((msg) => addMessage(msg));

    // Fetch and set the correct initial form for this thread
    if (selectedThreadId) {
      await fetchThreadInitialForm(selectedThreadId);
    }
  };

  const handleSendMessage = async (message: string): Promise<void> => {
    if (!message.trim() && !showChat) return;
    if (userProfileLoading || !userProfile?.id) {
      toast.error("User profile not loaded. Please wait.");
      return;
    }



    const userMessage: Message = {
      sender: "user",
      text: message,
      timestamp: new Date(),
      contextId: "default",
    };

    if (message.trim()) {
      addMessage(userMessage);
    }

    // Get the correct initial form for this session
    let sessionInitialForm = currentContext.sessionId
      ? getInitialForm(currentContext.sessionId)
      : currentContext.initialForm;
    sessionInitialForm = sanitizeInitialForm(sessionInitialForm);

    // Fallback: use nickname if preferredName is missing
    if (
      sessionInitialForm &&
      (!sessionInitialForm.preferredName ||
        sessionInitialForm.preferredName.trim() === "") &&
      userProfile?.nickname
    ) {
      sessionInitialForm.preferredName = userProfile.nickname;
    }


    setLoadingState("generating");
    setIsStreaming(true);

    try {
      console.log(
        "[Thread] Sending message with initialForm:",
        sessionInitialForm,
        "Type:",
        typeof sessionInitialForm,
        "Is Array:",
        Array.isArray(sessionInitialForm)
      );

      // Ensure initialForm is an object, not an array
      if (Array.isArray(sessionInitialForm)) {
        console.error(
          "initialForm is an array, this should not happen:",
          sessionInitialForm
        );
        // Try to get the first item if it's an array
        const firstItem = sessionInitialForm[0];
        if (firstItem && typeof firstItem === "object") {
          sessionInitialForm = firstItem;
        } else {
          sessionInitialForm = undefined;
        }
      }

      const response = await personaCardsApi.sendMessage({
        message: message,
        context: currentContext.messages.map((msg) => ({
          role: msg.sender === "ai" ? "model" : "user",
          text: msg.text,
          timestamp: msg.timestamp.getTime(),
          ...(msg.contextId ? { contextId: msg.contextId } : {}),
        })),
        sessionId: currentContext.sessionId || 0,
        ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
        ...(message.trim() === "" && !currentContext.messages.length
          ? { initialForm: undefined }
          : {}),
        userId: String(userProfile?.id || ""),
        conversationPreferences,
      });

      // Optimistically move the thread to the top after sending a message
      if (onMessageSent && selectedThreadId) {
        onMessageSent(selectedThreadId);
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
          contextId: "default",
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
            contextId: "default",
            status: "failed",
            error: error.message,
          };
          addMessage(errorMessage);
        },
        async (finalText: string) => {
           // Final text is already processed by the formatter
           updateLastMessage(finalText);

           // Generate TTS for AI messages if enabled
           if (finalText.trim() && conversationPreferences.mainEnableTTS && conversationPreferences.mainTTSAutoPlay) {
             try {
               await textToSpeech(
                 finalText.trim(),
                 conversationPreferences.mainTTSVoiceId,
                 true, // autoPlay
                 conversationPreferences.mainTTSModel,
                 conversationPreferences.mainTTSSpeed ?? 1.0
               );
             } catch (error) {
               console.error("TTS generation failed:", error);
               // Don't show error toast as it might interrupt the conversation
             }
           }
         },
        // Persona selection callback - use server-provided persona with fallback to rule-based
        (personaData: any) => {
          console.log("Persona selection event received:", personaData);
          console.log("Persona data details:", {
            personaId: personaData?.personaId,
            hasPersonaId: !!personaData?.personaId,
            personaIdType: typeof personaData?.personaId
          });
          
          // Use server-provided persona if available, otherwise fallback to rule-based selection
          if (personaData && personaData.personaId) {
            console.log("Using server-provided persona:", personaData);
            // Map server personaId to frontend persona names and generate rationale
            let personaName = personaData.personaId;
            let rationale = 'Server selected based on conversation analysis';
            
            // Map persona IDs to display names
            if (personaData.personaId.includes('crisis')) {
              personaName = 'crisis_support';
              rationale = 'crisis';
            } else if (personaData.personaId.includes('anchor')) {
              personaName = 'calm_anchor';
              rationale = 'anger';
            } else if (personaData.personaId.includes('guide')) {
              personaName = 'wise_guide';
              rationale = 'advice';
            } else if (personaData.personaId.includes('companion') || personaData.personaId.includes('friend')) {
              personaName = 'friendly_companion';
              rationale = 'companion';
            } else if (personaData.personaId.includes('direct')) {
              personaName = 'direct_engager';
              rationale = 'evasive';
            } else if (personaData.personaId.includes('confrontational')) {
              personaName = 'direct_confrontational';
              rationale = 'honest_feedback';
            } else if (personaData.personaId.includes('listener')) {
              personaName = 'empathetic_listener';
              rationale = 'emotional';
            } else {
              personaName = 'empathetic_listener';
              rationale = 'default';
            }
            
            console.log("Mapped persona for frontend:", { personaName, rationale });
            setSelectedPersona(personaName, rationale);
          } else {
            // Fallback to rule-based selection
            const selectedPersona = selectPersonaBasedOnRules(
              currentContext.messages,
              message
            );
            console.log("Using rule-based persona selection:", selectedPersona);
            setSelectedPersona(
              selectedPersona.persona,
              selectedPersona.rationale
            );
          }
        }
      );

      await processor.processStream(response);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        sender: "ai",
        text:
          error instanceof Error
            ? error.message
            : "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date(),
        contextId: "default",
      };
      addMessage(errorMessage);
    } finally {
      setIsStreaming(false);
      setLoadingState("idle");
    }
  };

  // Run agent when selectedThreadId changes (only for initial load)
  // Removed this useEffect to prevent multiple observer calls
  // The observer is now only called in handleSendMessage when needed



  

  // Get the correct initial form for the current session
  const currentSessionInitialForm = currentContext.sessionId
    ? getInitialForm(currentContext.sessionId)
    : currentContext.initialForm;

  return (
    <div className="flex flex-col min-h-screen h-full bg-gradient-to-br from-gray-50/50 via-white to-indigo-50/30 md:max-w-5xl md:mx-auto md:py-8 py-0 w-full max-w-full flex-1 relative">
      {/* Enhanced Header with subtle shadow */}
      <div className="hidden md:block relative z-10">
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 rounded-t-2xl shadow-sm">
           <ChatHeader
             preferences={conversationPreferences}
             onPreferencesChange={setConversationPreferences}
             selectedThreadId={selectedThreadId}
             selectedSessionId={selectedSessionId}
             threadTitle={threadTitle}
             onDeleteThread={handleDeleteThread}
             onArchiveThread={handleArchiveThread}
             context="main"
             currentPersona={selectedPersona}
             personaRationale={personaRationale}
             showPersonaBadge={showPersonaInMessages}
            />
         </div>
      </div>

      {/* Visual indicator for form answers being used */}
      {showFormIndicator && (
        <div className="mx-4 mt-4 animate-in slide-in-from-top-2 duration-500">
          <div className="relative bg-gradient-to-r from-green-50 to-blue-50 border border-green-200/60 rounded-xl p-3 shadow-sm backdrop-blur-sm flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-blue-400 text-white font-bold text-lg mr-2">
              ✓
            </span>
            <span className="text-green-900 text-sm font-medium">
              Session follow-up form answers are now being used to personalize
              this session.
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area with enhanced styling */}
      <main className="flex-1 overflow-hidden md:pb-0 w-full flex h-full flex-col relative bg-white/60 backdrop-blur-sm md:rounded-b-2xl md:border-x md:border-b border-gray-200/60 md:shadow-lg">
        <Suspense fallback={<EnhancedLoadingFallback />}>
          {/* Chat Dialog */}

          {/* Enhanced Progress Recommendation */}
          {progressRecommendation && (
            <ProgressRecommendation recommendation={progressRecommendation} />
          )}

          {/* Chat Interface or Form Required State */}
          <div className="flex-1 flex flex-col h-full">
            {sessionFormCompleted === false ? (
              <FormRequiredState
                sessionNumber={currentSessionNumber}
                onOpenForm={() => {
                  // Check if we have messages to generate form from
                  if (currentContext.messages.length === 0) {
                    toast.error("Cannot create follow-up form without conversation history. Please have a conversation first.");
                    return;
                  }
                  setSessionManagementOpen(true);
                }}
              />
            ) : (
<ChatInterface
                  messages={currentContext.messages}
                  onSendMessage={onSendMessage || handleSendMessage}
                  loadingState={loadingState}
                  inputVisible={selectedSessionStatus !== "finished"}
                  isImpersonateMode={false}
                  preferences={conversationPreferences}
                  showPersonaInMessages={showPersonaInMessages}
                  selectedPersona={selectedPersona}
                />
            )}
          </div>
        </Suspense>
      </main>

      {/* Enhanced Dev Tools Toggle */}
      {!import.meta.env.PROD && (
        <div className="hidden md:block">
          <DevToolsToggle
            showDevTools={showDevTools}
            onToggle={() => setShowDevTools(!showDevTools)}
          />
        </div>
      )}

      {/* Dev Tools Sidebar with enhanced styling */}
      {!import.meta.env.PROD && (
        <DevToolsSidebar
          messageCount={currentContext.messages.length}
          messages={currentContext.messages}
          initialForm={currentSessionInitialForm}
          isOpen={showDevTools}
          onClose={() => setShowDevTools(false)}
        />
      )}

      {/* Session Management Dialog */}
      {sessionManagementOpen && selectedThreadId && dialogSessionId && (
        <SessionManagementDialog
          open={sessionManagementOpen}
          onOpenChange={setSessionManagementOpen}
          sessionNumber={currentSessionNumber}
          sessionId={dialogSessionId}
          threadId={selectedThreadId}
          messages={currentContext.messages.map(msg => ({
            sender: msg.sender,
            text: msg.text
          }))}
          initialForm={currentSessionInitialForm || {}}

          onFormCompleted={async (newSessionId: number) => {

            
            try {
              // Set flag to prevent form requirement checks from running
              setJustCreatedNewSession(true);
              
              // Clear current messages first
              clearMessages();
              
              // Set the new session ID in the context
              setSessionId(newSessionId);
              
              // Update the selected session in the sidebar
              if (onSessionSelected) {
                onSessionSelected(newSessionId);
              }
              
              // Update current session number for the new session
              setCurrentSessionNumber(currentSessionNumber + 1);
              
              // For the new session, form is completed (since we just came from submitting it)
              // and we explicitly mark it as such to prevent re-checking
              setSessionFormCompleted(true);
              
              // Show the chat interface immediately
              setShowChat(true);
              setLoadingHistory(false);
              
              // Close the dialog after state is set
              setSessionManagementOpen(false);
              
              // Fetch and set the initial form for this thread
              if (selectedThreadId) {
                await fetchThreadInitialForm(selectedThreadId);
              }
              
              // Invalidate queries to refresh the sidebar with new session
              queryClient.invalidateQueries({ queryKey: ["threadSessions", selectedThreadId] });
              queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
              

              
              // Reset the flag after a short delay to allow for normal operation
              setTimeout(() => setJustCreatedNewSession(false), 1000);
              
            } catch (error) {
              console.error("Error switching to new session:", error);
              // If there's an error, still show the chat interface
              setSessionFormCompleted(true);
              setShowChat(true);
              setLoadingHistory(false);
              setSessionManagementOpen(false);
              setJustCreatedNewSession(false);
              
              // Still try to invalidate queries to refresh the sidebar
              if (selectedThreadId) {
                queryClient.invalidateQueries({ queryKey: ["threadSessions", selectedThreadId] });
                queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
              }
            }
          }}
        />
      )}

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
    </div>
  );
}

export default Thread;

