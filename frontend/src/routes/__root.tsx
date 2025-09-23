import { UserProfileDialog } from "@/components/UserProfileDialog";
import { useAuth } from "@clerk/clerk-react";
import {
  createRootRouteWithContext,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";

import { ParticlesBackground } from "@/components/common/Particle";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useCreateThread, usePersonaThreads } from "@/lib/queries/threads";
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
    const location = useLocation();
    const isImpersonatePage = location.pathname === "/impersonate";
    const { data: personaThreadsApi, isLoading: isPersonaLoading } =
      usePersonaThreads(isImpersonatePage);
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
    // No local store for personaThreads; component pages will read directly from query

    useEffect(() => {
      if (
        !isPersonaLoading &&
        Array.isArray(personaThreadsApi) &&
        personaThreadsApi.length > 0 &&
        selectedThreadId == null
      ) {
        setSelectedThreadId(personaThreadsApi[0].id);
      }
    }, [isPersonaLoading, personaThreadsApi, selectedThreadId]);

    useEffect(() => {
      if (isError) {
        setIsProfileOpen(true);
      }
    }, [isError]);

    return (
      <>
        <div className="min-h-screen w-screen relative overflow-auto">
          <ParticlesBackground />
          <div className="relative z-10 min-h-full w-full flex flex-col">
            <SignedIn>
              <div className="flex min-h-screen w-full min-h-0">
                <div className="flex-1 flex flex-col overflow-auto relative">
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

