import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Loader2, MessageSquare, Star } from "lucide-react";

interface SessionCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueToForm: () => void;
  sessionNumber: number;
}

export function SessionCompletionDialog({
  open,
  onOpenChange,
  onContinueToForm,
  sessionNumber,
}: SessionCompletionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <CheckCircle size={32} className="text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Session {sessionNumber} Complete!
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600 mt-2">
            Great work! You've successfully completed this therapy session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Star size={16} className="text-white" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">What's Next?</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  To start your next session, we'll need you to complete a brief follow-up form. 
                  This helps us understand your progress and prepare personalized questions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={onContinueToForm}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              <MessageSquare size={16} className="mr-2" />
              Continue to Follow-up Form
            </Button>
            
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full"
            >
              I'll do this later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
