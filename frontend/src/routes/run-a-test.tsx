import { ChatDialog } from "@/components/chat/ChatDialog";
import type { FormData } from "@/components/chat/ChatForm";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInterface } from "@/components/chat/ChatInterface";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { ProgressHistoryChartDialog } from "@/components/progress/ProgressHistoryChartDialog";
import { ProgressHistorySparkline } from "@/components/progress/ProgressHistorySparkline";
import { ProgressLevelDisplay } from "@/components/progress/ProgressLevelDisplay";
import { ProgressRationaleCard } from "@/components/progress/ProgressRationaleCard";
import { Button } from "@/components/ui/button";
import HeaderUser from "@/integrations/clerk/header-user";
import client, { agentApi } from "@/lib/client";
import { useCreateThread, useThreads } from "@/lib/queries/threads";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

function getThreadTitle(thread: any) {
  if (thread.sessionName) return thread.sessionName;
  if (thread.reasonForVisit) return thread.reasonForVisit;
  if (thread.createdAt) {
    const date = new Date(thread.createdAt);
    return `Thread #${thread.id} (${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }
  return `Thread #${thread.id}`;
}

export const Route = createFileRoute("/run-a-test")({
  component: PodcastYourProblem,
});

function PodcastYourProblem() {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [autoStep, setAutoStep] = useState(0);
  const autoTimer = useRef<NodeJS.Timeout | null>(null);
  const automationAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [isStreaming, setIsStreaming] = useState(false);
  const [patientProgressLevel, setPatientProgressLevel] = useState(0);
  const [progressMode, setProgressMode] = useState<
    "progressive" | "unpredictable"
  >("progressive");
  const [progressHistory, setProgressHistory] = useState<number[]>([]);
  const [progressRationale, setProgressRationale] = useState<string>("");
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [progressRationales, setProgressRationales] = useState<string[]>([]);
  const [agentStrategy, setAgentStrategy] = useState<string>("");
  const [agentRationale, setAgentRationale] = useState<string>("");
  const [agentNextSteps, setAgentNextSteps] = useState<string[]>([]);

  const { data: threads, isLoading } = useThreads();
  const createThread = useCreateThread();
  const {
    addMessage,
    setSessionId,
    clearMessages,
    currentContext,
    updateLastMessage,
    setInitialForm,
  } = useChatStore();

  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );

  // Add an initial patient message for the conversation
  const initialPatientMessage = "";

  // Track whose turn it is: 'patient' or 'companion'
  const [autoTurn, setAutoTurn] = useState<"patient" | "companion">("patient");

  const handleSelectThread = async (id: number) => {
    setSelectedThreadId(id);
    setSessionId(id);
    clearMessages();
    // Fetch messages for the selected thread
    try {
      const response = await client.api.chat[":sessionId"].$get({
        param: { sessionId: String(id) },
      });
      if (response.ok) {
        const fetchedMessages = await response.json();
        fetchedMessages.forEach((msg: any) =>
          addMessage({
            sender: msg.role === "model" ? "ai" : "user",
            text: msg.text,
            timestamp: new Date(msg.timestamp),
            contextId: "default",
          })
        );
      }
    } catch (error) {
      // Optionally handle error
    }
  };

  const handleNewThread = () => {
    setChatDialogOpen(true);
  };

  const handleChatFormSubmit = (
    formData: FormData,
    aiResponse: string,
    sessionId: number
  ) => {
    setSessionId(sessionId);
    clearMessages();
    const cleanAIResponse = aiResponse.replace(/^[0-9]+/, "").trim();
    addMessage({
      sender: "ai",
      text: cleanAIResponse,
      timestamp: new Date(),
      contextId: "default",
    });
  };

  // Utility for unpredictable progress
  function getNextProgressLevel(current: number) {
    const rand = Math.random();
    if (rand < 0.05 && current < 9) return current + 2; // 5% chance +2
    if (rand < 0.2 && current > 0) return current - 1; // 15% chance -1
    if (rand < 0.5 && current < 10) return current + 1; // 30% chance +1
    return current; // 50% chance no change
  }

  const sendPatientMessage = async (message: string) => {
    setIsStreaming(true);
    try {
      const response = await client.api.patient.$post({
        json: {
          message,
          context: currentContext.messages.map((msg) => ({
            role: msg.sender === "ai" ? "model" : "user",
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
            ...(msg.contextId ? { contextId: msg.contextId } : {}),
          })),
          patientProgressLevel,
          ...(currentContext.initialForm
            ? { initialForm: currentContext.initialForm }
            : {}),
        },
      });
      if (!response.ok) throw new Error("Failed to get patient response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";
      const tempId = Date.now();
      addMessage({
        sender: "user",
        text: "",
        timestamp: new Date(),
        tempId,
        contextId: "default",
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            fullResponse += line.substring("data: ".length) + "\n";
          }
        }
        updateLastMessage(fullResponse);
      }
      if (buffer) {
        fullResponse += buffer;
        updateLastMessage(fullResponse);
      }
      if (!fullResponse.endsWith("\n")) {
        fullResponse += "\n";
        updateLastMessage(fullResponse);
      }
      // After each message, call agentApi.getSuggestion with the current messages and update agentStrategy, agentRationale, and agentNextSteps.
      const agentSuggestion = await agentApi.getSuggestion({
        messages: currentContext.messages.map((msg) => ({
          text: msg.text,
          sender: msg.sender,
        })),
        ...(currentContext.initialForm
          ? { initialForm: currentContext.initialForm }
          : {}),
      });
      setAgentStrategy(agentSuggestion.strategy);
      setAgentRationale(agentSuggestion.rationale);
      setAgentNextSteps(agentSuggestion.next_steps);
    } catch (error) {
      addMessage({
        sender: "user",
        text: error instanceof Error ? error.message : "AI error.",
        timestamp: new Date(),
        contextId: "default",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const sendCompanionMessage = async (message: string) => {
    if (userProfileLoading || !userProfile?.id) {
      addMessage({
        sender: "ai",
        text: "User profile not loaded. Please wait.",
        timestamp: new Date(),
        contextId: "default",
      });
      return;
    }
    setIsStreaming(true);
    try {
      // Use the AI companion chat API with client.api.chat.$post
      const response = await client.api.chat.$post({
        json: {
          message,
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
          ...(userProfile?.id ? { userId: String(userProfile.id) } : {}),
        },
      });
      if (!response.ok) throw new Error("Failed to get AI response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";
      // Add a temp ai message for streaming
      const tempId = Date.now();
      addMessage({
        sender: "ai",
        text: "",
        timestamp: new Date(),
        tempId,
        contextId: "default",
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            fullResponse += line.substring("data: ".length) + "\n";
          }
        }
        // Update the last message with the current stream
        updateLastMessage(fullResponse);
      }
      if (buffer) {
        fullResponse += buffer;
        updateLastMessage(fullResponse);
      }
      // Ensure the message ends with a newline for markdown rendering
      if (!fullResponse.endsWith("\n")) {
        fullResponse += "\n";
        updateLastMessage(fullResponse);
      }
      // After each message, call agentApi.getSuggestion with the current messages and update agentStrategy, agentRationale, and agentNextSteps.
      const agentSuggestion = await agentApi.getSuggestion({
        messages: currentContext.messages.map((msg) => ({
          text: msg.text,
          sender: msg.sender,
        })),
        ...(currentContext.initialForm
          ? { initialForm: currentContext.initialForm }
          : {}),
      });
      setAgentStrategy(agentSuggestion.strategy);
      setAgentRationale(agentSuggestion.rationale);
      setAgentNextSteps(agentSuggestion.next_steps);
    } catch (error) {
      addMessage({
        sender: "ai",
        text: error instanceof Error ? error.message : "AI error.",
        timestamp: new Date(),
        contextId: "default",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const startAutomation = async () => {
    if (!selectedThreadId) return;
    setAutomationRunning(true);
    automationAbortRef.current.aborted = false;
    setAutoStep(0);

    // Determine who should reply next based on the last message
    const messages = currentContext.messages;
    let turn = 0;
    const maxTurns = 40; // Prevent infinite loops
    let lastPatientMessage = initialPatientMessage;
    let lastCompanionMessage = "";

    // Find the last message sender
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    let nextResponder: "patient" | "companion" = "patient";
    if (lastMsg) {
      if (lastMsg.sender === "user") {
        nextResponder = "companion";
        lastPatientMessage = lastMsg.text;
      } else if (lastMsg.sender === "ai") {
        nextResponder = "patient";
        lastCompanionMessage = lastMsg.text;
      }
    }

    // If no messages, start with the patient as before
    if (!lastMsg) {
      await sendPatientMessage(lastPatientMessage);
      if (automationAbortRef.current.aborted) {
        setAutomationRunning(false);
        return;
      }
      await new Promise((res) => setTimeout(res, 500));
      nextResponder = "companion";
    }

    while (!automationAbortRef.current.aborted && turn < maxTurns) {
      if (nextResponder === "companion") {
        lastCompanionMessage =
          await sendCompanionMessageAndReturnText(lastPatientMessage);
        if (automationAbortRef.current.aborted) break;
        await new Promise((res) => setTimeout(res, 500));
        nextResponder = "patient";
      } else {
        lastPatientMessage =
          await sendPatientMessageAndReturnText(lastCompanionMessage);
        if (automationAbortRef.current.aborted) break;
        await new Promise((res) => setTimeout(res, 500));
        nextResponder = "companion";
      }
      turn++;
    }
    setAutomationRunning(false);
  };

  const stopAutomation = () => {
    setAutomationRunning(false);
    automationAbortRef.current.aborted = true;
  };

  // Helper: sendCompanionMessage but return the full streamed text
  const sendCompanionMessageAndReturnText = async (
    message: string
  ): Promise<string> => {
    if (userProfileLoading || !userProfile?.id) {
      addMessage({
        sender: "ai",
        text: "User profile not loaded. Please wait.",
        timestamp: new Date(),
        contextId: "default",
      });
      return "";
    }
    setIsStreaming(true);
    try {
      const response = await client.api.chat.$post({
        json: {
          message,
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
          ...(userProfile?.id ? { userId: String(userProfile.id) } : {}),
        },
      });
      if (!response.ok) throw new Error("Failed to get AI response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";
      const tempId = Date.now();
      addMessage({
        sender: "ai",
        text: "",
        timestamp: new Date(),
        tempId,
        contextId: "default",
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            fullResponse += line.substring("data: ".length) + "\n";
          }
        }
        updateLastMessage(fullResponse);
      }
      if (buffer) {
        fullResponse += buffer;
        updateLastMessage(fullResponse);
      }
      if (!fullResponse.endsWith("\n")) {
        fullResponse += "\n";
        updateLastMessage(fullResponse);
      }
      return fullResponse.trim();
    } catch (error) {
      addMessage({
        sender: "ai",
        text: error instanceof Error ? error.message : "AI error.",
        timestamp: new Date(),
        contextId: "default",
      });
      return "";
    } finally {
      setIsStreaming(false);
    }
  };

  // Helper: sendPatientMessage but return the full streamed text
  const sendPatientMessageAndReturnText = async (
    message: string
  ): Promise<string> => {
    setIsStreaming(true);
    try {
      const response = await client.api.patient.$post({
        json: {
          message,
          context: currentContext.messages.map((msg) => ({
            role: msg.sender === "ai" ? "model" : "user",
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
            ...(msg.contextId ? { contextId: msg.contextId } : {}),
          })),
          patientProgressLevel,
          ...(currentContext.initialForm
            ? { initialForm: currentContext.initialForm }
            : {}),
        },
      });
      if (!response.ok) throw new Error("Failed to get patient response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";
      const tempId = Date.now();
      addMessage({
        sender: "user",
        text: "",
        timestamp: new Date(),
        tempId,
        contextId: "default",
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            fullResponse += line.substring("data: ".length) + "\n";
          }
        }
        updateLastMessage(fullResponse);
      }
      if (buffer) {
        fullResponse += buffer;
        updateLastMessage(fullResponse);
      }
      if (!fullResponse.endsWith("\n")) {
        fullResponse += "\n";
        updateLastMessage(fullResponse);
      }
      return fullResponse.trim();
    } catch (error) {
      addMessage({
        sender: "user",
        text: error instanceof Error ? error.message : "AI error.",
        timestamp: new Date(),
        contextId: "default",
      });
      return "";
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (
      !isLoading &&
      threads &&
      threads.length > 0 &&
      selectedThreadId == null
    ) {
      setSelectedThreadId(threads[0].id);
    }
  }, [isLoading, threads, selectedThreadId]);

  useEffect(() => {
    // Run agent when selectedThreadId or messages change and there is at least one user message
    if (currentContext.messages.some((msg) => msg.sender === "user")) {
      (async () => {
        const agentSuggestion = await agentApi.getSuggestion({
          messages: currentContext.messages.map((msg) => ({
            text: msg.text,
            sender: msg.sender,
          })),
          ...(currentContext.initialForm
            ? { initialForm: currentContext.initialForm }
            : {}),
        });
        setAgentStrategy(agentSuggestion.strategy);
        setAgentRationale(agentSuggestion.rationale);
        setAgentNextSteps(agentSuggestion.next_steps);
      })();
    } else {
      setAgentStrategy("");
      setAgentRationale("");
      setAgentNextSteps([]);
    }
  }, [selectedThreadId, currentContext.messages]);

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <Sidebar
        threads={
          threads?.map((t) => ({
            id: t.id,
            title: getThreadTitle(t),
          })) || []
        }
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        selectedThreadId={selectedThreadId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <MobileTopbar onMenuClick={() => setIsSidebarOpen(true)} />
        <div className="absolute top-4 right-4 hidden md:flex items-center gap-4 z-20">
          <HeaderUser />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading threads...
          </div>
        ) : threads?.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center h-full space-y-4">
            <h2 className="text-2xl font-semibold text-gray-700">
              No Conversations Yet
            </h2>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-lg"
              onClick={() => setChatDialogOpen(true)}
            >
              Start a New Conversation
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col min-h-screen h-full bg-white md:max-w-4xl md:mx-auto md:py-6 py-0 w-full max-w-full flex-1">
              <div className="hidden md:block">
                <ChatHeader />
              </div>
              {/* Patient Progress Level Display and Legend Dialog */}
              <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
                <ProgressLevelDisplay progress={patientProgressLevel} />
                <ProgressHistorySparkline
                  progressHistory={progressHistory}
                  onOpenChart={() => setHistoryDialogOpen(true)}
                />
                <ProgressHistoryChartDialog
                  open={historyDialogOpen}
                  onOpenChange={setHistoryDialogOpen}
                  progressHistory={progressHistory}
                  progressRationales={progressRationales}
                />
                <ProgressRationaleCard rationale={progressRationale} />
              </div>
              <main className="flex-1 overflow-hidden md:pb-0 w-full flex flex-col ">
                {/* Agent Suggestion Display */}
                {(agentStrategy ||
                  agentRationale ||
                  (agentNextSteps && agentNextSteps.length > 0)) && (
                  <div className="mx-4 my-2 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                    <div className="font-semibold mb-1">Agent Suggestion</div>
                    {agentStrategy && (
                      <div className="mb-1">
                        <span className="font-medium">Strategy:</span>{" "}
                        {agentStrategy}
                      </div>
                    )}
                    {agentRationale && (
                      <div className="mb-1">
                        <span className="font-medium">Rationale:</span>{" "}
                        {agentRationale}
                      </div>
                    )}
                    {agentNextSteps && agentNextSteps.length > 0 && (
                      <div className="mb-1">
                        <span className="font-medium">Next Steps:</span>
                        <ul className="list-disc ml-6">
                          {agentNextSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <ChatInterface
                  messages={currentContext.messages}
                  onSendMessage={() => {}}
                  isLoading={isStreaming}
                  inputVisible={false}
                />
              </main>
            </div>
            {/* Automation Controls below chat input */}
            <div className="w-full flex justify-center py-4 bg-white border-t border-gray-100 sticky bottom-0 z-20">
              <Button
                onClick={startAutomation}
                disabled={automationRunning || !selectedThreadId}
                className=" bg-blue-600 hover:bg-blue-700"
              >
                Start Podcast
              </Button>
              <Button
                onClick={stopAutomation}
                disabled={!automationRunning}
                variant="destructive"
                className="ml-2 text-white"
              >
                Stop
              </Button>
            </div>
          </>
        )}
        <ChatDialog
          open={chatDialogOpen}
          onOpenChange={setChatDialogOpen}
          onSubmit={handleChatFormSubmit}
          onThreadCreated={(session) => {
            setSelectedThreadId(session.id);
            setChatDialogOpen(false);
          }}
        />
      </div>
    </div>
  );
}

export default Route.options.component;
