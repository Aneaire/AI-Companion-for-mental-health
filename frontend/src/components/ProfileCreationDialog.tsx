import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@clerk/clerk-react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ProfileCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileCreationDialog({
  open,
  onOpenChange,
}: ProfileCreationDialogProps) {
  const { user } = useUser();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      createProfile();
    }
  }, [open, user]);

  const createProfile = async () => {
    if (!user) return;
    
    try {
      setStatus("loading");
      setError(null);

      const response = await fetch("/api/user/auto-create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress || "",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          profileImageUrl: user.imageUrl || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create profile");
      }

      setStatus("success");
      
      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      console.error("Error creating profile:", error);
      setStatus("error");
      setError(error instanceof Error ? error.message : "Failed to create profile");
    }
  };

  const getContent = () => {
    switch (status) {
      case "loading":
        return (
          <div className="flex flex-col items-center space-y-4 py-8">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Creating Your Profile</h3>
              <p className="text-sm text-gray-500">
                Setting up your account with your Clerk information...
              </p>
            </div>
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center space-y-4 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Profile Created!</h3>
              <p className="text-sm text-gray-500">
                Your account has been successfully set up.
              </p>
            </div>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center space-y-4 py-8">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-xl">✕</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Creation Failed</h3>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
            <Button onClick={createProfile} variant="outline">
              Try Again
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Account Setup</DialogTitle>
          <DialogDescription>
            Creating your profile using your Clerk account information
          </DialogDescription>
        </DialogHeader>
        {getContent()}
      </DialogContent>
    </Dialog>
  );
}