import client from "@/lib/client";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types/chat";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
});

interface FormData {
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
}

interface ChatFormProps {
  onSubmit: (sessionId: number) => void;
}

type SupportTypeEnum =
  | "listen"
  | "copingTips"
  | "encouragement"
  | "resources"
  | "other";

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

const ChatForm = ({ onSubmit }: ChatFormProps): JSX.Element => {
  const [currentStep, setCurrentStep] = useState<string | null>(null);

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
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await client.api.chat.$post({
        json: { message: "", initialForm: data },
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = ""; // To handle partial SSE messages

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);

        // Process complete SSE messages from the buffer
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete last line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            fullResponse += line.substring("data: ".length);
          } else if (line.startsWith("event: session_id")) {
            const sessionIdData = lines[lines.indexOf(line) + 1];
            if (sessionIdData && sessionIdData.startsWith("data: ")) {
              const receivedSessionId = parseInt(
                sessionIdData.substring("data: ".length),
                10
              );
              onSubmit(receivedSessionId); // Pass the sessionId to the onSubmit callback
            }
          }
        }
      }

      return fullResponse;
    },
    onSuccess: (response) => {
      console.log("Frontend ChatForm - Full Response:", response);
      // Add the AI's response to the chat store
      const aiMessage: Message = {
        sender: "ai",
        text: response,
        timestamp: new Date(),
        contextId: "default",
      };
      useChatStore.getState().addMessage(aiMessage);

      toast("We're ready to support you. Let's begin.");
    },
    onError: (er) => {
      console.log(er);
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
        return !!form.getValues().reasonForVisit;
      case "support":
        return (
          (form.getValues().supportType?.length ?? 0) > 0 ||
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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
            Welcome, I'm Here for You
          </h1>
          <p className="text-xl text-gray-600 max-w-md mx-auto leading-relaxed">
            Share a little about yourself so I can support you in the best way
            possible.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="p-8">
                <Accordion
                  type="single"
                  collapsible
                  className="space-y-6"
                  value={currentStep || undefined}
                  onValueChange={setCurrentStep}
                >
                  {/* Personal Info Section */}
                  <AccordionItem value="personal-info" className="border-0">
                    <AccordionTrigger className="text-xl font-semibold text-gray-800 hover:no-underline py-4 px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <span>About You</span>
                        {isStepCompleted("personal-info") && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2">
                      <FormField
                        control={form.control}
                        name="preferredName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-lg font-medium text-gray-700">
                              What should I call you?
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., Alex or a nickname you prefer"
                                className="text-lg py-6 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
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
                    <AccordionTrigger className="text-xl font-semibold text-gray-800 hover:no-underline py-4 px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                          <Sparkles className="w-5 h-5 text-purple-600" />
                        </div>
                        <span>How Are You Feeling?</span>
                        {isStepCompleted("emotions") && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                      <FormField
                        control={form.control}
                        name="currentEmotions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-lg font-medium text-gray-700">
                              Select all emotions that resonate with you
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                                        flex items-center justify-center px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 text-sm font-medium
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
                            <FormLabel className="text-lg font-medium text-gray-700">
                              What's on your mind today? *
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Share what brought you here today. I'm here to listen and support you..."
                                rows={4}
                                className="text-base p-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none"
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
                    <AccordionTrigger className="text-xl font-semibold text-gray-800 hover:no-underline py-4 px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                          <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <span>How Can I Help?</span>
                        {isStepCompleted("support") && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                      <FormField
                        control={form.control}
                        name="supportType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-lg font-medium text-gray-700">
                              What kind of support are you looking for?
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              <div className="grid gap-3">
                                {[
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
                                  {
                                    value: "other",
                                    label: "Something else",
                                    desc: "Tell me what you need",
                                  },
                                ].map((type) => (
                                  <div key={type.value} className="relative">
                                    <Checkbox
                                      id={type.value}
                                      checked={field.value?.includes(
                                        type.value as SupportTypeEnum
                                      )}
                                      onCheckedChange={(checked) => {
                                        const currentSupportTypes =
                                          form.getValues().supportType || [];
                                        form.setValue(
                                          "supportType",
                                          checked
                                            ? [
                                                ...currentSupportTypes,
                                                type.value as SupportTypeEnum,
                                              ]
                                            : currentSupportTypes.filter(
                                                (item) =>
                                                  item !==
                                                  (type.value as SupportTypeEnum)
                                              )
                                        );
                                      }}
                                      className="sr-only"
                                    />
                                    <Label
                                      htmlFor={type.value}
                                      className={`
                                        flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                                        ${
                                          field.value?.includes(
                                            type.value as SupportTypeEnum
                                          )
                                            ? "bg-blue-50 border-blue-300 text-blue-800"
                                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                        }
                                      `}
                                    >
                                      <span className="font-medium text-base">
                                        {type.label}
                                      </span>
                                      <span className="text-sm opacity-75 mt-1">
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
                              <FormLabel className="text-lg font-medium text-gray-700">
                                Please tell me more about what you need
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g., Help with setting goals, advice on relationships..."
                                  className="text-base py-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
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
                            <FormLabel className="text-lg font-medium text-gray-700">
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
                                className="text-base p-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none"
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
                    <AccordionTrigger className="text-xl font-semibold text-gray-800 hover:no-underline py-4 px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full">
                          <MessageCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <span>How Should I Respond?</span>
                        {isStepCompleted("tone") && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2">
                      <FormField
                        control={form.control}
                        name="responseTone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-lg font-medium text-gray-700">
                              Choose the response style that feels right for you
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="text-base py-6 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200">
                                  <SelectValue placeholder="Select your preferred tone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="empathetic" className="py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      Warm and empathetic
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Understanding and emotionally supportive
                                    </span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="practical" className="py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      Calm and practical
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Solution-focused and grounded
                                    </span>
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="encouraging"
                                  className="py-3"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      Gentle and encouraging
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Uplifting and motivational
                                    </span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="concise" className="py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      Straightforward and concise
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Clear and to the point
                                    </span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Image Reflection Section */}
                  <AccordionItem value="image" className="border-0">
                    <AccordionTrigger className="text-xl font-semibold text-gray-800 hover:no-underline py-4 px-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-full">
                          <Camera className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span>Reflect on This Image</span>
                        {isStepCompleted("image") && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2">
                      <Card className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200">
                        <CardContent className="p-6 text-center">
                          <p className="text-base text-gray-600 mb-6 leading-relaxed">
                            Take a moment to look at this gentle, abstract
                            image. If you'd like, share what it reminds you of
                            or how it makes you feel.
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Optional
                            </Badge>
                          </p>
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
                            <img
                              src="/images/abstract-pattern.svg"
                              alt="Abstract symmetrical pattern for reflection"
                              className="max-w-[300px] mx-auto rounded-lg"
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
                                    className="text-base p-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            variant="outline"
                            className="mt-4 rounded-xl border-2"
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
            <div className="text-center">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="px-12 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {mutation.isPending ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Starting Your Chat...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Start Your Supportive Chat
                    <ArrowRight className="ml-3 h-5 w-5" />
                  </span>
                )}
              </Button>
              <p className="text-sm text-gray-500 mt-4">
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
