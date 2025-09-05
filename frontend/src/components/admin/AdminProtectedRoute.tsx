import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      console.log("Checking admin permissions...");
      console.log("Auth state:", { isLoaded, isSignedIn });
      console.log("User:", user?.id);
      console.log("User metadata:", user?.privateMetadata);
      
      if (isLoaded && isSignedIn && user) {
        const isUserAdmin = user.publicMetadata?.role === "admin";
        console.log("Is admin?", isUserAdmin);

        if (!isUserAdmin) {
          console.log("User is not admin, redirecting...");
          navigate({ to: "/" });
        } else {
          console.log("Admin access granted");
        }
      }
    };

    checkAdminStatus();
  }, [isLoaded, isSignedIn, user, navigate]);

  if (!isLoaded || !isSignedIn) {
    return <div className="p-8">Loading...</div>;
  }

  if (user?.publicMetadata?.role !== "admin") {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}