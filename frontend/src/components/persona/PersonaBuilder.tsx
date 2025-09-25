import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Heart,
  Book,
  Target,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Minus,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

import { personaLibraryApi, personaTemplatesApi } from "@/lib/client";

const personaSchema = z.object({
  // Basic Info
  fullName: z.string().min(1, "Full name is required"),
  age: z.string().min(1, "Age is required"),
  category: z.string().min(1, "Category is required"),

  // Problem & Background
  problemDescription: z.string().min(10, "Please provide at least 10 characters"),
  background: z.string().optional(),

  // Personality & Traits
  personality: z.record(z.any()).optional(),
  communicationStyle: z.string().optional(),
  attachmentStyle: z.string().optional(),

  // Emotional Profile
  emotionalProfile: z.record(z.any()).optional(),

  // Behavioral Patterns
  behavioralPatterns: z.record(z.any()).optional(),
  copingMechanisms: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),

  // Goals & Development
  goals: z.array(z.string()).optional(),
  fears: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),

  // Context
  culturalBackground: z.string().optional(),
  socioeconomicStatus: z.string().optional(),
  educationLevel: z.string().optional(),
  relationshipStatus: z.string().optional(),

  // Settings
  complexityLevel: z.enum(["basic", "intermediate", "advanced"]).default("basic"),
  isPublic: z.boolean().default(false),
});

type PersonaFormData = z.infer<typeof personaSchema>;

interface PersonaBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<PersonaFormData>;
  templateId?: number;
  onSuccess?: (persona: any) => void;
}

const steps = [
  { id: 1, title: "Basic Info", icon: User, description: "Personal details" },
  { id: 2, title: "The Problem", icon: Heart, description: "What's troubling them?" },
  { id: 3, title: "Background", icon: Book, description: "Life context & history" },
  { id: 4, title: "Personality", icon: Sparkles, description: "Traits & characteristics" },
  { id: 5, title: "Review", icon: Check, description: "Final details" },
];

const categories = [
  "anxiety",
  "depression",
  "trauma",
  "relationship",
  "career",
  "family",
  "addiction",
  "grief",
  "identity",
  "stress",
  "other"
];

const personalityTraits = [
  "Anxious", "Confident", "Introverted", "Extroverted", "Analytical",
  "Creative", "Perfectionist", "Laid-back", "Empathetic", "Logical",
  "Optimistic", "Pessimistic", "Ambitious", "Cautious", "Spontaneous"
];

const communicationStyles = [
  "Direct", "Indirect", "Verbose", "Concise", "Emotional", "Logical",
  "Assertive", "Passive", "Aggressive", "Collaborative"
];

const attachmentStyles = [
  "Secure", "Anxious", "Avoidant", "Disorganized"
];

