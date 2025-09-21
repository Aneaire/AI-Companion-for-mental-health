import { ChatDialog } from "@/components/chat/ChatDialog";
import type { FormData } from "@/components/chat/ChatForm";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar, type Thread as ThreadType } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chatApi, threadsApi, generateFormApi } from "@/lib/client";
import client from "@/lib/client";
import {
  useMoveThreadToTop,
  useNormalThreads,
  useThreadSessions,
} from "@/lib/queries/threads";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { useUserProfile } from "@/lib/queries/user";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Play, Pause, SkipForward, SkipBack } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { processStreamingResponse } from "@/lib/utils";
import { patchMarkdown } from "@/components/chat/MessageList";

// Random problem scenarios for the demo
const DEMO_PROBLEMS = [
  {
    category: "Anxiety",
    scenarios: [
      "I've been having panic attacks at work and I don't know what to do",
      "I'm constantly worried about the future and can't sleep at night",
      "My social anxiety is getting worse and I'm avoiding friends",
      "I feel overwhelmed by daily tasks and can't focus"
    ]
  },
  {
    category: "Depression",
    scenarios: [
      "I've lost interest in activities I used to enjoy",
      "I feel hopeless and like nothing matters anymore",
      "I'm sleeping too much and still feel exhausted",
      "I've been isolating myself from family and friends"
    ]
  },
  {
    category: "Relationship Issues",
    scenarios: [
      "My partner and I argue constantly and I don't know how to fix it",
      "I'm struggling with trust issues in my relationship",
      "I feel lonely even though I'm in a relationship",
      "I'm going through a breakup and having trouble coping"
    ]
  },
  {
    category: "Work Stress",
    scenarios: [
      "I'm burned out from my job and considering quitting",
      "My boss is putting too much pressure on me",
      "I'm struggling with work-life balance",
      "I'm worried about losing my job"
    ]
  },
  {
    category: "Self-Esteem",
    scenarios: [
      "I don't feel good enough and compare myself to others",
      "I'm struggling with imposter syndrome at work",
      "I can't accept compliments and always doubt myself",
      "I'm too hard on myself when I make mistakes"
    ]
  }
];

