import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import DevToolsSidebar from "@/components/chat/DevToolsSidebar";
import client, { chatApi, impostorApi, observerApi } from "@/lib/client";
import { useImpostorProfile, useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { useAuth } from "@clerk/clerk-react";
import { Brain, Lightbulb, Loader2, Settings, X } from "lucide-react";
import { memo, Suspense, useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { ImpersonateInput } from "./ImpersonateInput";
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
  onSendMessage?: (message: string) => Promise<void>;
  isImpersonateMode?: boolean;
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
  onSendMessage,
  isImpersonateMode = false,
}: ThreadProps): JSX.Element {
  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );
  const { data: impostorProfile, isLoading: impostorProfileLoading } =
    useImpostorProfile(userProfile?.id ? Number(userProfile.id) : null);
  const {
    currentContext,
    addMessage,
    updateLastMessage,
    setSessionId,
    clearMessages,
    setInitialForm,
    loadingState,
    setLoadingState,
    impersonateMaxExchanges,
    setImpersonateMaxExchanges,
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
  const [isImpersonating, setIsImpersonating] = useState(false);
  const isImpersonatingRef = useRef(isImpersonating);
  const [mode, setMode] = useState<"impersonate" | "chat">(
    isImpersonateMode ? "impersonate" : "chat"
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to convert preferences to system instructions
  const getPreferencesInstruction = () => {
    const instructions: string[] = [];

    if (conversationPreferences.briefAndConcise) {
      instructions.push("Keep responses brief and concise");
    }
    if (conversationPreferences.empatheticAndSupportive) {
      instructions.push("Be empathetic and emotionally supportive");
    }
    if (conversationPreferences.solutionFocused) {
      instructions.push("Focus on providing practical solutions and advice");
    }
    if (conversationPreferences.casualAndFriendly) {
      instructions.push("Use a casual and friendly tone");
    }
    if (conversationPreferences.professionalAndFormal) {
      instructions.push("Maintain a professional and formal approach");
    }
    console.log(instructions);
    return instructions.length > 0 ? instructions.join(". ") + "." : "";
  };

  useEffect(() => {
    if (selectedThreadId) {
      setSessionId(selectedThreadId);
      const fetchMessages = async () => {
        try {
          setLoadingHistory(true);
          const response = await client.api.chat[":sessionId"].$get({
            param: { sessionId: String(selectedThreadId) },
          });
          if (!response.ok)
            throw new Error("Failed to fetch previous messages");
          const rawMessages = await response.json();
          const fetchedMessages: FetchedMessage[] = rawMessages.map(
            (msg: any) => ({
              role: msg.sender === "ai" ? "model" : "user",
              text: msg.text,
              timestamp: msg.timestamp,
            })
          );
          clearMessages();
          // Remove any temp/streaming messages from the store before adding loaded messages
          // (Assumes clearMessages resets messages, but if not, filter here)
          setProgressRecommendation("");
          lastSuggestionRef.current = "";
          fetchedMessages.forEach((msg) =>
            addMessage({
              sender: msg.role === "model" ? "ai" : "user",
              text: msg.text,
              timestamp: new Date(msg.timestamp),
              contextId: "default",
            })
          );
          setShowChat(true);
        } catch (error) {
          console.error("Error fetching previous messages:", error);
          setSessionId(null);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchMessages();
    }
  }, [
    selectedThreadId,
    addMessage,
    updateLastMessage,
    setSessionId,
    clearMessages,
  ]);

  const handleFormSubmit = async (sessionId: number) => {
    setSessionId(sessionId);
    setShowChat(true);
    const response = await client.api.chat[":sessionId"].$get({
      param: { sessionId: String(sessionId) },
    });
    if (response.ok) {
      const rawMessages = await response.json();
      const fetchedMessages: FetchedMessage[] = rawMessages.map((msg: any) => ({
        role: msg.sender === "ai" ? "model" : "user",
        text: msg.text,
        timestamp: msg.timestamp,
      }));
      clearMessages();
      setProgressRecommendation("");
      lastSuggestionRef.current = "";
      fetchedMessages.forEach((msg) =>
        addMessage({
          sender: msg.role === "model" ? "ai" : "user",
          text: msg.text,
          timestamp: new Date(msg.timestamp),
          contextId: "default",
        })
      );
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

    // 1. Get observer output (strategy, rationale, next_steps)
    let observerStrategy = "";
    let observerRationale = "";
    let observerNextSteps: string[] = [];
    let observerSentiment = "";
    setLoadingState("observer");
    try {
      const observerRes = await observerApi.getSuggestion({
        messages: [
          ...currentContext.messages
            .filter((msg) => msg.sender === "user" || msg.sender === "ai")
            .map((msg) => ({
              sender: msg.sender as "user" | "ai",
              text: msg.text,
            })),
          ...(message ? [{ sender: "user" as "user", text: message }] : []),
        ],
        ...(currentContext.initialForm
          ? { initialForm: currentContext.initialForm }
          : {}),
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
        currentContext.initialForm
      );
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
          ...(currentContext.initialForm
            ? { initialForm: currentContext.initialForm }
            : {}),
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
          ...(getPreferencesInstruction()
            ? {
                systemInstruction: observerStrategy
                  ? `${observerStrategy} ${getPreferencesInstruction()}`
                  : getPreferencesInstruction(),
              }
            : {}),
          ...(conversationPreferences ? { conversationPreferences } : {}),
        },
      });

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
  useEffect(() => {
    if (
      selectedThreadId &&
      currentContext.messages.some((msg) => msg.sender === "user") &&
      !isStreaming &&
      !loadingHistory
    ) {
      (async () => {
        try {
          const res = await observerApi.getSuggestion({
            messages: currentContext.messages
              .filter((msg) => msg.sender === "user" || msg.sender === "ai")
              .map((msg) => ({
                sender: msg.sender as "user" | "ai",
                text: msg.text,
              })),
            ...(currentContext.initialForm
              ? { initialForm: currentContext.initialForm }
              : {}),
          });
          setAgentStrategy(res.strategy || "");
          setAgentRationale(res.rationale || "");
          setAgentNextSteps(res.next_steps || []);
        } catch (error) {
          console.error("Error getting observer suggestion:", error);
        } finally {
          setLoadingState("idle");
        }
      })();
    } else if (!currentContext.messages.some((msg) => msg.sender === "user")) {
      setAgentStrategy("");
      setAgentRationale("");
      setAgentNextSteps([]);
    }
  }, [selectedThreadId]);

  useEffect(() => {
    isImpersonatingRef.current = isImpersonating;
  }, [isImpersonating]);

  const handleStartImpersonation = async () => {
    if (!userProfile?.id) {
      toast.error("User profile not loaded.");
      return;
    }
    if (!currentContext.sessionId) {
      toast.error("No session selected. Please select or create a thread.");
      return;
    }
    if (!impostorProfile) {
      toast.error("No persona profile found. Please create one first.");
      return;
    }

    // Clean up temp/empty impersonate messages before starting
    cleanUpImpersonateTempMessages(currentContext.messages, (msgs) => {
      clearMessages();
      msgs.forEach((msg) => addMessage(msg));
    });

    setImpersonateMaxExchanges(10); // Always reset exchanges at start
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
      const userProfileData = impostorProfile;
      let exchanges = 0;
      // Find last valid message (non-empty)
      const lastValidMessage = [...currentContext.messages]
        .reverse()
        .find((m) => m.text && m.text.trim() !== "");
      let lastMessage = lastValidMessage
        ? lastValidMessage.text
        : "Hello, I am here for therapy. I have been struggling with some issues.";
      let lastSender = lastValidMessage ? lastValidMessage.sender : null;

      while (
        exchanges < impersonateMaxExchanges &&
        isImpersonatingRef.current
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        checkShouldStop();

        if (lastSender === "user") {
          setLoadingState("observer");
          // Therapist's turn
          let observerStrategy = "";
          let observerRationale = "";
          let observerNextSteps: string[] = [];
          let observerSentiment = "";
          try {
            const observerRes = await observerApi.getSuggestion({
              messages: [
                ...currentContext.messages
                  .filter((msg) => msg.sender === "user" || msg.sender === "ai")
                  .map((msg) => ({
                    sender: msg.sender as "user" | "ai",
                    text: msg.text,
                  })),
                { sender: "user", text: lastMessage },
              ],
              ...(currentContext.initialForm
                ? { initialForm: currentContext.initialForm }
                : {}),
            });
            observerStrategy = observerRes.strategy || "";
            observerRationale = observerRes.rationale || "";
            observerNextSteps = observerRes.next_steps || [];
            observerSentiment = observerRes.sentiment || "";
            setAgentStrategy(observerStrategy);
            setAgentRationale(observerRationale);
            setAgentNextSteps(observerNextSteps);
          } catch (e) {
            observerStrategy = "";
            observerRationale = "";
            observerNextSteps = [];
            observerSentiment = "";
          }
          setLoadingState("idle");
          const abortController = new AbortController();
          abortControllerRef.current = abortController;
          const therapistResponse = await chatApi.sendMessage({
            message: lastMessage,
            sessionId: currentContext.sessionId,
            userId: String(userProfile.id),
            sender: "impostor",
            signal: abortController.signal,
            ...(observerStrategy
              ? { systemInstruction: observerStrategy }
              : {}),
            ...(observerRationale ? { observerRationale } : {}),
            ...(observerNextSteps.length > 0 ? { observerNextSteps } : {}),
            ...(observerSentiment ? { sentiment: observerSentiment } : {}),
            ...(getPreferencesInstruction()
              ? {
                  systemInstruction: observerStrategy
                    ? `${observerStrategy} ${getPreferencesInstruction()}`
                    : getPreferencesInstruction(),
                }
              : {}),
            ...(conversationPreferences ? { conversationPreferences } : {}),
          });

          const reader = therapistResponse.body?.getReader();
          let therapistFullResponse = "";

          if (reader) {
            const tempAiMessage = {
              sender: "ai" as const,
              text: "",
              timestamp: new Date(),
              tempId: Date.now(),
              contextId: "impersonate" as const,
            };
            if (!isImpersonatingRef.current) return;
            addMessage(tempAiMessage);

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              checkShouldStop();
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value);
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const content = line.substring("data: ".length);
                  if (content.trim() === "" || /^\d+$/.test(content.trim()))
                    continue;
                  therapistFullResponse += content + "\n";
                }
              }
              if (!isImpersonatingRef.current) return;
              updateLastMessage(therapistFullResponse);
            }

            if (buffer) {
              therapistFullResponse += buffer;
              if (!isImpersonatingRef.current) return;
              updateLastMessage(therapistFullResponse);
            }
          }

          lastMessage = therapistFullResponse.trim() || lastMessage;
          lastSender = "ai";
        } else {
          // Impostor's turn
          const abortController = new AbortController();
          abortControllerRef.current = abortController;
          const impostorResponse = await impostorApi.sendMessage({
            sessionId: currentContext.sessionId,
            message: lastMessage,
            userProfile: userProfileData,
            signal: abortController.signal,
            ...(getPreferencesInstruction()
              ? {
                  systemInstruction: getPreferencesInstruction(),
                }
              : {}),
            ...(conversationPreferences ? { conversationPreferences } : {}),
          });

          const reader = impostorResponse.body?.getReader();
          let impostorFullResponse = "";

          if (reader) {
            const tempUserMessage = {
              sender: "user" as const,
              text: "",
              timestamp: new Date(),
              tempId: Date.now(),
              contextId: "impersonate" as const,
            };
            if (!isImpersonatingRef.current) return;
            addMessage(tempUserMessage);

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              checkShouldStop();
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value);
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const content = line.substring("data: ".length);
                  if (content.trim() === "" || /^\d+$/.test(content.trim()))
                    continue;
                  impostorFullResponse += content + "\n";
                }
              }
              if (!isImpersonatingRef.current) return;
              updateLastMessage(impostorFullResponse);
            }

            if (buffer) {
              impostorFullResponse += buffer;
              if (!isImpersonatingRef.current) return;
              updateLastMessage(impostorFullResponse);
            }
          }

          lastMessage = impostorFullResponse.trim() || lastMessage;
          lastSender = "user";
        }

        exchanges++;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      if ((error as Error).message !== "Impersonation stopped") {
        console.error("Error during impersonation:", error);
        toast.error("Failed to continue impersonation");
      } else {
        console.log("Impersonation loop exited cleanly.");
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
    setIsImpersonating(false);
    isImpersonatingRef.current = false;
    // Clean up temp/empty impersonate messages after stopping
    cleanUpImpersonateTempMessages(currentContext.messages, (msgs) => {
      clearMessages();
      msgs.forEach((msg) => addMessage(msg));
    });
  };

  useEffect(() => {
    setMode(isImpersonateMode ? "impersonate" : "chat");
  }, [isImpersonateMode]);

  return (
    <div className="flex flex-col min-h-screen h-full bg-gradient-to-br from-gray-50/50 via-white to-indigo-50/30 md:max-w-5xl md:mx-auto md:py-8 py-0 w-full max-w-full flex-1 relative">
      {/* Enhanced Header with subtle shadow */}
      <div className="hidden md:block relative z-10">
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 rounded-t-2xl shadow-sm">
          <ChatHeader
            preferences={conversationPreferences}
            onPreferencesChange={setConversationPreferences}
          />
        </div>
      </div>

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
              inputVisible={false}
              isImpersonateMode={isImpersonateMode}
              onStartImpersonation={handleStartImpersonation}
              onStopImpersonation={handleStopImpersonation}
              isImpersonating={isImpersonating}
            />
          </div>
        </Suspense>
        {/* Custom input for impersonate/chat mode */}
        <ImpersonateInput
          mode={mode}
          onModeChange={setMode}
          isImpersonating={isImpersonating}
          onStart={handleStartImpersonation}
          onStop={handleStopImpersonation}
          onSendMessage={handleSendMessage}
          disabled={
            mode !== "impersonate" &&
            loadingState !== "idle" &&
            loadingState !== "observer"
          }
          hideModeSwitch={!isImpersonateMode} // HIDE SWITCH ON MAIN PAGE
        />
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
        initialForm={currentContext.initialForm}
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
