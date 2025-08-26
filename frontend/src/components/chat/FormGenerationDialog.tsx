import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Brain, Loader2, MessageSquare, Sparkles } from "lucide-react";

interface FormGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGenerating: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function FormGenerationDialog({
  open,
  onOpenChange,
  isGenerating,
  error,
  onRetry,
}: FormGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {isGenerating ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg animate-pulse">
                    <Brain size={32} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <Loader2 size={14} className="text-indigo-600 animate-spin" />
                  </div>
                </div>
              </div>
              <DialogTitle className="text-center text-xl">
                Creating Your Personalized Form
              </DialogTitle>
              <DialogDescription className="text-center text-gray-600 mt-2">
                Our AI is analyzing your conversation to generate relevant follow-up questions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/60 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-900 mb-1">What we're doing</h4>
                    <p className="text-sm text-purple-800 leading-relaxed">
                      Using your previous messages to create questions that will help your therapist 
                      understand your current state and progress.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-1">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>

              <p className="text-center text-sm text-gray-500">
                This usually takes 10-30 seconds...
              </p>
            </div>
          </>
        ) : error ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-xl text-red-600">
                Something went wrong
              </DialogTitle>
              <DialogDescription className="text-center text-gray-600 mt-2">
                We couldn't generate your form at this time.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>

              <div className="flex flex-col gap-2">
                {onRetry && (
                  <Button
                    onClick={onRetry}
                    className="w-full"
                  >
                    <MessageSquare size={16} className="mr-2" />
                    Try Again
                  </Button>
                )}
                
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}