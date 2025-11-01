import client, { personaCardsApi } from "@/lib/client";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { useAuth, useUser } from "@clerk/clerk-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ConversationPreferences } from "@/stores/chatStore";

// ShadCN UI Imports
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Heart,
  Loader2,
  Sparkles,
  TestTube,
} from "lucide-react";
import { toast } from "sonner";

// Form Schema - Simplified for persona system
const formSchema = z.object({
  preferredName: z.string().optional(),
  currentEmotions: z.array(z.string()).optional(),
  reasonForVisit: z
    .string()
    .min(1, "Please share why you're here to start chat."),
  additionalContext: z.string().optional(),
  imageResponse: z.string().optional(),
});

export type FormData = {
  preferredName?: string;
  currentEmotions?: string[];
  reasonForVisit: string;
  additionalContext?: string;
  imageResponse?: string;
};

const emotionColors: Record<string, string> = {
  anxious: "bg-orange-100 text-orange-800 border-orange-200",
  sad: "bg-blue-100 text-blue-800 border-blue-200",
  overwhelmed: "bg-red-100 text-red-800 border-red-200",
  angry: "bg-red-100 text-red-800 border-red-200",
  lonely: "bg-purple-100 text-purple-800 border-purple-200",
  hopeful: "bg-green-100 text-green-800 border-green-200",
  joyful: "bg-yellow-100 text-yellow-800 border-yellow-200",
  calm: "bg-teal-100 text-teal-800 border-teal-200",
};



interface ChatFormProps {
  onSubmit: (formData: any, aiResponse: string, sessionId: number) => void;
  onThreadCreated?: (session: any) => void;
  conversationPreferences?: ConversationPreferences;
}

