import { ImpersonateDialog } from "@/components/chat/ImpersonateDialog";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";
import { impostorApi, threadsApi } from "@/lib/client";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import { useAuth } from "@clerk/clerk-react";
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
  const { setInitialForm } = useChatStore();
  const { conversationPreferences, setConversationPreferences } =
    useChatStore();

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
      setInitialForm({
        preferredName: thread.preferredName || thread.sessionName || "",
        reasonForVisit: thread.reasonForVisit || "",
        // add other required fields if needed
      });
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
    // 2. Create thread with personaId
    const newThread = await threadsApi.create({
      userId: payload.userId,
      personaId: persona.id,
      reasonForVisit: formData.problemDescription,
      preferredName: formData.fullName,
    });
    addPersonaThread(newThread);
    setSelectedThreadId(newThread.id);
    setInitialForm({
      preferredName: formData.fullName,
      reasonForVisit: formData.problemDescription,
      // add other required fields if needed
    });
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
        onNewThread={handleNewThread}
        selectedThreadId={selectedThreadId}
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
          <Thread
            selectedThreadId={selectedThreadId}
            isImpersonateMode={mode === "impersonate"}
          />
        </div>
      </div>
    </div>
  );
}

export default Impersonate;

export const Route = createFileRoute("/impersonate")({
  component: Impersonate,
});
