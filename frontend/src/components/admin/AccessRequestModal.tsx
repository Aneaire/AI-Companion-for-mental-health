import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Clock } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";

interface AccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  threadId?: number;
  accessType: 'user_threads' | 'thread_details' | 'thread_messages';
  userName?: string;
  onRequestSubmitted: (requestId: number) => void;
}

export function AccessRequestModal({
  isOpen,
  onClose,
  userId,
  threadId,
  accessType,
  userName,
  onRequestSubmitted
}: AccessRequestModalProps) {
  const { getToken } = useAuth();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getAccessTypeDescription = () => {
    switch (accessType) {
      case 'user_threads':
        return 'viewing this user\'s conversation threads';
      case 'thread_details':
        return 'accessing detailed thread analysis';
      case 'thread_messages':
        return 'viewing thread message content';
      default:
        return 'accessing user data';
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for accessing this data.");
      return;
    }

    if (reason.trim().length < 10) {
      setError("Please provide a more detailed reason (at least 10 characters).");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch('/api/admin/thread-access/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          threadId,
          accessType,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit access request');
      }

      const data = await response.json();
      onRequestSubmitted(data.accessLog.id);
      onClose();
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason("");
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Request Data Access
          </DialogTitle>
          <DialogDescription>
            To maintain privacy and security, you need to provide a reason for {getAccessTypeDescription()}
            {userName && ` for ${userName}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Clock className="h-4 w-4" />
              <span>Access will be granted for 24 hours once approved</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Access *</Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you need to access this user's data..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={isSubmitting}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              Be specific about your purpose. This helps maintain accountability and privacy.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting Access...
                </>
              ) : (
                'Request Access'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}