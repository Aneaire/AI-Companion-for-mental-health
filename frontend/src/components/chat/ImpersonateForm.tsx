import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Book,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// shadcn components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const impersonateSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  age: z
    .string()
    .min(1, "Age is required")
    .refine((val) => {
      const num = parseInt(val);
      return !isNaN(num) && num > 0 && num <= 120;
    }, "Please enter a valid age between 1 and 120"),
  problemDescription: z
    .string()
    .min(
      10,
      "Please provide at least 10 characters for the problem description"
    ),
  background: z.string().optional(),
  personality: z.string().optional(),
});

export type ImpersonateFormData = z.infer<typeof impersonateSchema>;

const steps = [
  { id: 1, title: "Basic Info", icon: User, description: "Personal details" },
  {
    id: 2,
    title: "The Problem",
    icon: AlertCircle,
    description: "What's troubling you?",
  },
  {
    id: 3,
    title: "Context",
    icon: Book,
    description: "Background & personality",
  },
  { id: 4, title: "Review", icon: Check, description: "Final details" },
];

const personalityTraits = [
  "Anxious",
  "Confident",
  "Introverted",
  "Extroverted",
  "Analytical",
  "Creative",
  "Perfectionist",
  "Laid-back",
  "Empathetic",
  "Logical",
  "Optimistic",
  "Pessimistic",
  "Ambitious",
  "Cautious",
  "Spontaneous",
];

interface ImpersonateFormProps {
  onSubmit: (
    data: ImpersonateFormData,
    aiResponse: string,
    sessionId: number
  ) => void;
  onThreadCreated?: (session: any) => void;
}

