import { ImpersonateDialog } from "@/components/chat/ImpersonateDialog";
import { ImpersonateThread } from "@/components/chat/ImpersonateThread";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { impostorApi, personaLibraryApi } from "@/lib/client";
import { usePersonaThreads } from "@/lib/queries/threads";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function Impersonate() {
  // Mode: 'impersonate' (AI-AI) or 'chat' (user-AI)
  const [mode, setMode] = useState<"impersonate" | "chat">("impersonate");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const { userId: clerkId } = useAuth();
  const { data: userProfile, isLoading: userProfileLoading } = useUserProfile(
    clerkId || null
  );
  const { setInitialForm, clearMessages, setSessionId, setThreadId } =
    useChatStore();
  const { conversationPreferences, setConversationPreferences } =
    useChatStore();
  const queryClient = useQueryClient();
  const { data: personaThreadsApi, isLoading: threadsLoading } =
    usePersonaThreads(true);
  const personaThreads = useMemo(
    () => personaThreadsApi ?? [],
    [personaThreadsApi]
  );

  // Clear chat state when impersonate page loads
  useEffect(() => {
    clearMessages();
    setSessionId(null);
    setThreadId(null);
  }, [clearMessages, setSessionId, setThreadId]);

  // Select the first thread on first render if available
  useEffect(() => {
    if (
      Array.isArray(personaThreads) &&
      personaThreads.length > 0 &&
      selectedThreadId == null
    ) {
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
    sessionId: any,
    templateId?: number | null
  ) => {
    // Use userId from formData or fallback to current user
    const userId = userProfile?.id;
    if (userId === undefined) {
      toast.error("User ID is missing. Cannot create persona.");
      return;
    }
    // Create persona using the new persona library API
    let persona;
    if (templateId) {
      // Create from template
      persona = await personaLibraryApi.createFromTemplate({
        templateId,
        customizations: {
          fullName: formData.fullName,
          age: formData.age,
          problemDescription: formData.problemDescription,
          background: formData.background,
          personality: formData.personality,
        },
      });
    } else {
      // For now, create a basic persona. In a full implementation,
      // you'd have a dedicated create endpoint
      persona = await personaLibraryApi.createFromTemplate({
        templateId: 1, // Default template
        customizations: {
          fullName: formData.fullName,
          age: formData.age,
          problemDescription: formData.problemDescription,
          background: formData.background,
          personality: formData.personality,
        },
      });
    }

    // Invalidate persona library queries
    await queryClient.invalidateQueries({
      queryKey: ["personaLibrary"],
    });

    // 2. Create thread with personaId using the existing impostor API for now
    // TODO: Update to use new persona thread API when implemented
    const newThread = await impostorApi.createThread({
      userId: userId,
      personaId: persona.id,
      reasonForVisit: formData.problemDescription,
      preferredName: formData.fullName,
    });
    // Optimistically add to personaThreads cache
    queryClient.setQueryData(["personaThreads", userId], (old: any) =>
      Array.isArray(old) ? [newThread, ...old] : [newThread]
    );
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

  // Move thread to top when used
  const handleThreadActivity = useCallback(
    (threadId: number) => {
      const thread = personaThreads.find((t) => t.id === threadId);
      if (!thread) return;
      queryClient.setQueryData(
        ["personaThreads", userProfile?.id],
        (old: any) => {
          if (!Array.isArray(old)) return old;
          const remaining = old.filter((t: any) => t.id !== threadId);
          return [thread, ...remaining];
        }
      );
    },
    [personaThreads, queryClient, userProfile?.id]
  );

  // Memoized sidebar threads to always reflect latest personaThreads order
  const sidebarThreads = useMemo(
    () =>
      (Array.isArray(personaThreads) ? personaThreads : []).map((t) => ({
        id: t.id,
        title: t.sessionName || t.reasonForVisit || `Thread #${t.id}`,
      })),
    [personaThreads]
  );

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
        threads={sidebarThreads}
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
          {threadsLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading threads...
            </div>
          ) : (
             <ImpersonateThread
               selectedThreadId={selectedThreadId}
               onThreadActivity={handleThreadActivity}
               preferences={conversationPreferences}
               onPreferencesChange={setConversationPreferences}
             />
          )}
        </div>
      </div>
    </div>
  );
}

export default Impersonate;

export const Route = createFileRoute("/impersonate")({
  component: Impersonate,
});

