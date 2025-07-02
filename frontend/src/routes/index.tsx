import { ChatDialog } from "@/components/chat/ChatDialog";
import type { FormData } from "@/components/chat/ChatForm";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Thread } from "@/components/chat/Thread";
import { useCreateThread, useThreads } from "@/lib/queries/threads";
import { useChatStore } from "@/stores/chatStore";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

function getThreadTitle(thread: any) {
  if (thread.sessionName) return thread.sessionName;
  if (thread.reasonForVisit) return thread.reasonForVisit;
  if (thread.createdAt) {
    const date = new Date(thread.createdAt);
    return `Thread #${thread.id} (${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }
  return `Thread #${thread.id}`;
}

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { data: threads, isLoading } = useThreads();
  const createThread = useCreateThread();
  const { addMessage, setSessionId, clearMessages } = useChatStore();

  const handleSelectThread = (id: number) => {
    setSelectedThreadId(id);
  };

  const handleNewThread = () => {
    setChatDialogOpen(true);
  };

  const handleChatFormSubmit = (
    formData: FormData,
    aiResponse: string,
    sessionId: number
  ) => {
    // Set the new session and clear previous messages
    setSessionId(sessionId);
    clearMessages();
    // Remove leading digits and whitespace from the AI response
    const cleanAIResponse = aiResponse.replace(/^[0-9]+/, "").trim();
    addMessage({
      sender: "ai",
      text: cleanAIResponse,
      timestamp: new Date(),
      contextId: "default",
    });
  };

  // Close sidebar when window is resized to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // md breakpoint
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-select the first thread on load if none is selected
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

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Topbar */}
        <MobileTopbar onMenuClick={() => setIsSidebarOpen(true)} />

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
          <Thread selectedThreadId={selectedThreadId} />
        )}
        {/* Always render ChatDialog so it can be opened from anywhere */}
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
