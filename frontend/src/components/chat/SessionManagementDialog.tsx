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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  Loader2, 
  MessageSquare, 
  Star, 
  Brain, 
  Sparkles,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  User,
  Heart,
  MessageCircle
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
  onQuestionsGenerated?: (questions: any[]) => void;
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
  onQuestionsGenerated,
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
        onQuestionsGenerated?.(result.questions);
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
      const formResult = await threadsApi.saveSessionForm(sessionId, values, generatedQuestions);
      const nextSessionResult = await threadsApi.createNextSession(threadId);
      
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
            <DialogHeader className="text-center pb-2">
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl animate-pulse">
                    <Brain size={36} className="text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-indigo-100">
                    <Loader2 size={16} className="text-indigo-600 animate-spin" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Creating Your Personalized Form
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 max-w-sm mx-auto">
                    Our AI is carefully analyzing your conversation to generate meaningful follow-up questions
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-indigo-900 mb-2 text-lg">Smart Analysis in Progress</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-indigo-700">
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle size={10} className="text-white" />
                          </div>
                          <span>Conversation context analyzed</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-indigo-700">
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                            <Loader2 size={10} className="text-white animate-spin" />
                          </div>
                          <span>Generating personalized questions</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
                            <Clock size={10} className="text-white" />
                          </div>
                          <span>Preparing your form</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Clock size={14} className="text-indigo-500" />
                  <span>This usually takes 10-30 seconds</span>
                </div>
                
                <div className="mt-4">
                  <Progress value={33} className="h-2" />
                  <p className="text-xs text-gray-500 mt-2">Analyzing conversation patterns...</p>
                </div>
              </div>
            </div>
          </>
        );

      case "form":
        return (
          <>
            <DialogHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <FileText size={20} className="text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    Session {sessionNumber + 1} Follow-up
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 mt-1">
                    Help us understand your progress and prepare for your next session
                  </DialogDescription>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                  <Star size={14} className="fill-indigo-600" />
                  <span className="font-medium">{generatedQuestions.length} personalized questions</span>
                </div>
                
                <Badge variant="outline" className="text-xs px-2 py-1">
                  <div className="flex items-center gap-1">
                    <Heart size={10} className="text-red-500 fill-red-500" />
                    <span>Session {sessionNumber} Complete</span>
                  </div>
                </Badge>
              </div>
            </DialogHeader>

            <div className="py-2 max-h-[28rem] overflow-y-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                  {generatedQuestions.map((q, idx) => (
                    <Card key={q.name || idx} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <FormField
                          control={form.control}
                          name={q.name}
                          rules={{ required: "This field is required" }}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-start gap-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-xs font-semibold text-indigo-600">{idx + 1}</span>
                                </div>
                                <FormLabel className="text-base font-medium text-gray-900 leading-relaxed">
                                  {q.label}
                                </FormLabel>
                              </div>
                              <FormControl>
                                {q.type === "text" ? (
                                  <Input 
                                    {...field} 
                                    placeholder="Share your thoughts..." 
                                    className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                                  />
                                ) : q.type === "textarea" ? (
                                  <Textarea 
                                    {...field} 
                                    placeholder="Please provide details to help us understand better..." 
                                    rows={4}
                                    className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                                  />
                                ) : q.type === "select" ? (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                                      <SelectValue placeholder="Choose an option that best describes your experience" />
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
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Separator className="my-6" />
                  
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <MessageCircle size={16} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-900 mb-1 text-sm">💡 Pro Tip</h4>
                          <p className="text-sm text-blue-800 leading-relaxed">
                            Your honest answers help us personalize your next session and track your progress more effectively. Take your time with each question.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      size="lg"
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          <span className="font-medium">Saving Progress...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} className="mr-2" />
                          <span className="font-medium">Complete & Continue</span>
                        </>
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => onOpenChange(false)}
                      disabled={isSubmitting}
                      className="px-6"
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
            <DialogHeader className="text-center pb-2">
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-xl mb-4">
                  <AlertTriangle size={36} className="text-white" />
                </div>
                
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-bold text-red-600">
                    Something went wrong
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 max-w-sm mx-auto">
                    We couldn't generate your form at this time. Let's try again.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <Card className="border-red-200 bg-red-50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={18} className="text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-2">Error Details</h4>
                      <p className="text-sm text-red-800 leading-relaxed bg-white/50 p-3 rounded-lg border border-red-200">
                        {error}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={generateForm}
                  size="lg"
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 shadow-lg"
                >
                  <MessageSquare size={18} className="mr-2" />
                  <span className="font-medium">Try Again</span>
                </Button>
                
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  size="lg"
                  className="w-full border-gray-300 hover:bg-gray-50"
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
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden">
        {renderDialogContent()}
      </DialogContent>
    </Dialog>
  );
}
