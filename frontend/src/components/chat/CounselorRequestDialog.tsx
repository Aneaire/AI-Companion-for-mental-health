import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@clerk/clerk-react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CounselorRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSubmitted?: () => void;
  requestLimit?: {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
  };
}

export function CounselorRequestDialog({ 
  open, 
  onOpenChange, 
  onRequestSubmitted,
  requestLimit 
}: CounselorRequestDialogProps) {
  const { getToken } = useAuth();
  const [requestReason, setRequestReason] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!requestReason.trim()) {
      toast.error("Please provide a reason for your request");
      return;
    }

    if (requestReason.trim().length < 10) {
      toast.error("Request reason must be at least 10 characters");
      return;
    }

    if ((requestLimit?.remaining || 0) === 0) {
      toast.error("You've reached your daily request limit");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch("/api/counselor/request", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestReason: requestReason.trim(),
          urgencyLevel,
          userContext: {
            requestedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            source: "sidebar_dialog"
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      toast.success("Counselor request submitted successfully");
      setRequestReason("");
      setUrgencyLevel("medium");
      onOpenChange(false);
      onRequestSubmitted?.();
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRequestReason("");
      setUrgencyLevel("medium");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Counselor Support</DialogTitle>
          <DialogDescription>
            Connect with a professional counselor for personalized support and guidance.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Request Limit Info */}
          {requestLimit && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  Daily Requests
                </span>
                <span className="text-sm text-blue-700">
                  {requestLimit.remaining} of {requestLimit.limit} remaining
                </span>
              </div>
              {requestLimit.remaining === 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-blue-700">
                  <AlertTriangle className="h-3 w-3" />
                  Resets at {new Date(requestLimit.resetsAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {/* Urgency Level */}
          <div className="space-y-2">
            <Label htmlFor="urgency">Urgency Level</Label>
            <Select 
              value={urgencyLevel} 
              onValueChange={(value: any) => setUrgencyLevel(value)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select urgency level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - General support</SelectItem>
                <SelectItem value="medium">Medium - Need guidance</SelectItem>
                <SelectItem value="high">High - Immediate support needed</SelectItem>
                <SelectItem value="urgent">Urgent - Crisis situation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Request Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Request</Label>
            <Textarea
              id="reason"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Please describe why you need counselor support..."
              className="min-h-[100px]"
              maxLength={500}
              disabled={isSubmitting}
            />
            <div className="flex justify-between">
              <p className="text-xs text-muted-foreground">
                {requestReason.length}/500 characters
              </p>
              {requestReason.length < 10 && requestReason.length > 0 && (
                <p className="text-xs text-red-500">
                  Minimum 10 characters required
                </p>
              )}
            </div>
          </div>

          {/* Crisis Resources */}
          {urgencyLevel === "urgent" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-xs text-red-700">
                  <p className="font-medium mb-1">Crisis Resources</p>
                  <p>If you're in immediate danger, please call emergency services or a crisis hotline.</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !requestReason.trim() || requestReason.trim().length < 10 || (requestLimit?.remaining || 0) === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}