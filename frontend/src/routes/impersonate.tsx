import { ImpersonateDialog } from "@/components/chat/ImpersonateDialog";
import { ImpersonateThread } from "@/components/chat/ImpersonateThread";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { impostorApi } from "@/lib/client";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function Impersonate() {
  // Mode: 'impersonate' (AI-AI) or 'chat' (user-AI)
  const [mode, setMode] = useState<"impersonate" | "chat">("impersonate");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const { personaThreads, addPersonaThread } = useThreadsStore();
  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );
  const { setInitialForm, clearMessages, setSessionId, setThreadId } =
    useChatStore();
  const { conversationPreferences, setConversationPreferences } =
    useChatStore();
  const queryClient = useQueryClient();

  // Clear chat state when impersonate page loads
  useEffect(() => {
    clearMessages();
    setSessionId(null);
    setThreadId(null);
  }, [clearMessages, setSessionId, setThreadId]);

  // Select the first thread on first render if available
  useEffect(() => {
    if (personaThreads.length > 0 && selectedThreadId == null) {
      setSelectedThreadId(personaThreads[0].id);
    }
  }, [personaThreads, selectedThreadId]);

  const handleSelectThread = (id: number) => {
    setSelectedThreadId(id);
    setIsSidebarOpen(false); // close on mobile
    // Find the selected thread and set initial form
    const thread = personaThreads.find((t) => t.id === id);
    if (thread) {
      setInitialForm(
        {
          preferredName: thread.preferredName || thread.sessionName || "",
          reasonForVisit: thread.reasonForVisit || "",
          // add other required fields if needed
        },
        id
      );
    }
  };

  const handleNewThread = () => {
    setImpersonateDialogOpen(true);
  };

  const handleImpersonateSubmit = async (
    formData: any,
    aiResponse: any,
    sessionId: any
  ) => {
    // Use userId from formData or fallback to current user
    const userId = userProfile?.id;
    if (userId === undefined) {
      toast.error("User ID is missing. Cannot create persona.");
      return;
    }
    const payload = {
      userId,
      fullName: formData.fullName,
      age: String(formData.age),
      problemDescription: formData.problemDescription,
      background: formData.background,
      personality: formData.personality,
    };
    console.log("[impostorApi.upsertProfile] Sending data:", payload);
    const persona = await impostorApi.upsertProfile(payload);

    // Invalidate the impostor profile query to fetch the newly created profile
    await queryClient.invalidateQueries({
      queryKey: ["impostorProfile", userId],
    });

    // 2. Create thread with personaId
    const newThread = await impostorApi.createThread({
      userId: payload.userId,
      personaId: persona.id,
      reasonForVisit: formData.problemDescription,
      preferredName: formData.fullName,
    });
    addPersonaThread(newThread);
    setSelectedThreadId(newThread.id);
    setInitialForm(
      {
        preferredName: formData.fullName,
        reasonForVisit: formData.problemDescription,
        // add other required fields if needed
      },
      newThread.id
    );
    setImpersonateDialogOpen(false);
  };

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
        threads={personaThreads.map((t) => ({
          id: t.id,
          title: t.sessionName || t.reasonForVisit || `Thread #${t.id}`,
        }))}
        onSelectThread={handleSelectThread}
        onSelectSession={() => {}} // No session management for impersonate
        onNewThread={handleNewThread}
        onNewSession={() => {}} // No session creation for impersonate
        selectedThreadId={selectedThreadId}
        selectedSessionId={null} // No session selection for impersonate
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-h-0">
        <ImpersonateDialog
          open={impersonateDialogOpen}
          onOpenChange={setImpersonateDialogOpen}
          onSubmit={handleImpersonateSubmit}
        />

        <div className="flex-1 min-h-0">
          <ImpersonateThread selectedThreadId={selectedThreadId} />
        </div>
      </div>
    </div>
  );
}

export default Impersonate;

export const Route = createFileRoute("/impersonate")({
  component: Impersonate,
});
