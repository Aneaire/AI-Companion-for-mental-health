import { generateFormApi, threadsApi } from "@/lib/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CheckCircle, 
  Loader2, 
  MessageSquare, 
  Star, 
  Brain, 
  Sparkles,
  AlertTriangle
} from "lucide-react";

interface Question {
  type: "text" | "textarea" | "select";
  label: string;
  name: string;
  options?: string[];
}

interface SessionManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionNumber: number;
  sessionId: number;
  messages: Array<{ sender: string; text: string }>;
  initialForm: any;
  onFormCompleted: (newSessionId: number) => void;
  threadId: number;
}

type DialogState = 
  | "generating" 
  | "form" 
  | "error";

export function SessionManagementDialog({
  open,
  onOpenChange,
  sessionNumber,
  sessionId,
  messages,
  initialForm,
  onFormCompleted,
  threadId,
}: SessionManagementDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("generating");
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm();

  // Auto-generate form when dialog opens
  useEffect(() => {
    if (open && dialogState === "generating") {
      generateForm();
    }
  }, [open]);

  const generateForm = async () => {
    setDialogState("generating");
    setError(null);

    try {
      console.log('[SESSION DIALOG] Generating form with data:', {
        initialForm,
        messages: messages.slice(0, 3), // Log first 3 messages for debugging
        messageCount: messages.length
      });
      
      // Validate that we have messages before generating form
      if (!messages || messages.length === 0) {
        throw new Error("Cannot generate follow-up form without conversation history. Please have a conversation first.");
      }
      
      // Filter out empty messages
      const validMessages = messages.filter(msg => msg.text && msg.text.trim().length > 0);
      
      if (validMessages.length === 0) {
        throw new Error("No valid conversation messages found to generate follow-up questions.");
      }
      
      const result = await generateFormApi.generate({
        initialForm: initialForm || {},
        messages: validMessages,
      });

      if (result.success && result.questions) {
        setGeneratedQuestions(result.questions);
        setDialogState("form");
      } else {
        throw new Error("Failed to generate valid questions");
      }
    } catch (err) {
      console.error("Error generating form:", err);
      setError(err instanceof Error ? err.message : "Failed to generate form");
      setDialogState("error");
    }
  };

  const handleFormSubmit = async (values: any) => {
    setIsSubmitting(true);
    
    try {
      console.log('[SESSION DIALOG] Submitting form for session:', sessionId, 'with values:', values);
      
      // 1. Save the form first
      const formResult = await threadsApi.saveSessionForm(sessionId, values);
      console.log('[SESSION DIALOG] Form submission result:', formResult);
      
      // 2. After form is saved, create the next session
      console.log('[SESSION DIALOG] Creating next session for thread:', threadId);
      const nextSessionResult = await threadsApi.createNextSession(threadId);
      console.log('[SESSION DIALOG] Next session created:', nextSessionResult);
      
      if (nextSessionResult.success && nextSessionResult.newSession) {
        toast.success(`Session ${sessionNumber} completed! Starting Session ${nextSessionResult.newSession.sessionNumber}.`);
        onOpenChange(false);
        onFormCompleted(nextSessionResult.newSession.id);
      } else {
        throw new Error("Failed to create next session");
      }
    } catch (err) {
      console.error("Error in form submission flow:", err);
      toast.error("Failed to complete session transition. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDialogContent = () => {
    switch (dialogState) {
      case "generating":
        return (
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
        );

      case "form":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Session {sessionNumber + 1} Follow-up Form
              </DialogTitle>
              <DialogDescription className="text-gray-600 mt-2">
                Please complete these questions based on your previous session to help prepare for your next conversation.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 max-h-96 overflow-y-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                  {generatedQuestions.map((q, idx) => (
                    <FormField
                      key={q.name || idx}
                      control={form.control}
                      name={q.name}
                      rules={{ required: "This field is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{q.label}</FormLabel>
                          <FormControl>
                            {q.type === "text" ? (
                              <Input {...field} placeholder="Your answer..." />
                            ) : q.type === "textarea" ? (
                              <Textarea {...field} placeholder="Please provide details..." rows={3} />
                            ) : q.type === "select" ? (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                                <SelectContent>
                                  {q.options?.map((opt: string) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} className="mr-2" />
                          Complete Form
                        </>
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </>
        );

      case "error":
        return (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                  <AlertTriangle size={32} className="text-white" />
                </div>
              </div>
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
                <Button
                  onClick={generateForm}
                  className="w-full"
                >
                  <MessageSquare size={16} className="mr-2" />
                  Try Again
                </Button>
                
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
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden">
        {renderDialogContent()}
      </DialogContent>
    </Dialog>
  );
}