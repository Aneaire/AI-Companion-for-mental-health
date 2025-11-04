import { useState } from "react";
import { AlertTriangle, Phone, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CrisisButtonProps {
  className?: string;
}

export function CrisisButton({ className }: CrisisButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low" | "medium" | "high">("medium");


  const crisisResources = [
    {
      name: "National Suicide Prevention Lifeline",
      phone: "988",
      description: "24/7 free, confidential support"
    },
    {
      name: "Crisis Text Line",
      phone: "Text HOME to 741741",
      description: "Text with a trained crisis counselor"
    }
  ];

  const handleSubmit = async () => {
    if (!requestReason.trim()) {
      toast.error("Please describe why you need to speak with a counselor.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/counselor/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestReason: requestReason.trim(),
          urgencyLevel,
          userContext: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("A counselor will be with you shortly. You'll be connected automatically.");

      setIsOpen(false);
      setRequestReason("");
      setUrgencyLevel("medium");

    } catch (error) {
      console.error("Counselor request error:", error);
      toast.error(error instanceof Error ? error.message : "Unable to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="destructive"
        size="lg"
        className={`relative overflow-hidden group ${className}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
          <span className="font-semibold">Need to Talk to a Counselor?</span>
        </div>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              Connect with a Counselor
            </DialogTitle>
            <DialogDescription>
              If you're going through a difficult time, our trained counselors are here to help. 
              This service is confidential and available 24/7.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="urgency">How urgent is this?</Label>
              <Select value={urgencyLevel} onValueChange={(value: "low" | "medium" | "high") => setUrgencyLevel(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - I'd like to talk sometime soon</SelectItem>
                  <SelectItem value="medium">Medium - I need to talk soon</SelectItem>
                  <SelectItem value="high">High - I need to talk immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">What would you like to talk about?</Label>
              <Textarea
                id="reason"
                placeholder="Please share what's on your mind. This helps us connect you with the right counselor..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">Immediate Crisis Resources</h4>
              <div className="space-y-2 text-sm">
                {crisisResources.map((resource, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-red-800">{resource.name}</div>
                      <div className="text-red-600">{resource.phone}</div>
                      <div className="text-red-700">{resource.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !requestReason.trim()}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Connect with Counselor
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}