export function ImpersonateForm({ onSubmit }: ImpersonateFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const form = useForm<ImpersonateFormData>({
    resolver: zodResolver(impersonateSchema),
    defaultValues: {
      fullName: "",
      age: "",
      problemDescription: "",
      background: "",
      personality: "",
    },
    mode: "onChange",
  });

  const { watch, formState } = form;
  const watchedFields = watch();

  // Update personality field when traits are selected
  useEffect(() => {
    if (selectedTraits.length > 0) {
      form.setValue("personality", selectedTraits.join(", "));
    }
  }, [selectedTraits, form]);

  const progress = (currentStep / steps.length) * 100;

  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid && currentStep < steps.length) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const getFieldsForStep = (step: number): (keyof ImpersonateFormData)[] => {
    switch (step) {
      case 1:
        return ["fullName", "age"];
      case 2:
        return ["problemDescription"];
      case 3:
        return ["background", "personality"];
      default:
        return [];
    }
  };

  const handleSubmit = (data: ImpersonateFormData) => {
    onSubmit(data, "Mock AI response", 1);
  };

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  };

  const isStepComplete = (step: number) => {
    const fields = getFieldsForStep(step);
    return fields.every((field) => {
      const value = watchedFields[field];
      return value && value.length > 0;
    });
  };

  const renderStepContent = () => {
    const baseClasses = `transition-all duration-300 ${isAnimating ? "opacity-0 transform translate-x-4" : "opacity-100 transform translate-x-0"}`;

    switch (currentStep) {
      case 1:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Let's start with you
              </h3>
              <p className="text-gray-600">Tell us who you are</p>
            </div>

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-medium">
                      What's your name?
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        className="text-lg py-3 px-4 border-2 focus:border-blue-500 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-medium">
                      How old are you?
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter your age"
                        className="text-lg py-3 px-4 border-2 focus:border-blue-500 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <Heart className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                What's troubling you?
              </h3>
              <p className="text-gray-600">
                Share what's on your mind - we're here to help
              </p>
            </div>

            <FormField
              control={form.control}
              name="problemDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-medium">
                    Describe your situation
                  </FormLabel>
                  <FormDescription className="text-gray-500">
                    Take your time. The more details you share, the better we
                    can understand and help.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="I've been feeling..."
                      rows={6}
                      className="text-base border-2 focus:border-red-500 transition-colors resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between items-center mt-2">
                    <FormMessage />
                    <span className="text-sm text-gray-400">
                      {field.value?.length || 0} characters
                    </span>
                  </div>
                </FormItem>
              )}
            />
          </div>
        );

      case 3:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                <Brain className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Help us understand you better
              </h3>
              <p className="text-gray-600">
                Additional context helps create a more personalized experience
              </p>
            </div>

            <div className="space-y-8">
              <FormField
                control={form.control}
                name="background"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-medium">
                      Background (Optional)
                    </FormLabel>
                    <FormDescription>
                      Any relevant life experiences, relationships, or
                      circumstances?
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        placeholder="I work as a... I live with... I've experienced..."
                        rows={4}
                        className="border-2 focus:border-purple-500 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel className="text-lg font-medium mb-3 block">
                  Personality Traits (Optional)
                </FormLabel>
                <FormDescription className="mb-4">
                  Select traits that describe you. This helps us understand your
                  perspective.
                </FormDescription>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {personalityTraits.map((trait) => (
                    <Button
                      key={trait}
                      type="button"
                      variant={
                        selectedTraits.includes(trait) ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleTrait(trait)}
                      className="justify-start transition-all duration-200 hover:scale-105"
                    >
                      {trait}
                    </Button>
                  ))}
                </div>
                {selectedTraits.length > 0 && (
                  <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-purple-800 mb-2">
                      Selected traits:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTraits.map((trait) => (
                        <Badge
                          key={trait}
                          variant="secondary"
                          className="bg-purple-100 text-purple-800"
                        >
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Target className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Ready to begin?
              </h3>
              <p className="text-gray-600">
                Review your information before starting the session
              </p>
            </div>

            <div className="space-y-6">
              <Card className="border-2 border-gray-200">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Personal Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="font-medium">Name:</span>{" "}
                          {watchedFields.fullName}
                        </p>
                        <p>
                          <span className="font-medium">Age:</span>{" "}
                          {watchedFields.age}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Session Focus
                      </h4>
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {watchedFields.problemDescription}
                      </p>
                    </div>
                  </div>

                  {(watchedFields.background || selectedTraits.length > 0) && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Additional Context
                      </h4>
                      {watchedFields.background && (
                        <p className="text-sm text-gray-700 mb-3">
                          {watchedFields.background}
                        </p>
                      )}
                      {selectedTraits.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedTraits.map((trait) => (
                            <Badge
                              key={trait}
                              variant="outline"
                              className="text-xs"
                            >
                              {trait}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      What happens next?
                    </h4>
                    <p className="text-sm text-blue-800">
                      Our AI will create a personalized therapy session based on
                      your information. You'll be able to have natural
                      conversations and receive thoughtful guidance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 p-2 sm:p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Create Your Therapy Session
          </h1>
          <p className="text-gray-600 text-sm">
            The AI will use your answers to roleplay as you (or a persona) in a
            private, simulated therapy chat.
          </p>
        </div>

        {/* Compact Stepper */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex flex-col-reverse items-center flex-1 min-w-0"
              >
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs transition-all duration-300 ${
                    currentStep >= step.id
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "text-gray-400"
                  } ${isStepComplete(step.id) && currentStep !== step.id ? "bg-green-600 border-green-600" : ""}`}
                >
                  {isStepComplete(step.id) && currentStep !== step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <div className="ml-2 flex-1 min-w-0">
                  <span
                    className={`text-xs font-medium truncate ${currentStep >= step.id ? "text-gray-900" : "text-gray-400"}`}
                  >
                    {step.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow bg-white/90 backdrop-blur-sm max-h-[70vh] overflow-y-auto">
          <CardContent className="p-4 sm:p-6">
            <Form {...form}>
              <div className="space-y-6">
                {renderStepContent()}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t border-gray-200 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="flex items-center gap-2 px-3 py-1 text-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {currentStep < steps.length ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-1 text-sm"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={form.handleSubmit(handleSubmit)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-1 text-sm"
                    >
                      <Sparkles className="h-4 w-4" />
                      Start Session
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
