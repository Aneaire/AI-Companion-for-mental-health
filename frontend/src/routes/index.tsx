import { ChatDialog } from "@/components/chat/ChatDialog";
import type { FormData } from "@/components/chat/ChatForm";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";
import { useCreateThread, useNormalThreads } from "@/lib/queries/threads";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { conversationPreferences, setConversationPreferences } =
    useChatStore();

  const { data: threadsApi, isLoading } = useNormalThreads(true);
  const { normalThreads, setNormalThreads, addNormalThread } =
    useThreadsStore();
  useEffect(() => {
    if (!isLoading && Array.isArray(threadsApi)) {
      setNormalThreads(threadsApi);
    }
  }, [isLoading, threadsApi, setNormalThreads]);
  const threadsWithoutPersona = normalThreads;
  const createThread = useCreateThread();
  const { addMessage, setSessionId, clearMessages } = useChatStore();

  const handleSelectThread = (id: number) => {
    if (threadsWithoutPersona.some((t) => t.id === id)) {
      setSelectedThreadId(id);
    }
  };

  const handleNewThread = () => {
    setChatDialogOpen(true);
  };

  const handleChatFormSubmit = (
    formData: FormData,
    aiResponse: string,
    sessionId: number,
    newThread?: any
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
    if (newThread) {
      addNormalThread(newThread);
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
      threadsWithoutPersona.length > 0 &&
      selectedThreadId == null
    ) {
      setSelectedThreadId(threadsWithoutPersona[0].id);
    }
  }, [isLoading, threadsWithoutPersona, selectedThreadId]);

  return (
    <div className="flex h-screen w-full">
      {/* Mobile Topbar for mobile screens */}
      <div className="md:hidden w-full fixed top-0 left-0 z-50">
        <MobileTopbar
          onMenuClick={() => setIsSidebarOpen(true)}
          preferences={conversationPreferences}
          onPreferencesChange={setConversationPreferences}
        />
      </div>
      <Sidebar
        threads={threadsWithoutPersona.map((t) => ({
          id: t.id,
          title: getThreadTitle(t),
        }))}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        selectedThreadId={selectedThreadId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <MobileTopbar
          onMenuClick={() => setIsSidebarOpen(true)}
          preferences={conversationPreferences}
          onPreferencesChange={setConversationPreferences}
        />
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading threads...
          </div>
        ) : threadsWithoutPersona.length === 0 ? (
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
