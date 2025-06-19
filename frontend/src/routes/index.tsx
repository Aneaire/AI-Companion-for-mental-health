import { ChatDialog } from "@/components/chat/ChatDialog";
import MobileTopbar from "@/components/chat/MobileTopbar";
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
  component: Index,
});

function Index() {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { data: threads, isLoading } = useThreads();
  const createThread = useCreateThread();

  const handleSelectThread = (id: number) => {
    setSelectedThreadId(id);
  };

  const handleNewThread = () => {
    setChatDialogOpen(true);
  };

  const handleChatFormSubmit = async (data: any) => {
    try {
      const newThread = await createThread.mutateAsync(data);
      setSelectedThreadId(newThread.id);
      setChatDialogOpen(false);
    } catch (error) {
      console.error("Error creating thread:", error);
    }
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
        {/* Mobile Topbar */}
        <MobileTopbar onMenuClick={() => setIsSidebarOpen(true)} />
        {/* Desktop header */}
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
}

export default Route.options.component;
