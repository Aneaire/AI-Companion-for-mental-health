import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import DevToolsSidebar from "@/components/chat/DevToolsSidebar";
import client, { observerApi, threadsApi } from "@/lib/client";
import { useMoveThreadToTop } from "@/lib/queries/threads";
import { useUserProfile } from "@/lib/queries/user";
import { buildMessagesForObserver, sanitizeInitialForm } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Lightbulb, Loader2, Settings, X } from "lucide-react";
import { memo, Suspense, useCallback, useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { patchMarkdown } from "./MessageList";

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
    conversationPreferences,
    setConversationPreferences,
  } = useChatStore();
  const [showChat, setShowChat] = useState(currentContext.messages.length > 0);
  const [progressRecommendation, setProgressRecommendation] =
    useState<string>("");
  const lastSuggestionRef = useRef<string>("");
  const didMountRef = useRef(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const prevMessageCountRef = useRef<number>(0);
  const [agentStrategy, setAgentStrategy] = useState<string>("");
  const [agentRationale, setAgentRationale] = useState<string>("");
  const [agentNextSteps, setAgentNextSteps] = useState<string[]>([]);
  const [showDevTools, setShowDevTools] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedSessionStatus, setSelectedSessionStatus] = useState<
    "active" | "finished" | undefined
  >(undefined);
  const [threadTitle, setThreadTitle] = useState<string>("");

  // Thread management functions (memoized to prevent recreating on every render)
  const handleDeleteThread = useCallback(async (threadId: number) => {
    try {
      const response = await fetch(`http://localhost:4000/api/threads/${threadId}`, {
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
      const response = await fetch(`http://localhost:4000/api/threads/${threadId}/archive`, {
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
              const response = await client.api.chat[":sessionId"].$get({
                param: { sessionId: String(sessionCheck.latestSession.id) },
              });
              if (!response.ok)
                throw new Error("Failed to fetch previous messages");
              const rawMessages = await response.json();

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
          const response = await client.api.chat[":sessionId"].$get({
            param: { sessionId: String(selectedSessionId) },
          });
          if (!response.ok)
            throw new Error("Failed to fetch previous messages");
          const rawMessages = await response.json();

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
    const response = await client.api.chat[":sessionId"].$get({
      param: { sessionId: String(sessionId) },
    });
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

    // 1. Get observer output (strategy, rationale, next_steps)
    let observerStrategy = "";
    let observerRationale = "";
    let observerNextSteps: string[] = [];
    let observerSentiment = "";
    setLoadingState("observer");
    try {
      // Build the most up-to-date messages array for the observer
      const messagesForObserver = buildMessagesForObserver(
        currentContext.messages,
        message
      );

      // Debug log for observer payload
      console.log("Observer payload", {
        messages: messagesForObserver,
        initialForm: sessionInitialForm,
      });

      const observerRes = await observerApi.getSuggestion({
        messages: messagesForObserver,
        ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
      });
      observerStrategy = observerRes.strategy || "";
      observerRationale = observerRes.rationale || "";
      observerNextSteps = observerRes.next_steps || [];
      observerSentiment = observerRes.sentiment || "";
      setAgentStrategy(observerRes.strategy || "");
      setAgentRationale(observerRes.rationale || "");
      setAgentNextSteps(observerRes.next_steps || []);
      if (
        observerRes.strategy &&
        didMountRef.current &&
        lastSuggestionRef.current !== observerRes.strategy
      ) {
        toast.info(observerRes.strategy, { duration: 6000 });
      }
      lastSuggestionRef.current = observerRes.strategy;
      if (!didMountRef.current) didMountRef.current = true;
    } catch (e) {
      observerStrategy = "";
      observerRationale = "";
      observerNextSteps = [];
      observerSentiment = "";
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

      const response = await client.api.chat.$post({
        json: {
          message: message,
          context: currentContext.messages.map((msg) => ({
            role: msg.sender === "ai" ? "model" : "user",
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
            ...(msg.contextId ? { contextId: msg.contextId } : {}),
          })),
          ...(currentContext.sessionId
            ? { sessionId: currentContext.sessionId }
            : {}),
          ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
          ...(message.trim() === "" && !currentContext.messages.length
            ? { initialForm: undefined }
            : {}),
          ...(progressRecommendation
            ? { systemInstruction: progressRecommendation }
            : {}),
          ...(userProfile?.id ? { userId: String(userProfile.id) } : {}),
          // Pass observer output as systemInstruction, observerRationale, observerNextSteps, sentiment
          ...(observerStrategy ? { systemInstruction: observerStrategy } : {}),
          ...(observerStrategy ? { strategy: observerStrategy } : {}),
          ...(observerRationale ? { observerRationale } : {}),
          ...(observerNextSteps.length > 0 ? { observerNextSteps } : {}),
          ...(observerSentiment ? { sentiment: observerSentiment } : {}),
          // Pass conversation preferences
          ...(() => {
            const instructions: string[] = [];
            if (conversationPreferences.briefAndConcise) {
              instructions.push("Keep responses brief and concise");
            }
            if (conversationPreferences.empatheticAndSupportive) {
              instructions.push("Be empathetic and emotionally supportive");
            }
            if (conversationPreferences.solutionFocused) {
              instructions.push(
                "Focus on providing practical solutions and advice"
              );
            }
            if (conversationPreferences.casualAndFriendly) {
              instructions.push("Use a casual and friendly tone");
            }
            if (conversationPreferences.professionalAndFormal) {
              instructions.push("Maintain a professional and formal approach");
            }
            const preferencesText =
              instructions.length > 0 ? instructions.join(". ") + "." : "";
            return preferencesText
              ? {
                  systemInstruction: observerStrategy
                    ? `${observerStrategy} ${preferencesText}`
                    : preferencesText,
                }
              : {};
          })(),
          ...(conversationPreferences ? { conversationPreferences } : {}),
          // Pass threadType for main chat
          threadType: "main",
        },
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

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
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
            return;
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

        if (
          fullResponse !==
          currentContext.messages[currentContext.messages.length - 1]?.text
        ) {
          updateLastMessage(patchMarkdown(fullResponse));
        }
      }
      // After the loop, the last chunk might not have ended with a newline.
      if (buffer) {
        fullResponse += buffer;
      }
      // Clean up leading/trailing punctuation and whitespace
      fullResponse = fullResponse
        .replace(/\n+/g, "\n")
        .replace(/^\n+|\n+$/g, "");
      // Normalize multiple newlines to a single newline
      fullResponse = fullResponse.replace(/\n{2,}/g, "\n");
      // Ensure the message ends with a newline for markdown rendering
      if (!fullResponse.endsWith("\n")) {
        fullResponse += "\n";
      }
      updateLastMessage(patchMarkdown(fullResponse));
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

  // Call observer once when thread is loaded to populate DevTools
  useEffect(() => {
    if (
      selectedThreadId &&
      currentContext.messages.some((msg) => msg.sender === "user") &&
      !isStreaming &&
      !loadingHistory &&
      agentStrategy === "" // Only if we don't already have strategy data
    ) {
      (async () => {
        try {
          // Get the correct initial form for this session
          const sessionInitialForm = getInitialForm(selectedThreadId);

          const res = await observerApi.getSuggestion({
            messages: currentContext.messages
              .filter((msg) => msg.sender === "user" || msg.sender === "ai")
              .map((msg) => ({
                sender: (msg.sender === "user" ? "user" : "ai") as
                  | "user"
                  | "ai",
                text: msg.text,
              })),
            ...(sessionInitialForm ? { initialForm: sessionInitialForm } : {}),
          });
          setAgentStrategy(res.strategy || "");
          setAgentRationale(res.rationale || "");
          setAgentNextSteps(res.next_steps || []);
        } catch (error) {
          console.error("Error getting observer suggestion:", error);
        }
      })();
    }
  }, [selectedThreadId, loadingHistory, getInitialForm]); // Only depend on thread change and loading state

  // Clear agent strategy when switching threads
  useEffect(() => {
    setAgentStrategy("");
    setAgentRationale("");
    setAgentNextSteps([]);
  }, [selectedThreadId]);

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
            threadTitle={threadTitle}
            onDeleteThread={handleDeleteThread}
            onArchiveThread={handleArchiveThread}
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

          {/* Chat Interface */}
          <div className="flex-1 flex flex-col h-full">
            <ChatInterface
              messages={currentContext.messages}
              onSendMessage={onSendMessage || handleSendMessage}
              loadingState={loadingState}
              inputVisible={selectedSessionStatus !== "finished"}
              isImpersonateMode={false}
            />
          </div>
        </Suspense>
      </main>

      {/* Enhanced Dev Tools Toggle */}
      <div className="hidden md:block">
        <DevToolsToggle
          showDevTools={showDevTools}
          onToggle={() => setShowDevTools(!showDevTools)}
        />
      </div>

      {/* Dev Tools Sidebar with enhanced styling */}
      <DevToolsSidebar
        agentStrategy={agentStrategy}
        agentRationale={agentRationale}
        agentNextSteps={agentNextSteps}
        messageCount={currentContext.messages.length}
        messages={currentContext.messages}
        initialForm={currentSessionInitialForm}
        isOpen={showDevTools}
        onClose={() => setShowDevTools(false)}
      />

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

export default memo(Thread);
