import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional: specify which roles can access this route
}

export function AdminProtectedRoute({ children, allowedRoles = ['superadmin', 'admin', 'observer'] }: AdminProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isLoaded && isSignedIn && user) {
        const userRole = user.publicMetadata?.role as string;
        const hasAccess = userRole && allowedRoles.includes(userRole);

        if (!hasAccess) {
          navigate({ to: "/" });
        }
      }
    };

    checkAdminStatus();
  }, [isLoaded, isSignedIn, user, navigate]);

  if (!isLoaded || !isSignedIn) {
    return <div className="p-8">Loading...</div>;
  }

  const userRole = user?.publicMetadata?.role as string;
  const hasAccess = userRole && allowedRoles.includes(userRole);
  if (!hasAccess) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}

// Specialized route protection for Monitor Threads (observer access)
export function ObserverProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AdminProtectedRoute allowedRoles={['superadmin', 'admin', 'observer']}>
      {children}
    </AdminProtectedRoute>
  );
}
