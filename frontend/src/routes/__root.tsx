import { UserProfileDialog } from "@/components/UserProfileDialog";
import { useAuth } from "@clerk/clerk-react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";

import { ParticlesBackground } from "@/components/common/Particle";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import HeaderUser from "@/integrations/clerk/header-user";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => {
    const { userId, isLoaded } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isProfileChecked, setIsProfileChecked] = useState(false);

    useEffect(() => {
      const checkUserProfile = async () => {
        if (!userId) return;

        try {
          const response = await fetch(`/api/user/profile/${userId}`);
          if (!response.ok) {
            // If user profile doesn't exist, show the dialog
            setIsProfileOpen(true);
          }
        } catch (error) {
          console.error("Error checking user profile:", error);
        } finally {
          setIsProfileChecked(true);
        }
      };

      if (userId) {
        checkUserProfile();
      }
    }, [userId]);

    return (
      <>
        <div className="min-h-screen relative">
          <ParticlesBackground />

          <div className="relative z-10">
            <div className="absolute md:top-4 md:right-10 top-2 right-4 scale-125">
              <SignedIn>
                <HeaderUser />
              </SignedIn>
            </div>
            <SignedIn>
              <div className="container mx-auto md:p-4 p-2">
                <Outlet />
              </div>
              {userId && isProfileChecked && (
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
      </>
    );
  },
});
