import { UserProfileDialog } from "@/components/UserProfileDialog";
import { useAuth } from "@clerk/clerk-react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";

import { Sidebar } from "@/components/chat/Sidebar";
import { ParticlesBackground } from "@/components/common/Particle";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useCreateThread, useThreads } from "@/lib/queries/threads";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

// Sidebar context for sharing state
export const SidebarContext = createContext<any>(null);
export const useSidebarContext = () => useContext(SidebarContext);

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => {
    const { userId, isLoaded } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { data: userProfile, isError } = useUserProfile(userId || null);

    // Sidebar and thread state
    const [selectedThreadId, setSelectedThreadId] = useState<number | null>(
      null
    );
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
    // Close sidebar when window is resized to desktop
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth >= 768) {
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

    useEffect(() => {
      if (isError) {
        setIsProfileOpen(true);
      }
    }, [isError]);

    return (
      <>
        <div className="h-screen w-screen relative overflow-hidden">
          <ParticlesBackground />
          <div className="relative z-10 h-full w-full flex flex-col">
            <SignedIn>
              <div className="flex h-full w-full">
                <Sidebar
                  threads={
                    threads?.map((t) => ({
                      id: t.id,
                      title:
                        t.sessionName || t.reasonForVisit || `Thread #${t.id}`,
                    })) || []
                  }
                  onSelectThread={handleSelectThread}
                  onNewThread={handleNewThread}
                  selectedThreadId={selectedThreadId}
                  isOpen={isSidebarOpen}
                  onClose={() => setIsSidebarOpen(false)}
                />
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <SidebarContext.Provider
                    value={{
                      selectedThreadId,
                      setSelectedThreadId,
                      setIsSidebarOpen,
                      chatDialogOpen,
                      setChatDialogOpen,
                      handleNewThread,
                      handleSelectThread,
                    }}
                  >
                    <Outlet />
                  </SidebarContext.Provider>
                </div>
              </div>
              {userId && (
                <UserProfileDialog
                  open={isProfileOpen}
                  onOpenChange={setIsProfileOpen}
                  clerkId={userId}
                />
              )}
            </SignedIn>
            <SignedOut>
              <WelcomeScreen />
            </SignedOut>
            {/* <TanStackRouterDevtools /> */}
          </div>
        </div>
        <Toaster />
      </>
    );
  },
});
