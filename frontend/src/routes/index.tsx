import { ChatDialog } from "@/components/chat/ChatDialog";
import { Sidebar } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";
import HeaderUser from "@/integrations/clerk/header-user";
import { useCreateThread, useThreads } from "@/lib/queries/threads";
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
  component: function IndexPage() {
    const { data: threads = [], isLoading, refetch } = useThreads();
    const createThread = useCreateThread();
    const [selectedThreadId, setSelectedThreadId] = useState<number | null>(
      null
    );
    const [chatDialogOpen, setChatDialogOpen] = useState(false);
    const [pendingThreadId, setPendingThreadId] = useState<number | null>(null);

    // Select first thread when loaded
    useEffect(() => {
      if (!isLoading && threads.length > 0 && selectedThreadId == null) {
        setSelectedThreadId(threads[0].id);
      }
    }, [isLoading, threads, selectedThreadId]);

    useEffect(() => {
      if (pendingThreadId && threads.some((t) => t.id === pendingThreadId)) {
        setSelectedThreadId(pendingThreadId);
        setPendingThreadId(null);
      }
    }, [threads, pendingThreadId]);

    // Add a new useEffect to refetch threads when pendingThreadId is set
    useEffect(() => {
      if (pendingThreadId) {
        // Refetch threads to ensure the new thread is included
        refetch();
      }
    }, [pendingThreadId, refetch]);

    const handleSelectThread = (id: number) => {
      setSelectedThreadId(id);
    };

    // Called after ChatForm is submitted in ChatDialog
    const handleChatFormSubmit = async (
      formData: any,
      aiResponse: string,
      sessionId: number
    ) => {
      setChatDialogOpen(false);
      setPendingThreadId(sessionId);
    };

    const handleNewThread = () => {
      setChatDialogOpen(true);
    };

    return (
      <div className="flex h-screen w-full">
        <Sidebar
          threads={threads.map((t) => ({
            id: t.id,
            title: getThreadTitle(t),
          }))}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          selectedThreadId={selectedThreadId}
        />
        <div className="flex-1 flex flex-col overflow-hidden pb-5 relative">
          <div className="absolute top-5 right-5 scale-125">
            <HeaderUser />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              Loading threads...
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-1 items-center justify-center h-full">
              <button
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg font-semibold shadow-lg hover:scale-105 transition"
                onClick={() => setChatDialogOpen(true)}
              >
                Start a New Conversation
              </button>
              <ChatDialog
                open={chatDialogOpen}
                onOpenChange={setChatDialogOpen}
                onSubmit={handleChatFormSubmit}
              />
            </div>
          ) : (
            <Thread selectedThreadId={selectedThreadId} />
          )}
        </div>
      </div>
    );
  },
});

export default Route.options.component;