function getThreadTitle(thread: any) {
  if (thread.sessionName) return thread.sessionName;
  if (thread.reasonForVisit) return thread.reasonForVisit;
  if (thread.createdAt) {
    const date = new Date(thread.createdAt);
    return `Demo Thread #${thread.id} (${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }
  return `Demo Thread #${thread.id}`;
}

export const Route = createFileRoute("/demo")({
  component: Demo,
});

function Demo() {
  const { userId } = useAuth();
  const { data: userProfile } = useUserProfile(userId || null);
  const {
    selectedThreadId,
    selectedSessionId,
    setSelectedThread,
    setSelectedSession,
  } = useThreadsStore();
  const setThreadId = useChatStore((s) => s.setThreadId);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [postSessionDialogOpen, setPostSessionDialogOpen] = useState(false);
  const [isGeneratingForm, setIsGeneratingForm] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const postSessionThreadIdRef = useRef<number | null>(null);
  
  // Demo-specific states
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [currentDemoStep, setCurrentDemoStep] = useState(0);
  const [demoSpeed, setDemoSpeed] = useState(2000); // milliseconds between messages
  const [selectedProblem, setSelectedProblem] = useState<string>("");
  const [demoThreadId, setDemoThreadId] = useState<number | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    conversationPreferences,
    setConversationPreferences,
    getInitialForm,
    setInitialForm,
  } = useChatStore();

  const queryClient = useQueryClient();

  const {
    data: threadsData,
    isLoading,
    limit,
    setLimit,
    offset,
    setOffset,
  } = useNormalThreads(true);

  const threadsWithoutPersona = threadsData?.threads || [];
  const totalThreads = threadsData?.total || 0;
  const moveThreadToTop = useMoveThreadToTop();
  const { addMessage, clearMessages, updateLastMessage } = useChatStore();

  const { data: threadSessions } = useThreadSessions(selectedThreadId);

  // Demo user messages that simulate a conversation
  const DEMO_USER_MESSAGES = [
    "Hi, I need to talk about something that's been bothering me lately.",
    "I've been feeling really anxious about my job situation.",
    "My boss has been putting a lot of pressure on me to meet impossible deadlines.",
    "I'm having trouble sleeping because I keep thinking about work all night.",
    "I've started having panic attacks during meetings and it's embarrassing.",
    "I don't know how to handle this stress anymore.",
    "I'm worried I might lose my job if I can't perform better.",
    "Do you have any suggestions for managing this anxiety?",
    "I've tried deep breathing but it only helps temporarily.",
    "I'm also worried about how this is affecting my family life.",
    "My wife says I've been distant and irritable at home.",
    "I feel like I'm failing at both work and being a good husband.",
    "Maybe I should look for a different job?",
    "But I'm scared to make a big change right now.",
    "What would you do in my situation?",
    "Thank you for listening, I feel a bit better just talking about it."
  ];

  const handleSelectThread = async (id: number) => {
    if (threadsWithoutPersona.some((t) => t.id === id)) {
      setSelectedThread(id);
      setThreadId(id);
      setSelectedSession(null);
      setSessionId(null);

      try {
        const sessionCheck = await threadsApi.checkSession(id);
        if (sessionCheck.latestSession) {
          setSelectedSession(sessionCheck.latestSession.id);
          setSessionId(sessionCheck.latestSession.id);
        }
      } catch (error) {
        console.error("Error checking session status:", error);
      }
    }
  };

  const handleSelectSession = (sessionId: number) => {
    setSelectedSession(sessionId);
  };

  const handleNewThread = () => {
    setChatDialogOpen(true);
  };

  const handleNewSession = async (threadId: number) => {
    try {
      const sessionsCount = threadSessions?.length || 0;
      const newSession = await threadsApi.createSession(threadId, {
        sessionName: `Session ${sessionsCount + 1}`,
      });

      setSelectedSession(newSession.id);
      setSessionId(newSession.id);

      toast.success("New session created!");
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create new session");
    }
  };

  const handleExpireSession = async (threadId: number) => {
    try {
      const currentSessions = threadSessions || [];
      const activeSession = currentSessions.find(
        (session) => session.status === "active"
      );

      if (!activeSession) {
        toast.error("No active session found to expire");
        return;
      }

      const response = await fetch(`/api/threads/${threadId}/expire-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to expire session");
      }

      const result = await response.json();

      if (result.sessionCompleted) {
        toast.success(
          `Session ${activeSession.sessionNumber} completed! Please complete the follow-up form.`
        );

        queryClient.invalidateQueries({
          queryKey: ["threadSessions", threadId],
        });

        if (selectedThreadId === threadId) {
          setSelectedThread(null);
          setTimeout(() => {
            setSelectedThread(threadId);
          }, 200);
        }
      } else {
        toast.info("Could not complete session progression.");
      }
    } catch (error: any) {
      console.error("Error expiring session:", error);
      toast.error("Failed to progress session. Please try again.");
    }
  };

  const handleChatFormSubmit = (
    formData: FormData,
    aiResponse: string,
    sessionId: number,
    newThread?: any
  ) => {
    clearMessages();
    const cleanAIResponse = aiResponse.replace(/^[0-9]+/, "").trim();
    addMessage({
      sender: "ai",
      text: cleanAIResponse,
      timestamp: new Date(),
      contextId: "default",
    });
  };

  // Demo-specific functions
  const startDemo = async () => {
    if (!selectedProblem) {
      toast.error("Please select a problem scenario first");
      return;
    }

    // Clear any existing thread selection to start fresh
    setSelectedThread(null);
    setThreadId(null);
    setSelectedSession(null);
    setSessionId(null);
    clearMessages();

    setIsDemoRunning(true);
    setCurrentDemoStep(0);

    // Create a new demo thread if needed
    if (!demoThreadId) {
      try {
        const formData: FormData = {
          preferredName: "Demo User",
          currentEmotions: ["anxious", "overwhelmed"],
          reasonForVisit: selectedProblem,
          supportType: ["listen", "copingTips"],
          supportTypeOther: "",
          additionalContext: "This is a demo session for demonstration purposes.",
          responseTone: "empathetic",
          imageResponse: "",
          responseCharacter: "",
          responseDescription: "",
        };

        // Create thread using direct API call like ChatForm does
        if (!userProfile?.id) {
          throw new Error("User not authenticated");
        }

        const threadResponse = await client.api.threads.$post({
          json: {
            userId: userProfile.id,
            preferredName: formData.preferredName,
            currentEmotions: formData.currentEmotions,
            reasonForVisit: formData.reasonForVisit,
            supportType: formData.supportType,
            supportTypeOther: formData.supportTypeOther,
            additionalContext: formData.additionalContext,
            responseTone: formData.responseTone,
            imageResponse: formData.imageResponse,
            responseCharacter: formData.responseCharacter,
            responseDescription: formData.responseDescription,
          },
        });

        if (!threadResponse.ok) {
          throw new Error("Failed to create thread");
        }

        const newThread = await threadResponse.json();
        setDemoThreadId(newThread.id);
        setSelectedThread(newThread.id);
        setThreadId(newThread.id);
        
        // Wait a bit for the thread to be created and session to be set up
        setTimeout(() => {
          runDemoConversation();
        }, 1000);
      } catch (error) {
        console.error("Error creating demo thread:", error);
        toast.error("Failed to start demo");
        setIsDemoRunning(false);
      }
    } else {
      runDemoConversation();
    }
  };

  const runDemoConversation = () => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
    }

    demoIntervalRef.current = setInterval(async () => {
      if (currentDemoStep < DEMO_USER_MESSAGES.length) {
        // Send user message
        const message = DEMO_USER_MESSAGES[currentDemoStep];
        
        // Simulate user sending message
        if (selectedThreadId && selectedSessionId) {
          try {
            console.log("Sending message with params:", {
              message: message,
              sessionId: selectedSessionId,
              userId: userProfile?.id,
              threadType: "main",
              conversationPreferences: {},
            });
            console.log("Session state check - Thread ID:", selectedThreadId, "Session ID:", selectedSessionId);
            if (!userProfile?.id) {
              throw new Error("User profile not available");
            }

            // Add user message to chat store (like Thread component does)
            const userMessage = {
              sender: "user" as const,
              text: message,
              timestamp: new Date(),
              contextId: "default",
            };
            addMessage(userMessage);

            // Handle streaming AI response using demo endpoint
            const response = await client.api["demo-chat"].$post({
              json: {
                message: message,
                sessionId: Number(selectedSessionId),
                userId: String(userProfile.id),
                threadType: "main",
                conversationPreferences: {},
              },
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Failed to get response");
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("No reader available");
            }

            // Create AI message with empty text and add to store (like Thread component)
            if (message.trim()) {
              const tempId = Date.now();
              const aiMessage: any = {
                sender: "ai",
                text: "",
                timestamp: new Date(),
                tempId,
                contextId: "default",
              };
              addMessage(aiMessage);
            }

            // Handle streaming response (same logic as Thread component)
            const decoder = new TextDecoder();
            let fullResponse = "";
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value);

              let lines = buffer.split("\n");
              buffer = lines.pop() || ""; // Keep incomplete last line in buffer

              for (const line of lines) {
                if (line.startsWith("event: crisis")) {
                  // Crisis event received
                  const crisisDataMatch = line.match(/^data: (.*)$/);
                  if (crisisDataMatch) {
                    const crisisMsg = crisisDataMatch[1];
                    updateLastMessage(crisisMsg);
                  }
                  return;
                }
                if (line.startsWith("data: ")) {
                  const content = line.substring("data: ".length);
                  // Skip session_id events and empty content
                  if (
                    content.trim() === "" ||
                    (!isNaN(Number(content.trim())) && content.trim().length < 10)
                  ) {
                    continue;
                  }
                  fullResponse += content + "\n";
                }
              }

              // Update the last message with new content
              const chatState = useChatStore.getState();
              const lastMessage = chatState.currentContext.messages[chatState.currentContext.messages.length - 1];
              if (
                fullResponse !==
                lastMessage?.text
              ) {
                updateLastMessage(fullResponse);
              }
            }

            // After the loop, the last chunk might not have ended with a newline.
            if (buffer) {
              fullResponse += buffer;
            }
            
            // Clean up the response and update final message
            fullResponse = fullResponse
              .replace(/\n+/g, "\n")
              .replace(/^\n+|\n+$/g, "")
              .replace(/\n{2,}/g, "\n");
            
            if (!fullResponse.endsWith("\n")) {
              fullResponse += "\n";
            }
            
            updateLastMessage(fullResponse);

            // Check if we've reached the message limit for session progression (7+ messages)
            // Since we send 1 message per step, we check at step 6 (0-indexed, so 7th message)
            if (currentDemoStep >= 6) {
              // Wait a bit for the message to be processed, then expire session
              setTimeout(async () => {
                if (selectedThreadId) {
                  try {
                    await handleExpireSession(selectedThreadId);
                    toast.info("Session completed! Form generation will begin shortly.");
                    
                    // Wait for form generation, then auto-complete it
                    setTimeout(async () => {
                      await autoCompleteForm();
                    }, 3000);
                  } catch (error) {
                    console.error("Error in session progression:", error);
                  }
                }
              }, 1000);
            }
          } catch (error) {
            console.error("Error sending demo message:", error);
            toast.error("Error sending demo message. Stopping demo.");
            stopDemo();
            return;
          }
        }
        
        setCurrentDemoStep(prev => prev + 1);
      } else {
        // End of demo
        stopDemo();
        toast.success("Demo completed! You can now see the full conversation flow.");
      }
    }, demoSpeed);
  };

  const stopDemo = () => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setIsDemoRunning(false);
  };

  const pauseDemo = () => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setIsDemoRunning(false);
  };

  const resumeDemo = () => {
    setIsDemoRunning(true);
    runDemoConversation();
  };

  const resetDemo = () => {
    stopDemo();
    setCurrentDemoStep(0);
    setSelectedProblem("");
    setDemoThreadId(null);
    clearMessages();
    // Clear thread selection to return to initial state
    setSelectedThread(null);
    setThreadId(null);
    setSelectedSession(null);
    setSessionId(null);
  };

  const autoCompleteForm = async () => {
    try {
      // Get the latest session for the current thread
      if (!selectedThreadId) return;
      
      const sessions = threadSessions || [];
      const finishedSession = sessions.find(s => s.status === "finished");
      
      if (!finishedSession) {
        console.error("No finished session found for form completion");
        return;
      }

      // Get conversation history for form generation
      const messagesResponse = await fetch(`/api/chat/messages?sessionId=${finishedSession.id}&threadType=main`);
      const messagesData = await messagesResponse.json();
      const conversationMessages = messagesData.messages || [];

      // Generate form using AI
      const initialFormData = {
        preferredName: "Demo User",
        reasonForVisit: selectedProblem,
        currentEmotions: ["anxious", "overwhelmed"],
        supportType: ["listen", "copingTips"]
      };

      const formGeneration = await generateFormApi.generate({
        initialForm: initialFormData,
        messages: conversationMessages.map((msg: any) => ({
          sender: msg.sender,
          text: msg.text
        }))
      });

      if (formGeneration.success && formGeneration.questions) {
        // Auto-fill the generated form with mock responses
        const autoFilledAnswers: Record<string, string> = {};
        formGeneration.questions.forEach((question: any) => {
          switch (question.label.toLowerCase()) {
            case "how are you feeling since our last session?":
              autoFilledAnswers[question.name || question.label] = "I'm feeling a bit better after talking about my work stress. The anxiety is still there but more manageable.";
              break;
            case "what coping strategies have you tried?":
              autoFilledAnswers[question.name || question.label] = "I've tried deep breathing exercises and taking short walks during work breaks. They help temporarily.";
              break;
            case "have you noticed any improvements in your sleep?":
              autoFilledAnswers[question.name || question.label] = "My sleep has improved slightly. I'm still thinking about work but not as intensely as before.";
              break;
            case "how is your work-life balance now?":
              autoFilledAnswers[question.name || question.label] = "It's still challenging, but I'm more aware of the problem now. I'm trying to set boundaries.";
              break;
            case "what would you like to focus on in our next session?":
              autoFilledAnswers[question.name || question.label] = "I'd like to work on specific techniques for managing panic attacks during meetings and better work-life balance strategies.";
              break;
            default:
              autoFilledAnswers[question.name || question.label] = "The conversation has been helpful. I'm looking forward to continuing our sessions and making more progress.";
          }
        });

        // Save the auto-completed form
        await threadsApi.saveSessionForm(finishedSession.id, autoFilledAnswers);
        toast.success("AI-generated form completed automatically!");
      } else {
        throw new Error("Failed to generate form questions");
      }
      
      toast.success("Follow-up form completed automatically!");
      
      // Create new session after form completion
      setTimeout(async () => {
        try {
          const response = await fetch(`/api/threads/${selectedThreadId}/create-next-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });
          
          if (response.ok) {
            const result = await response.json();
            setSelectedSession(result.newSession.id);
            setSessionId(result.newSession.id);
            toast.success(`New session created: ${result.newSession.sessionName}`);
            
            // Continue demo with new session if demo is still running
            if (isDemoRunning) {
              setTimeout(() => {
                runDemoConversation();
              }, 2000);
            }
          }
        } catch (error) {
          console.error("Error creating next session:", error);
          toast.error("Failed to create next session");
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error auto-completing form:", error);
      toast.error("Failed to auto-complete form");
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Only auto-select a thread if we're not in demo mode or if demo hasn't started
    if (
      !isLoading &&
      threadsWithoutPersona.length > 0 &&
      selectedThreadId == null &&
      !isDemoRunning &&
      !demoThreadId
    ) {
      setSelectedThread(threadsWithoutPersona[0].id);
      setThreadId(threadsWithoutPersona[0].id);
    }
  }, [
    isLoading,
    threadsWithoutPersona,
    selectedThreadId,
    setSelectedThread,
    setThreadId,
    isDemoRunning,
    demoThreadId,
  ]);

  useEffect(() => {
    const ensureSessionSelected = async () => {
      if (!selectedThreadId || selectedSessionId != null) return;
      try {
        const sessionCheck = await threadsApi.checkSession(selectedThreadId);
        if (sessionCheck?.latestSession?.id) {
          setSelectedSession(sessionCheck.latestSession.id);
          setSessionId(sessionCheck.latestSession.id);
        }
      } catch (err) {
        console.error("Error ensuring session on initial load:", err);
      }
    };
    ensureSessionSelected();
  }, [selectedThreadId, selectedSessionId, setSelectedSession, setSessionId]);

  const threadsWithSessions: ThreadType[] = threadsWithoutPersona.map((t) => ({
    id: t.id,
    title: getThreadTitle(t),
    sessions: t.id === selectedThreadId ? threadSessions : undefined,
  }));

  const getLatestActiveSession = useCallback(
    (threadId: number) => {
      const sessions = threadSessions || [];
      const active = sessions.filter((s) => s.status === "active");
      return active.length > 0
        ? active[active.length - 1]
        : sessions[sessions.length - 1];
    },
    [threadSessions]
  );

  // Dynamic form rendering
  function GeneratedForm({
    questions,
    onSubmit,
  }: {
    questions: any[];
    onSubmit: (values: any) => void;
  }) {
    const form = useForm();
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {questions.map((q, idx) => (
            <FormField
              key={q.name || idx}
              control={form.control}
              name={q.name}
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{q.label}</FormLabel>
                  <FormControl>
                    {q.type === "text" ? (
                      <Input {...field} />
                    ) : q.type === "textarea" ? (
                      <Textarea {...field} />
                    ) : q.type === "select" ? (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
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
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
            disabled={formSubmitting}
          >
            {formSubmitting ? "Saving..." : "Submit"}
          </button>
          {formSubmitError && (
            <div className="text-red-600 text-sm mt-2">{formSubmitError}</div>
          )}
        </form>
      </Form>
    );
  }

  const [showFormIndicator, setShowFormIndicator] = useState(false);
  const formIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <div className="flex h-screen w-full">
      {/* Demo Control Panel */}
      <div className="w-80 bg-gray-900 text-white p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Live Demo Controls</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Problem Scenario:
            </label>
            <Select value={selectedProblem} onValueChange={setSelectedProblem}>
              <SelectTrigger className="w-full bg-gray-800 border-gray-700">
                <SelectValue placeholder="Choose a problem" />
              </SelectTrigger>
              <SelectContent>
                {DEMO_PROBLEMS.map((category) => (
                  <div key={category.category}>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-800">
                      {category.category}
                    </div>
                    {category.scenarios.map((scenario) => (
                      <SelectItem key={scenario} value={scenario}>
                        {scenario}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Demo Speed: {demoSpeed}ms
            </label>
            <input
              type="range"
              min="1000"
              max="5000"
              step="500"
              value={demoSpeed}
              onChange={(e) => setDemoSpeed(Number(e.target.value))}
              className="w-full"
              disabled={isDemoRunning}
            />
          </div>

          <div className="flex gap-2">
            {!isDemoRunning ? (
              <Button
                onClick={startDemo}
                disabled={!selectedProblem}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Demo
              </Button>
            ) : (
              <Button
                onClick={pauseDemo}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            
            {isDemoRunning && (
              <Button
                onClick={resumeDemo}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
            )}
          </div>

          <Button
            onClick={resetDemo}
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <SkipBack className="w-4 h-4 mr-2" />
            Reset Demo
          </Button>

          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Demo Progress</h3>
            <div className="text-sm text-gray-300">
              Step {currentDemoStep} of {DEMO_USER_MESSAGES.length}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(currentDemoStep / DEMO_USER_MESSAGES.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Demo Features</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• AI acts as user with problems</li>
              <li>• Automatic conversation flow</li>
              <li>• Session progression</li>
              <li>• Form generation & completion</li>
              <li>• Multi-session demonstration</li>
            </ul>
          </div>

          {currentDemoStep < DEMO_USER_MESSAGES.length && (
            <div className="mt-4 p-4 bg-blue-900 rounded-lg">
              <h3 className="font-semibold mb-2">Next Message:</h3>
              <p className="text-sm text-blue-200">
                {DEMO_USER_MESSAGES[currentDemoStep]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <MobileTopbar
          onMenuClick={() => setIsSidebarOpen(true)}
          preferences={conversationPreferences}
          onPreferencesChange={setConversationPreferences}
        />
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading threads...
          </div>
        ) : (!selectedThreadId && (isDemoRunning || demoThreadId)) ? (
          // Demo mode: show ready state when no thread is selected
          <div className="flex flex-1 flex-col items-center justify-center h-full space-y-4">
            <h2 className="text-2xl font-semibold text-gray-700">
              Demo Ready
            </h2>
            <p className="text-gray-500 text-center max-w-md">
              Select a problem scenario and click "Start Demo" to begin the automated conversation.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
              <h3 className="font-semibold text-blue-800 mb-2">Demo Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Automated conversation with AI therapist</li>
                <li>• Session progression and form generation</li>
                <li>• Multi-session demonstration</li>
                <li>• Adjustable conversation speed</li>
              </ul>
            </div>
          </div>
        ) : threadsWithoutPersona.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center h-full space-y-4">
            <h2 className="text-2xl font-semibold text-gray-700">
              No Conversations Yet
            </h2>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-lg"
              onClick={() => setChatDialogOpen(true)}
            >
              Start a New Conversation
            </button>
          </div>
        ) : (
          <Thread
            selectedThreadId={selectedThreadId ?? null}
            selectedSessionId={selectedSessionId ?? null}
            showFormIndicator={showFormIndicator}
            onMessageSent={moveThreadToTop}
            onSessionSelected={handleSelectSession}
            onThreadDeleted={() => {
              if (threadsWithoutPersona.length > 1) {
                const remainingThreads = threadsWithoutPersona.filter(
                  (t) => t.id !== selectedThreadId
                );
                if (remainingThreads.length > 0) {
                  handleSelectThread(remainingThreads[0].id);
                }
              } else {
                setSelectedThread(null);
                setThreadId(null);
                setSelectedSession(null);
                setSessionId(null);
              }
            }}
          />
        )}
        <ChatDialog
          open={chatDialogOpen}
          onOpenChange={setChatDialogOpen}
          onSubmit={handleChatFormSubmit}
          onThreadCreated={async (session) => {
            setChatDialogOpen(false);
            setSelectedThread(session.id);
            setThreadId(session.id);
            const sessionId = session.sessionId || session.id;
            setSelectedSession(sessionId);
            setSessionId(sessionId);
            queryClient.setQueryData(
              ["threadSessions", session.id],
              [
                {
                  id: sessionId,
                  threadId: session.id,
                  sessionNumber: 1,
                  sessionName: "Session 1",
                  status: "active",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ]
            );
          }}
        />
      </div>

      {/* Post-session dialog */}
      <Dialog
        open={postSessionDialogOpen}
        onOpenChange={setPostSessionDialogOpen}
      >
        <DialogContent className="max-w-lg">
          {isGeneratingForm ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin mb-4" size={32} />
              <div className="text-lg font-semibold">
                Preparing your next session...
              </div>
              <div className="text-gray-500 mt-2 text-sm">
                Generating personalized follow-up questions. Please wait.
              </div>
            </div>
          ) : formError ? (
            <div className="text-red-600 font-semibold">{formError}</div>
          ) : generatedQuestions ? (
            <div>
              <div className="text-lg font-semibold mb-2">
                Session Follow-up Form
              </div>
              <GeneratedForm
                questions={generatedQuestions}
                onSubmit={async (values) => {
                  setFormSubmitting(true);
                  setFormSubmitError(null);
                  try {
                    const threadId = postSessionThreadIdRef.current;
                    if (!threadId) throw new Error("No thread selected");
                    const session = getLatestActiveSession(threadId);
                    if (!session) throw new Error("No session found");
                    
                    await threadsApi.saveSessionForm(session.id, values);
                    toast.success(
                      "Form saved! Answers will be used in your next session."
                    );
                    setPostSessionDialogOpen(false);
                    setSessionId(session.id);
                    clearMessages();
                    setShowFormIndicator(true);
                    if (formIndicatorTimeoutRef.current) {
                      clearTimeout(formIndicatorTimeoutRef.current);
                    }
                    formIndicatorTimeoutRef.current = setTimeout(() => {
                      setShowFormIndicator(false);
                    }, 4000);
                    
                    // Auto-continue demo after form completion
                    if (isDemoRunning) {
                      setTimeout(() => {
                        runDemoConversation();
                      }, 2000);
                    }
                  } catch (err: any) {
                    setFormSubmitError(err.message || "Unknown error");
                  } finally {
                    setFormSubmitting(false);
                  }
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Route.options.component;