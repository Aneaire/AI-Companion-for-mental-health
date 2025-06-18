import { UserProfileDialog } from "@/components/UserProfileDialog";
import { useAuth } from "@clerk/clerk-react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";

import { ParticlesBackground } from "@/components/common/Particle";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useUserProfile } from "@/lib/queries/user";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => {
    const { userId, isLoaded } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { data: userProfile, isError } = useUserProfile(userId || null);

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
              <div className="flex-1 flex h-full w-full">
                <Outlet />
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
            <TanStackRouterDevtools />
          </div>
        </div>
        <Toaster />
      </>
    );
  },
});
