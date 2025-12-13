import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";

interface AccessStatusIndicatorProps {
  userId: number;
  threadId?: number;
  accessType: 'user_threads' | 'thread_details' | 'thread_messages';
  onRequestAccess: () => void;
  compact?: boolean;
}

interface AccessStatus {
  hasAccess: boolean;
  expiresAt: string | null;
  accessType: string;
  userId: number;
  threadId: number | null;
}

export function AccessStatusIndicator({
  userId,
  threadId,
  accessType,
  onRequestAccess,
  compact = false
}: AccessStatusIndicatorProps) {
  const { getToken } = useAuth();

  // Use TanStack Query for automatic cache invalidation
  const { data: status, isLoading, error } = useQuery<AccessStatus>({
    queryKey: ["accessStatus", userId, threadId, accessType],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No authentication token");

      const params = new URLSearchParams({
        userId: userId.toString(),
        accessType,
        ...(threadId && { threadId: threadId.toString() })
      });

      const response = await fetch(`/api/admin/thread-access/check?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check access status');
      }

      return response.json();
    },
  });

  const getTimeRemaining = () => {
    if (!status?.expiresAt) return null;

    const expiresAt = new Date(status.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const getStatusDisplay = () => {
    if (isLoading) {
      return {
        variant: 'secondary' as const,
        text: 'Checking access...',
        icon: <Clock className="h-3 w-3" />,
      };
    }

    if (error) {
      return {
        variant: 'destructive' as const,
        text: 'Access check failed',
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    }

    if (status?.hasAccess) {
      const timeRemaining = getTimeRemaining();
      return {
        variant: 'default' as const,
        text: timeRemaining || 'Access granted',
        icon: <CheckCircle className="h-3 w-3" />,
      };
    }

    return {
      variant: 'outline' as const,
      text: 'Access required',
      icon: <Shield className="h-3 w-3" />,
    };
  };

  const statusDisplay = getStatusDisplay();

  if (compact) {
    return (
      <Badge variant={statusDisplay.variant} className="flex items-center gap-1">
        {statusDisplay.icon}
        {statusDisplay.text}
      </Badge>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant={statusDisplay.variant} className="flex items-center gap-1">
          {statusDisplay.icon}
          {statusDisplay.text}
        </Badge>

        {!status?.hasAccess && !isLoading && !error && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRequestAccess}
            className="text-xs"
          >
            Request Access
          </Button>
        )}
      </div>

      {status?.hasAccess && status.expiresAt && (
        <div className="text-xs text-gray-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Expires: {new Date(status.expiresAt).toLocaleString()}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {error instanceof Error ? error.message : 'Failed to check access'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}