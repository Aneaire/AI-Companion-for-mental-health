import { personaTemplatesApi } from "@/lib/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Book,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Star,
  Target,
  User,
  Zap,
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
  {
    id: 1,
    title: "Choose Template",
    icon: Star,
    description: "Select a starting point",
  },
  { id: 2, title: "Basic Info", icon: User, description: "Personal details" },
  {
    id: 3,
    title: "The Problem",
    icon: AlertCircle,
    description: "What's troubling them?",
  },
  {
    id: 4,
    title: "Context",
    icon: Book,
    description: "Background & personality",
  },
  { id: 5, title: "Review", icon: Check, description: "Final details" },
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
    sessionId: number,
    templateId?: number | null
  ) => void;
  onThreadCreated?: (session: any) => void;
}

export function ImpersonateForm({
  onSubmit,
  onThreadCreated,
}: ImpersonateFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null
  );

  // Fetch available templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["personaTemplates"],
    queryFn: () => personaTemplatesApi.list({ limit: 50 }),
  });

  // Pre-populate form when template is selected
  useEffect(() => {
    if (selectedTemplateId && templates?.templates) {
      const template = templates.templates.find(
        (t) => t.id === selectedTemplateId
      );
      if (template) {
        // Pre-populate form fields with template data
        form.setValue("problemDescription", template.baseBackground || "");
        form.setValue("background", template.baseBackground || "");

        // Set personality traits from template
        if (template.basePersonality?.traits) {
          setSelectedTraits(template.basePersonality.traits);
          form.setValue(
            "personality",
            template.basePersonality.traits.join(", ")
          );
        }
      }
    } else if (selectedTemplateId === null) {
      // Clear form when switching to "start from scratch"
      form.reset({
        fullName: "",
        age: "",
        problemDescription: "",
        background: "",
        personality: "",
      });
      setSelectedTraits([]);
    }
  }, [selectedTemplateId, templates]);

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
        return []; // Template selection step
      case 2:
        return ["fullName", "age"];
      case 3:
        return ["problemDescription"];
      case 4:
        return ["background", "personality"];
      default:
        return [];
    }
  };

  const handleSubmit = (data: ImpersonateFormData) => {
    onSubmit(data, "Mock AI response", 1, selectedTemplateId);
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
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mb-2 shadow-md">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Choose Your Starting Point
              </h3>
              <p className="text-gray-600 text-xs max-w-sm mx-auto leading-relaxed">
                Pick a template to accelerate your persona creation, or start
                fresh with a blank canvas
              </p>
            </div>

            <div className="space-y-4">
              {/* Template Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start from Scratch Option */}
                <Card
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group ${
                    selectedTemplateId === null
                      ? "ring-2 ring-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg"
                      : "hover:shadow-md"
                  }`}
                  onClick={() => setSelectedTemplateId(null)}
                >
                  <CardContent className="p-4 text-center">
                    <div
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 transition-all duration-300 ${
                        selectedTemplateId === null
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md"
                          : "bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-gray-200 group-hover:to-gray-300"
                      }`}
                    >
                      <Zap
                        className={`h-6 w-6 transition-colors duration-300 ${
                          selectedTemplateId === null
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1 text-base">
                      Start from Scratch
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Create a completely custom persona
                    </p>
                  </CardContent>
                </Card>

                {/* Template Options */}
                {templatesLoading ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-indigo-200 border-t-indigo-600 mb-2"></div>
                    <p className="text-gray-600 text-sm">
                      Loading templates...
                    </p>
                  </div>
                ) : (
                  templates?.templates?.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group ${
                        selectedTemplateId === template.id
                          ? "ring-2 ring-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg"
                          : "hover:shadow-md"
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 line-clamp-1 text-base">
                            {template.name}
                          </h4>
                          <Badge
                            variant="secondary"
                            className={`text-xs px-2 py-0.5 ${
                              selectedTemplateId === template.id
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {template.category}
                          </Badge>
                        </div>
                        <p className="text-gray-600 line-clamp-2 mb-3 text-sm leading-relaxed">
                          {template.description}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {template.usageCount} uses
                          </span>
                          <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {template.baseAgeRange}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {selectedTemplateId && (
                <Card className="mt-4 border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-indigo-900 mb-1 text-base">
                          Template Selected
                        </h4>
                        {(() => {
                          const template = templates?.templates?.find(
                            (t) => t.id === selectedTemplateId
                          );
                          return template ? (
                            <div className="text-indigo-800">
                              <p className="font-medium text-sm mb-1">
                                {template.name}
                              </p>
                              <p className="mb-2 text-sm leading-relaxed">
                                {template.description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {template.baseProblemTypes?.map((type) => (
                                  <Badge
                                    key={type}
                                    variant="outline"
                                    className="bg-white/50 text-indigo-700 border-indigo-300 px-2 py-0.5 text-xs"
                                  >
                                    {type.replace("_", " ")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl mb-2 shadow-md">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Let's Get to Know You
              </h3>
              <p className="text-gray-600 text-xs max-w-sm mx-auto leading-relaxed">
                We'll use this information to create a personalized therapy
                experience
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-900 mb-1 block">
                      What's your name?
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        className="py-2 px-3 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-200 rounded-lg bg-gray-50 focus:bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 mt-1" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-900 mb-1 block">
                      How old are you?
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter your age"
                        className="py-2 px-3 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-200 rounded-lg bg-gray-50 focus:bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 mt-1" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-100 to-pink-100 rounded-xl mb-2 shadow-md">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                What's on Your Mind?
              </h3>
              <p className="text-gray-600 text-xs max-w-sm mx-auto leading-relaxed">
                Share what's troubling you. This helps us create a truly
                supportive conversation.
              </p>
            </div>

            <FormField
              control={form.control}
              name="problemDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-900 mb-2 block">
                    Describe your situation
                  </FormLabel>
                  <FormDescription className="text-gray-600 mb-3 text-xs leading-relaxed">
                    Take your time. The more details you share about your
                    experiences, challenges, and feelings, the better we can
                    understand and provide meaningful support.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="I've been feeling overwhelmed lately because..."
                      rows={5}
                      className="border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all duration-200 resize-none rounded-lg bg-gray-50 focus:bg-white p-3"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between items-center mt-2">
                    <FormMessage className="text-red-600" />
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {field.value?.length || 0} characters
                    </div>
                  </div>
                </FormItem>
              )}
            />
          </div>
        );

      case 4:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl mb-2 shadow-md">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Tell Us More About You
              </h3>
              <p className="text-gray-600 text-xs max-w-sm mx-auto leading-relaxed">
                Additional context helps us create a more authentic and
                supportive conversation
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="background"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-900 mb-2 block">
                      Background Information (Optional)
                    </FormLabel>
                    <FormDescription className="text-gray-600 mb-3 text-xs leading-relaxed">
                      Share any relevant life experiences, relationships, work
                      situation, or circumstances that might help us understand
                      your perspective better.
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        placeholder="I work as a software engineer at a tech startup... I've been married for 5 years..."
                        rows={3}
                        className="border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all duration-200 resize-none rounded-lg bg-gray-50 focus:bg-white p-3"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 mt-1" />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel className="text-sm font-semibold text-gray-900 mb-2 block">
                  Personality Traits (Optional)
                </FormLabel>
                <FormDescription className="text-gray-600 mb-3 text-xs leading-relaxed">
                  Select traits that resonate with you. This helps us tailor the
                  conversation to your unique personality.
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
                      className={`justify-start transition-all duration-200 hover:scale-105 rounded-lg py-2 px-3 text-sm font-medium ${
                        selectedTraits.includes(trait)
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md"
                          : "border border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                      }`}
                    >
                      {trait}
                    </Button>
                  ))}
                </div>
                {selectedTraits.length > 0 && (
                  <Card className="mt-4 border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-purple-900 mb-2 text-sm">
                            Your personality traits:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedTraits.map((trait) => (
                              <Badge
                                key={trait}
                                variant="secondary"
                                className="bg-white text-purple-700 border-purple-300 px-3 py-1 text-xs font-medium rounded"
                              >
                                {trait}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4 shadow-lg">
                <Target className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                You're All Set!
              </h3>
              <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed">
                Review your information and get ready for a personalized therapy
                session
              </p>
            </div>

            <div className="space-y-6">
              <Card className="border-2 border-gray-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 text-lg flex items-center gap-2">
                          <User className="h-4 w-4 text-indigo-600" />
                          Personal Information
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center py-1 border-b border-gray-100">
                            <span className="text-gray-600 font-medium text-sm">
                              Name
                            </span>
                            <span className="text-gray-900 font-semibold text-sm">
                              {watchedFields.fullName}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-100">
                            <span className="text-gray-600 font-medium text-sm">
                              Age
                            </span>
                            <span className="text-gray-900 font-semibold text-sm">
                              {watchedFields.age}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 text-lg flex items-center gap-2">
                          <Heart className="h-4 w-4 text-red-600" />
                          Session Focus
                        </h4>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-700 leading-relaxed line-clamp-4 text-sm">
                            {watchedFields.problemDescription}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(watchedFields.background || selectedTraits.length > 0) && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        Additional Context
                      </h4>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {watchedFields.background && (
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2 text-sm">
                              Background
                            </h5>
                            <div className="bg-purple-50 rounded-xl p-3">
                              <p className="text-purple-800 leading-relaxed text-sm">
                                {watchedFields.background}
                              </p>
                            </div>
                          </div>
                        )}

                        {selectedTraits.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-2 text-sm">
                              Personality Traits
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {selectedTraits.map((trait) => (
                                <Badge
                                  key={trait}
                                  variant="secondary"
                                  className="bg-indigo-100 text-indigo-800 px-3 py-1 text-xs font-medium rounded-lg"
                                >
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-indigo-900 mb-2 text-lg">
                        What Happens Next?
                      </h4>
                      <p className="text-indigo-800 leading-relaxed mb-3 text-sm">
                        Our AI will analyze your information to create a
                        personalized therapy session. You'll engage in natural
                        conversations with an AI therapist who understands your
                        unique situation.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="text-center">
                          <div className="w-6 h-6 bg-indigo-200 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-indigo-700 font-bold">1</span>
                          </div>
                          <p className="text-indigo-700 font-medium">
                            AI Analysis
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="w-6 h-6 bg-indigo-200 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-indigo-700 font-bold">2</span>
                          </div>
                          <p className="text-indigo-700 font-medium">
                            Persona Creation
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="w-6 h-6 bg-indigo-200 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-indigo-700 font-bold">3</span>
                          </div>
                          <p className="text-indigo-700 font-medium">
                            Session Start
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
      <div className="max-w-xl mx-auto">
        {/* Compact Header */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl mb-3 shadow-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">
            Create Your Therapy Session
          </h1>
          <p className="text-gray-600 text-xs max-w-sm mx-auto leading-relaxed">
            Let's build a personalized therapy experience. The AI will use your
            answers to create a safe, supportive conversation.
          </p>
        </div>

        {/* Compact Stepper */}
        <div className="mb-3">
          <div className="flex items-start justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex flex-col items-center"
                style={{ flex: "1" }}
              >
                <div className="flex items-center justify-center w-full relative">
                  {/* Step Circle */}
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 shadow-sm ${
                      currentStep > step.id
                        ? "bg-gradient-to-br from-green-500 to-green-600 border-green-500 text-white shadow-green-200"
                        : currentStep === step.id
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-500 text-white shadow-indigo-200 animate-pulse"
                          : "bg-white border-gray-300 text-gray-400"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-y-1/2 translate-x-4 w-full h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 -z-10">
                      <div
                        className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ${
                          currentStep > step.id ? "w-full" : "w-0"
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-2 text-center min-h-[2rem] flex items-center">
                  <span
                    className={`text-xs font-semibold transition-colors duration-300 block ${
                      currentStep >= step.id ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Compact Progress Bar */}
          <div className="">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Compact Form Card */}
        <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl rounded-xl overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <Form {...form}>
              <div className="p-3 sm:p-4 space-y-4">{renderStepContent()}</div>
            </Form>
          </CardContent>

          {/* Compact Navigation Buttons - Always Visible */}
          <div className="p-3 sm:p-4 border-t border-gray-100 bg-white/95 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 rounded-lg"
              >
                <ChevronLeft className="h-3 w-3" />
                Previous
              </Button>

              {currentStep < steps.length ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center justify-center gap-1 px-4 py-1.5 text-xs font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg"
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={form.handleSubmit(handleSubmit)}
                  className="flex items-center justify-center gap-1 px-4 py-1.5 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg"
                >
                  <Sparkles className="h-3 w-3" />
                  Start Session
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Your responses are private and secure. Take your time with each
            step.
          </p>
        </div>
      </div>
    </div>
  );
}
