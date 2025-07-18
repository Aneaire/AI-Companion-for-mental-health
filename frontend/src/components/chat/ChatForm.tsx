import client from "@/lib/client";
import { useUserProfile } from "@/lib/queries/user";
import { useChatStore } from "@/stores/chatStore";
import { useAuth } from "@clerk/clerk-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// ShadCN UI Imports
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Heart,
  Loader2,
  MessageCircle,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";

// Form Schema
const formSchema = z.object({
  preferredName: z.string().optional(),
  currentEmotions: z.array(z.string()).optional(),
  reasonForVisit: z
    .string()
    .min(1, "Please share why you're here to start the chat."),
  supportType: z
    .array(
      z.enum(["listen", "copingTips", "encouragement", "resources", "other"])
    )
    .optional(),
  supportTypeOther: z.string().optional(),
  additionalContext: z.string().optional(),
  responseTone: z
    .enum(["empathetic", "practical", "encouraging", "concise"])
    .optional(),
  imageResponse: z.string().optional(),
  responseCharacter: z.string().optional(),
  responseDescription: z.string().optional(),
});

export type FormData = {
  preferredName?: string;
  currentEmotions?: string[];
  reasonForVisit: string;
  supportType?: (
    | "listen"
    | "copingTips"
    | "encouragement"
    | "resources"
    | "other"
  )[];
  supportTypeOther?: string;
  additionalContext?: string;
  responseTone?: "empathetic" | "practical" | "encouraging" | "concise";
  imageResponse?: string;
  responseCharacter?: string;
  responseDescription?: string;
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

// Add character options constant
const characterOptions = [
  {
    value: "spongebob",
    label: "SpongeBob SquarePants - Optimistic & Energetic",
  },
  { value: "rick", label: "Rick (Rick & Morty) - Cynical & Brilliant" },
  { value: "mickey", label: "Mickey Mouse - Friendly & Helpful" },
  { value: "batman", label: "Batman - Serious & Strategic" },
  { value: "pikachu", label: "Pikachu - Cute & Cheerful" },
  { value: "homer", label: "Homer Simpson - Laid-back & Humorous" },
  { value: "ironman", label: "Iron Man - Witty & Confident" },
  { value: "dory", label: "Dory - Forgetful but Positive" },
  { value: "yoda", label: "Yoda - Wise & Philosophical" },
  { value: "deadpool", label: "Deadpool - Sarcastic & Funny" },
] as const;

const supportTypeOptions = [
  {
    value: "listen",
    label: "Someone to listen",
    desc: "A compassionate ear for your thoughts",
  },
  {
    value: "copingTips",
    label: "Coping strategies",
    desc: "Practical techniques to help you feel better",
  },
  {
    value: "encouragement",
    label: "Encouragement",
    desc: "Positive support and motivation",
  },
  {
    value: "resources",
    label: "Mental health resources",
    desc: "Professional help and additional support",
  },
  { value: "other", label: "Something else", desc: "Tell me what you need" },
] as const;

interface ChatFormProps {
  onSubmit: (formData: any, aiResponse: string, sessionId: number) => void;
  onThreadCreated?: (session: any) => void;
}

const ChatForm = ({
  onSubmit,
  onThreadCreated,
}: ChatFormProps): JSX.Element => {
  // Set initial step to "emotions" to prompt for required field first
  // This helps guide the user immediately to the mandatory field
  const [currentStep, setCurrentStep] = useState<string | null>("emotions");
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  const queryClient = useQueryClient();
  const { setInitialForm, addMessage, updateLastMessage } = useChatStore();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      preferredName: "",
      currentEmotions: [],
      reasonForVisit: "",
      supportType: [],
      supportTypeOther: "",
      additionalContext: "",
      responseTone: undefined,
      imageResponse: "",
      responseCharacter: "",
      responseDescription: "",
    },
  });

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
        const threadResponse = await client.api.threads.$post({
          json: {
            userId: userProfile.id,
            preferredName: preferredNameToSend,
            currentEmotions: data.currentEmotions,
            reasonForVisit: data.reasonForVisit,
            supportType: data.supportType,
            supportTypeOther: data.supportTypeOther,
            additionalContext: data.additionalContext,
            responseTone: data.responseTone,
            imageResponse: data.imageResponse,
            responseCharacter: data.responseCharacter,
            responseDescription: data.responseDescription,
          },
        });

        if (!threadResponse.ok) {
          throw new Error("Failed to create thread");
        }

        const session = await threadResponse.json();

        // Invalidate threads query so sidebar refreshes
        await queryClient.invalidateQueries({ queryKey: ["threads"] });

        // Store form data in chat context with the session ID
        setInitialForm(
          { ...data, preferredName: preferredNameToSend },
          session.sessionId || session.id
        );

        // Then get the AI's initial response
        const chatResponse = await client.api.chat.$post({
          json: {
            message: "",
            initialForm: { ...data, preferredName: preferredNameToSend },
            userId: String(userProfile.id),
            sessionId: session.sessionId || session.id,
          },
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

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const content = line.substring("data: ".length);
                // Skip session_id events and empty content
                if (content.trim() === "" || /^\d+$/.test(content.trim()))
                  continue;
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

  const handleSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const isStepCompleted = (step: string): boolean => {
    switch (step) {
      case "personal-info":
        return !!form.getValues().preferredName;
      case "emotions":
        // Reason for visit is mandatory for this step
        return !!form.getValues().reasonForVisit;
      case "support":
        return (
          (form.getValues().supportType?.length ?? 0) > 0 ||
          !!form.getValues().supportTypeOther || // Ensure "other" field is considered
          !!form.getValues().additionalContext
        );
      case "tone":
        return !!form.getValues().responseTone;
      case "image":
        return !!form.getValues().imageResponse;
      default:
        return false;
    }
  };

  return (
    // Adjust overall container for smaller screens
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        {/* Header Section */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-3 sm:mb-4 shadow-lg">
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2 sm:mb-3">
            Welcome, I'm Here for You
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-md mx-auto leading-relaxed">
            Share a little about yourself so I can support you in the best way
            possible.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5 sm:space-y-6"
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="p-5 sm:p-8">
                <Accordion
                  type="single"
                  collapsible
                  className="space-y-5 sm:space-y-6"
                  value={currentStep || undefined}
                  onValueChange={setCurrentStep}
                >
                  {/* Personal Info Section */}
                  <AccordionItem value="personal-info" className="border-0">
                    <AccordionTrigger className="text-lg sm:text-xl font-semibold text-gray-800 hover:no-underline py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-full">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <span>About You</span>
                        {isStepCompleted("personal-info") && (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
                      <FormField
                        control={form.control}
                        name="preferredName"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Preferred Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What should I call you?"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Emotions Section */}
                  <AccordionItem value="emotions" className="border-0">
                    <AccordionTrigger className="text-lg sm:text-xl font-semibold text-gray-800 hover:no-underline py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-full">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                        </div>
                        <span>How Are You Feeling?</span>
                        {isStepCompleted("emotions") && (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-2 space-y-5 sm:space-y-6">
                      <FormField
                        control={form.control}
                        name="currentEmotions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base sm:text-lg font-medium text-gray-700">
                              Select all emotions that resonate with you
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              {/* Adjust grid columns for mobile */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                                {[
                                  "anxious",
                                  "sad",
                                  "overwhelmed",
                                  "angry",
                                  "lonely",
                                  "hopeful",
                                  "joyful",
                                  "calm",
                                ].map((emotion) => (
                                  <div key={emotion} className="relative">
                                    <Checkbox
                                      id={emotion}
                                      checked={field.value?.includes(emotion)}
                                      onCheckedChange={(checked) => {
                                        const currentEmotions =
                                          form.getValues().currentEmotions ||
                                          [];
                                        form.setValue(
                                          "currentEmotions",
                                          checked
                                            ? [...currentEmotions, emotion]
                                            : currentEmotions.filter(
                                                (item) => item !== emotion
                                              )
                                        );
                                      }}
                                      className="sr-only"
                                    />
                                    <Label
                                      htmlFor={emotion}
                                      className={`
                                        flex items-center justify-center px-3 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200 text-sm font-medium
                                        ${
                                          field.value?.includes(emotion)
                                            ? emotionColors[emotion]
                                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                                        }
                                      `}
                                    >
                                      {emotion.charAt(0).toUpperCase() +
                                        emotion.slice(1)}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <FormField
                        control={form.control}
                        name="reasonForVisit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base sm:text-lg font-medium text-gray-700">
                              What's on your mind today? *
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Share what brought you here today. I'm here to listen and support you..."
                                rows={4}
                                className="text-sm sm:text-base p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Support Section */}
                  <AccordionItem value="support" className="border-0">
                    <AccordionTrigger className="text-lg sm:text-xl font-semibold text-gray-800 hover:no-underline py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-full">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                        </div>
                        <span>How Can I Help?</span>
                        {isStepCompleted("support") && (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-2 space-y-5 sm:space-y-6">
                      <FormField
                        control={form.control}
                        name="supportType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base sm:text-lg font-medium text-gray-700">
                              What kind of support are you looking for?
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              <div className="grid gap-2 sm:gap-3">
                                {supportTypeOptions.map((type) => (
                                  <div key={type.value} className="relative">
                                    <Checkbox
                                      id={type.value}
                                      checked={field.value?.includes(
                                        type.value
                                      )}
                                      onCheckedChange={(checked) => {
                                        const currentSupportTypes =
                                          form.getValues().supportType || [];
                                        form.setValue(
                                          "supportType",
                                          checked
                                            ? [
                                                ...currentSupportTypes,
                                                type.value,
                                              ]
                                            : currentSupportTypes.filter(
                                                (item) => item !== type.value
                                              )
                                        );
                                      }}
                                      className="sr-only"
                                    />
                                    <Label
                                      htmlFor={type.value}
                                      className={`
                                        flex flex-col p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200
                                        ${
                                          field.value?.includes(type.value)
                                            ? "bg-blue-50 border-blue-300 text-blue-800"
                                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                        }
                                      `}
                                    >
                                      <span className="font-medium text-sm sm:text-base">
                                        {type.label}
                                      </span>
                                      <span className="text-xs sm:text-sm opacity-75 mt-0.5 sm:mt-1">
                                        {type.desc}
                                      </span>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.getValues().supportType?.includes("other") && (
                        <FormField
                          control={form.control}
                          name="supportTypeOther"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base sm:text-lg font-medium text-gray-700">
                                Please tell me more about what you need
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g., Help with setting goals, advice on relationships..."
                                  className="text-sm sm:text-base py-3 sm:py-4 rounded-lg sm:rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="additionalContext"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base sm:text-lg font-medium text-gray-700">
                              Anything else you'd like to share?
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Any additional context that might help me understand your situation better..."
                                rows={3}
                                className="text-sm sm:text-base p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Response Tone Section */}
                  <AccordionItem value="tone" className="border-0">
                    <AccordionTrigger className="text-lg sm:text-xl font-semibold text-gray-800 hover:no-underline py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-amber-100 rounded-full">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                        </div>
                        <span>How Should I Respond?</span>
                        {isStepCompleted("tone") && (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="responseCharacter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Choose AI Character (Optional)
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a character personality" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {characterOptions.map((char) => (
                                  <SelectItem
                                    key={char.value}
                                    value={char.value}
                                  >
                                    {char.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="responseDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Custom Response Style (Optional)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe how you'd like the AI to respond (e.g., 'Give advice like a wise mentor' or 'Respond with humor and jokes')"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Existing response tone field */}
                      <FormField
                        control={form.control}
                        name="responseTone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Response Tone</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select tone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="empathetic">
                                  Empathetic
                                </SelectItem>
                                <SelectItem value="practical">
                                  Practical
                                </SelectItem>
                                <SelectItem value="encouraging">
                                  Encouraging
                                </SelectItem>
                                <SelectItem value="concise">Concise</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Image Reflection Section */}
                  <AccordionItem value="image" className="border-0">
                    <AccordionTrigger className="text-lg sm:text-xl font-semibold text-gray-800 hover:no-underline py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-indigo-100 rounded-full">
                          <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                        </div>
                        <span>Reflect on This Image</span>
                        {isStepCompleted("image") && (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
                      <Card className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200">
                        <CardContent className="p-4 sm:p-6 text-center">
                          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
                            Take a moment to look at this gentle, abstract
                            image. If you'd like, share what it reminds you of
                            or how it makes you feel.
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Optional
                            </Badge>
                          </p>
                          <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm border border-gray-200 mb-4 sm:mb-6">
                            <img
                              src="/images/abstract-pattern.svg"
                              alt="Abstract symmetrical pattern for reflection"
                              className="max-w-[200px] sm:max-w-[300px] mx-auto rounded-md sm:rounded-lg"
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
                                    rows={3}
                                    className="text-sm sm:text-base p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            variant="outline"
                            className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border-2 px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base"
                            onClick={() => form.setValue("imageResponse", "")}
                            type="button"
                          >
                            Skip This Section
                          </Button>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="text-center mt-6 sm:mt-8">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="px-8 py-4 text-base sm:px-12 sm:py-6 sm:text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {mutation.isPending ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Starting Your Chat...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Start Your Supportive Chat
                    <ArrowRight className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                )}
              </Button>
              <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                Your information is kept private and secure
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ChatForm;