export function PersonaBuilder({ open, onOpenChange, initialData, templateId, onSuccess }: PersonaBuilderProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const queryClient = useQueryClient();

  const form = useForm<PersonaFormData>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      fullName: "",
      age: "",
      category: "",
      problemDescription: "",
      background: "",
      personality: {},
      communicationStyle: "",
      attachmentStyle: "",
      emotionalProfile: {},
      behavioralPatterns: {},
      copingMechanisms: [],
      triggers: [],
      goals: [],
      fears: [],
      strengths: [],
      weaknesses: [],
      culturalBackground: "",
      socioeconomicStatus: "",
      educationLevel: "",
      relationshipStatus: "",
      complexityLevel: "basic",
      isPublic: false,
      ...initialData,
    },
  });

  // Load template data if templateId is provided
  useEffect(() => {
    if (templateId && open) {
      personaTemplatesApi.get(templateId).then((template) => {
        setSelectedTemplate(template);
        // Pre-populate form with template data
        form.reset({
          ...form.getValues(),
          category: template.category,
          problemDescription: template.baseBackground || "",
          background: template.baseBackground,
          personality: template.basePersonality || {},
          copingMechanisms: template.baseProblemTypes || [],
        });
      }).catch((error) => {
        console.error("Failed to load template:", error);
        toast.error("Failed to load template");
      });
    }
  }, [templateId, open]);

  const createMutation = useMutation({
    mutationFn: (data: PersonaFormData) => {
      if (templateId) {
        return personaLibraryApi.createFromTemplate({
          templateId,
          customizations: {
            personality: data.personality,
            emotionalProfile: data.emotionalProfile,
            behavioralPatterns: data.behavioralPatterns,
            copingMechanisms: data.copingMechanisms,
            triggers: data.triggers,
            goals: data.goals,
            fears: data.fears,
            strengths: data.strengths,
            weaknesses: data.weaknesses,
          },
          name: data.fullName,
        });
      } else {
        // For now, we'll create a basic persona. In a full implementation,
        // you'd have a dedicated create endpoint
        return personaLibraryApi.createFromTemplate({
          templateId: 1, // Default template
          customizations: data,
          name: data.fullName,
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["personaLibrary"] });
      toast.success("Persona created successfully!");
      onSuccess?.(data);
      onOpenChange(false);
      form.reset();
      setCurrentStep(1);
    },
    onError: (error) => {
      console.error("Failed to create persona:", error);
      toast.error("Failed to create persona");
    },
  });

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

  const getFieldsForStep = (step: number): (keyof PersonaFormData)[] => {
    switch (step) {
      case 1:
        return ["fullName", "age", "category"];
      case 2:
        return ["problemDescription"];
      case 3:
        return ["background", "culturalBackground", "socioeconomicStatus", "educationLevel", "relationshipStatus"];
      case 4:
        return ["personality", "communicationStyle", "attachmentStyle"];
      default:
        return [];
    }
  };

  const handleSubmit = (data: PersonaFormData) => {
    createMutation.mutate(data);
  };

  const addArrayItem = (field: keyof PersonaFormData, value: string) => {
    const current = form.getValues(field) as string[] || [];
    if (!current.includes(value)) {
      form.setValue(field, [...current, value]);
    }
  };

  const removeArrayItem = (field: keyof PersonaFormData, value: string) => {
    const current = form.getValues(field) as string[] || [];
    form.setValue(field, current.filter(item => item !== value));
  };

  const renderStepContent = () => {
    const baseClasses = `transition-all duration-300 ${
      isAnimating ? "opacity-0 transform translate-x-4" : "opacity-100 transform translate-x-0"
    }`;

    switch (currentStep) {
      case 1:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Basic Information
              </h3>
              <p className="text-gray-600">Let's start with the fundamental details</p>
            </div>

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-medium">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter full name"
                        className="text-lg py-3 px-4"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-medium">Age</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Age"
                          className="text-lg py-3 px-4"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-medium">Primary Issue Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-lg py-3 px-4">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                The Core Problem
              </h3>
              <p className="text-gray-600">What is the main issue they're dealing with?</p>
            </div>

            <FormField
              control={form.control}
              name="problemDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-medium">Problem Description</FormLabel>
                  <FormDescription>
                    Describe the main issue or concern in detail. What brings them to therapy?
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the problem..."
                      rows={6}
                      className="text-base resize-none"
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Book className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Background & Context
              </h3>
              <p className="text-gray-600">Help us understand their life situation</p>
            </div>

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="background"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-medium">Background Information</FormLabel>
                    <FormDescription>
                      Any relevant life experiences, relationships, or circumstances?
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        placeholder="Life background, relationships, work, etc."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="culturalBackground"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cultural Background</FormLabel>
                      <FormControl>
                        <Input placeholder="Cultural/ethnic background" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="socioeconomicStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Socioeconomic Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="middle">Middle</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="educationLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Education Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select education" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high_school">High School</SelectItem>
                          <SelectItem value="some_college">Some College</SelectItem>
                          <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                          <SelectItem value="masters">Master's Degree</SelectItem>
                          <SelectItem value="phd">PhD</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="relationshipStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="dating">Dating</SelectItem>
                          <SelectItem value="married">Married</SelectItem>
                          <SelectItem value="divorced">Divorced</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                <Sparkles className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Personality & Traits
              </h3>
              <p className="text-gray-600">Define their personality characteristics</p>
            </div>

            <Tabs defaultValue="traits" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="traits">Personality Traits</TabsTrigger>
                <TabsTrigger value="communication">Communication</TabsTrigger>
                <TabsTrigger value="behaviors">Behaviors</TabsTrigger>
              </TabsList>

              <TabsContent value="traits" className="space-y-4">
                <div>
                  <FormLabel className="text-lg font-medium mb-3 block">
                    Personality Traits
                  </FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {personalityTraits.map((trait) => {
                      const selectedTraits = form.watch("personality")?.traits || [];
                      const isSelected = selectedTraits.includes(trait);
                      return (
                        <Button
                          key={trait}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const current = selectedTraits;
                            const updated = isSelected
                              ? current.filter(t => t !== trait)
                              : [...current, trait];
                            form.setValue("personality", { ...form.getValues("personality"), traits: updated });
                          }}
                          className="justify-start transition-all duration-200"
                        >
                          {trait}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="communication" className="space-y-4">
                <FormField
                  control={form.control}
                  name="communicationStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Communication Style</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {communicationStyles.map((style) => (
                            <SelectItem key={style} value={style}>
                              {style}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attachmentStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attachment Style</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {attachmentStyles.map((style) => (
                            <SelectItem key={style} value={style}>
                              {style}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="behaviors" className="space-y-4">
                <div>
                  <FormLabel className="text-base font-medium mb-2 block">Coping Mechanisms</FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(form.watch("copingMechanisms") || []).map((mechanism) => (
                      <Badge key={mechanism} variant="secondary" className="flex items-center gap-1">
                        {mechanism}
                        <X
                          size={12}
                          className="cursor-pointer"
                          onClick={() => removeArrayItem("copingMechanisms", mechanism)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Add coping mechanism"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          addArrayItem("copingMechanisms", value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <FormLabel className="text-base font-medium mb-2 block">Triggers</FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(form.watch("triggers") || []).map((trigger) => (
                      <Badge key={trigger} variant="secondary" className="flex items-center gap-1">
                        {trigger}
                        <X
                          size={12}
                          className="cursor-pointer"
                          onClick={() => removeArrayItem("triggers", trigger)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Add trigger"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          addArrayItem("triggers", value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        );

      case 5:
        return (
          <div className={baseClasses}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Target className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Review & Create
              </h3>
              <p className="text-gray-600">Review your persona details before creating</p>
            </div>

            <Card className="border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Basic Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Name:</span> {form.watch("fullName")}</p>
                      <p><span className="font-medium">Age:</span> {form.watch("age")}</p>
                      <p><span className="font-medium">Category:</span> {form.watch("category")}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Problem Summary</h4>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {form.watch("problemDescription")}
                    </p>
                  </div>
                </div>

                {(form.watch("background") || form.watch("culturalBackground")) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Background</h4>
                    <div className="text-sm text-gray-700">
                      {form.watch("background") && <p>{form.watch("background")}</p>}
                      {form.watch("culturalBackground") && (
                        <p className="mt-2"><span className="font-medium">Cultural Background:</span> {form.watch("culturalBackground")}</p>
                      )}
                    </div>
                  </div>
                )}

                {((form.watch("personality")?.traits?.length || 0) > 0) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Personality Traits</h4>
                    <div className="flex flex-wrap gap-2">
                      {(form.watch("personality")?.traits || []).map((trait) => (
                        <Badge key={trait} variant="outline" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Create Advanced Persona</DialogTitle>
          <DialogDescription>
            Build a detailed therapy persona with comprehensive psychological profile
          </DialogDescription>
        </DialogHeader>

        <div className="h-full overflow-y-auto">
          <div className="p-6">
            {/* Progress Header */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex flex-col items-center flex-1 min-w-0"
                  >
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm transition-all duration-300 ${
                        currentStep >= step.id
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "text-gray-400 border-gray-300"
                      }`}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="mt-2 text-center min-w-0">
                      <span
                        className={`text-xs font-medium block truncate ${
                          currentStep >= step.id ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {step.title}
                      </span>
                      <span className="text-xs text-gray-500 block">
                        {step.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Form */}
            <Form {...form}>
              <div className="space-y-6">
                {renderStepContent()}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t border-gray-200 mt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="flex items-center gap-2 px-4 py-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {currentStep < steps.length ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-2"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={form.handleSubmit(handleSubmit)}
                      disabled={createMutation.isPending}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {createMutation.isPending ? "Creating..." : "Create Persona"}
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}