const ChatForm = ({
  onSubmit,
  onThreadCreated,
  conversationPreferences,
}: ChatFormProps): JSX.Element => {
  // Remove step-based navigation since we're simplifying form
  const [showImageSection, setShowImageSection] = useState(false);
  const [useSampleData, setUseSampleData] = useState(false);
  const { userId } = useAuth();
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(userId || null);
  const queryClient = useQueryClient();
  const { setInitialForm, addMessage, updateLastMessage, setSelectedPersona } = useChatStore();

  // Get default name from Clerk user
  const defaultName = user?.firstName || user?.fullName || "";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      preferredName: defaultName,
      currentEmotions: [],
      reasonForVisit: "",
      additionalContext: "",
      imageResponse: "",
    },
  });

  // Sample data for form filling
  const sampleData = {
    preferredName: "Alex",
    currentEmotions: ["anxious", "overwhelmed"],
    reasonForVisit: "I've been feeling really stressed at work lately and having trouble managing my anxiety. I need someone to talk to about the pressure I'm under.",
    additionalContext: "I work in a high-pressure environment with tight deadlines. Recently I've been having trouble sleeping and feel like I'm constantly on edge. I'm looking for healthy coping strategies.",
    imageResponse: "This image reminds me of how my mind feels - lots of interconnected thoughts and patterns that I can't seem to quiet down. The symmetry represents the order I'm trying to find in my chaotic thoughts."
  };

  // Handle sample data toggle
  const handleSampleToggle = (enabled: boolean) => {
    setUseSampleData(enabled);
    if (enabled) {
      // Fill form with sample data
      form.setValue("preferredName", sampleData.preferredName);
      form.setValue("currentEmotions", sampleData.currentEmotions);
      form.setValue("reasonForVisit", sampleData.reasonForVisit);
      form.setValue("additionalContext", sampleData.additionalContext);
      setShowImageSection(true); // Show image section for sample
      form.setValue("imageResponse", sampleData.imageResponse);
    } else {
      // Clear form back to defaults
      form.reset({
        preferredName: defaultName,
        currentEmotions: [],
        reasonForVisit: "",
        additionalContext: "",
        imageResponse: "",
      });
      setShowImageSection(false);
    }
  };

  // Handle form submission with sample data consideration


  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      try {
        if (!userProfile?.id) {
          throw new Error("User not authenticated");
        }

        // Use preferredName or fallback to nickname
        const preferredNameToSend =
          data.preferredName && data.preferredName.trim() !== ""
            ? data.preferredName
            : userProfile?.nickname || "";

        // First create the thread
        const threadResponse = await (client as any).api.threads.$post({
          json: {
            userId: userProfile.id,
            preferredName: preferredNameToSend,
            currentEmotions: data.currentEmotions,
            reasonForVisit: data.reasonForVisit,
            additionalContext: data.additionalContext,
            imageResponse: data.imageResponse,
          },
        });

        if (!threadResponse.ok) {
          throw new Error("Failed to create thread");
        }

        const session = await threadResponse.json();

        // Optimistically add the new thread to the cache before invalidating
        queryClient.setQueryData(
          ["normalThreads", userProfile?.id, 20, 0],
          (oldData: any) => {
            if (!oldData) return { threads: [session], total: 1 };
            return {
              ...oldData,
              threads: [session, ...oldData.threads],
              total: oldData.total + 1,
            };
          }
        );

        // Invalidate queries with a small delay to allow UI to update first
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["normalThreads"] });
          queryClient.invalidateQueries({ queryKey: ["threads"] });
        }, 100);

        // Store form data in chat context with the session ID
        setInitialForm(
          { ...data, preferredName: preferredNameToSend },
          session.sessionId || session.id
        );

        // Then get the AI's initial response
        const chatResponse = await personaCardsApi.sendMessage({
          message: "",
          initialForm: { ...data, preferredName: preferredNameToSend },
          userId: String(userProfile.id),
          sessionId: session.sessionId || session.id,
          conversationPreferences: conversationPreferences,
        });

        if (!chatResponse.ok) {
          throw new Error("Failed to get AI response");
        }

        const reader = chatResponse.body?.getReader();
        if (!reader) {
          throw new Error("No reader available");
        }

        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = ""; // To handle partial SSE messages
        let selectedPersona: any = null;

        // Add a temporary AI message for streaming
        const tempId = Date.now();
        const tempAiMessage = {
          sender: "ai" as const,
          text: "",
          timestamp: new Date(),
          tempId,
          contextId: "default" as const,
        };

        // Add the temporary message to the store
        addMessage(tempAiMessage);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value);

            // Process complete SSE messages from the buffer
            let lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete last line in buffer

            let currentEvent = null;
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.substring("event: ".length).trim();
                continue;
              }
              
              if (line.startsWith("data: ")) {
                const content = line.substring("data: ".length);
                
                // Handle persona selection events
                if (currentEvent === "persona_selected") {
                  try {
                    const personaData = JSON.parse(content);
                    selectedPersona = personaData;
                    console.log("Persona selected:", personaData);
                    
                    // Set persona in chat store for DevTools
                    setSelectedPersona(
                      personaData.personaId,
                      generatePersonaRationale(personaData.personaId)
                    );
                  } catch (e) {
                    console.error("Failed to parse persona selection:", e);
                  }
                  currentEvent = null;
                  continue;
                }
                
                // Skip session_id events and empty content
                if (content.trim() === "" || /^\d+$/.test(content.trim())) {
                  currentEvent = null;
                  continue;
                }
                // Re-add the newline character that was removed by split('\n')
                fullResponse += content + "\n";
              }
            }

            // Update the temporary message with the current stream
            updateLastMessage(fullResponse);
          }

          // Handle any remaining buffer content
          if (buffer) {
            fullResponse += buffer;
            updateLastMessage(fullResponse);
          }

          // Ensure the message ends with a newline for markdown rendering
          if (!fullResponse.endsWith("\n")) {
            fullResponse += "\n";
            updateLastMessage(fullResponse);
          }

          return { session, response: fullResponse };
        } catch (streamError) {
          console.error("Stream processing error:", streamError);
          throw new Error("Error processing response stream");
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        console.error("Mutation error:", error);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log("Thread created and AI responded:", response);

      // Call the onSubmit callback with the form data and AI response
      if (onSubmit) {
        onSubmit(
          response.session,
          response.response,
          response.session.sessionId || response.session.id
        );
      }

      // Call the onThreadCreated callback to handle thread selection
      // The response.session contains both thread data and sessionId
      if (onThreadCreated) {
        onThreadCreated(response.session);
      }

      toast("We're ready to support you. Let's begin.");
    },
    onError: (error) => {
      console.error("Form submission error:", error);
      toast.error("Something went wrong. Please try again.");
    },
  });
  
  // Generate persona rationale based on persona ID
  const generatePersonaRationale = (personaId: string): string => {
    switch (personaId) {
      case 'listener':
        return 'User needs emotional support and active listening - selecting listener persona for empathetic engagement';
      case 'guide':
        return 'User seeking advice and solutions - selecting guide persona for practical guidance';
      case 'companion':
        return 'User wants conversation and company - selecting companion persona for friendly interaction';
      case 'crisis':
        return 'Crisis keywords detected - prioritizing crisis support persona for immediate help';
      default:
        return 'Default persona selection based on user needs and conversation context';
    }
  };

  // Handle form submission with sample data consideration
  const handleSubmit = (data: FormData) => {
    // If using sample data, show a notification
    if (useSampleData) {
      toast("Using sample data for demonstration. You can modify any field before submitting.");
    }
    mutation.mutate(data);
  };






  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6 sm:space-y-8"
          >
            <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-6 sm:p-10 space-y-8 sm:space-y-10">

                {/* Sample Data Toggle */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-3">
                    <TestTube className="w-5 h-5 text-amber-600" />
                    <div>
                      <Label className="text-sm font-semibold text-amber-900">Use Sample Data</Label>
                      <p className="text-xs text-amber-700">Fill form with example data for testing</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSampleToggle(!useSampleData)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                      useSampleData ? 'bg-amber-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useSampleData ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Preferred Name */}
                <FormField
                  control={form.control}
                  name="preferredName"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        What should I call you?
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your preferred name"
                          {...field}
                          className="text-base py-4 px-4 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 bg-gray-50/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Emotions */}
                <FormField
                  control={form.control}
                  name="currentEmotions"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-rose-500" />
                        How are you feeling right now?
                      </FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            "anxious", "sad", "overwhelmed", "angry",
                            "lonely", "hopeful", "joyful", "calm",
                          ].map((emotion) => (
                            <div key={emotion} className="relative">
                              <Checkbox
                                id={emotion}
                                checked={field.value?.includes(emotion)}
                                onCheckedChange={(checked) => {
                                  const currentEmotions = form.getValues().currentEmotions || [];
                                  form.setValue(
                                    "currentEmotions",
                                    checked
                                      ? [...currentEmotions, emotion]
                                      : currentEmotions.filter((item) => item !== emotion)
                                  );
                                }}
                                className="sr-only"
                              />
                              <Label
                                htmlFor={emotion}
                                className={`
                                  flex items-center justify-center px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm
                                  ${
                                    field.value?.includes(emotion)
                                      ? `${emotionColors[emotion]} shadow-md scale-105`
                                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md"
                                  }
                                `}
                              >
                                {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Reason for Visit */}
                <FormField
                  control={form.control}
                  name="reasonForVisit"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        What's on your mind today?
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Share what brought you here today. I'm here to listen and support you..."
                          rows={5}
                          className="text-base p-4 rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all duration-200 resize-none bg-gray-50/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Additional Context */}
                <FormField
                  control={form.control}
                  name="additionalContext"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-blue-500" />
                        Anything else you'd like to share?
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Any additional context that might help me understand your situation better..."
                          rows={4}
                          className="text-base p-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none bg-gray-50/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image Reflection - Optional */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-purple-500" />
                      Reflect on this image
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImageSection(!showImageSection)}
                      className="rounded-lg border-gray-300 hover:bg-gray-50"
                    >
                      {showImageSection ? "Hide" : "Show"}
                    </Button>
                  </div>

                  {showImageSection && (
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-lg">
                      <CardContent className="p-6 text-center space-y-6">
                        <p className="text-base text-gray-700 leading-relaxed">
                          Take a moment to look at this gentle, abstract image.
                          If you'd like, share what it reminds you of or how it makes you feel.
                        </p>
                        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                          <img
                            src="/images/abstract-pattern.svg"
                            alt="Abstract symmetrical pattern for reflection"
                            className="max-w-[250px] sm:max-w-[350px] mx-auto rounded-lg"
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="imageResponse"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="sr-only">
                                Your thoughts or feelings about the image
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="This image makes me think of... or it reminds me of..."
                                  rows={4}
                                  className="text-base p-4 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200 resize-none bg-white"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="text-center pt-6 border-t border-gray-100">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="px-10 py-5 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {mutation.isPending ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Starting Your Chat...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    Start Chat
                    <ArrowRight className="h-5 w-5" />
                  </span>
                )}
              </Button>
              <p className="text-sm text-gray-500 mt-4 max-w-md mx-auto">
                Your information is kept private and secure • I'll adapt to your needs automatically
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ChatForm;

