import { ChatDialog } from "@/components/chat/ChatDialog";
import type { FormData } from "@/components/chat/ChatForm";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { Sidebar, type Thread as ThreadType } from "@/components/chat/Sidebar";
import { Thread } from "@/components/chat/Thread";
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
import { chatApi, threadsApi } from "@/lib/client";
import {
  useCreateThread,
  useMoveThreadToTop,
  useNormalThreads,
  useThreadSessions,
} from "@/lib/queries/threads";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";

function getThreadTitle(thread: any) {
  if (thread.sessionName) return thread.sessionName;
  if (thread.reasonForVisit) return thread.reasonForVisit;
  if (thread.createdAt) {
    const date = new Date(thread.createdAt);
    return `Thread #${thread.id} (${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }
  return `Thread #${thread.id}`;
}

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // // Admin check logging
  // const { user } = useUser();

  // // Log admin status on component mount and user changes
  // useEffect(() => {
  //   if (user) {
  //     const isAdmin = user.publicMetadata?.role === "admin";
  //     console.log("=== ADMIN CHECK ===");
  //     console.log("User ID:", user.id);
  //     console.log("User email:", user.primaryEmailAddress?.emailAddress);
  //     console.log("Is Admin:", isAdmin);
  //     console.log("Private metadata:", user.publicMetadata);
  //     console.log("==================");

  //     if (isAdmin) {
  //       console.log("🔑 ADMIN ACCESS GRANTED - User has admin privileges");
  //     } else {
  //       console.log("👤 REGULAR USER - No admin privileges");
  //     }
  //   } else {
  //     console.log("=== ADMIN CHECK ===");
  //     console.log("No user logged in");
  //     console.log("==================");
  //   }
  // }, [user]);

  // Use optimized thread selection from threadsStore
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
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const postSessionThreadIdRef = useRef<number | null>(null);
  const {
    conversationPreferences,
    setConversationPreferences,
    getInitialForm,
    setInitialForm,
  } = useChatStore();

  const queryClient = useQueryClient();

  // Auto-play background music on main page
  useBackgroundMusic("main");

  // Use TanStack Query directly instead of duplicating in Zustand
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
  const createThread = useCreateThread();
  const moveThreadToTop = useMoveThreadToTop();
  const { addMessage, clearMessages } = useChatStore();

  // Use query hook for sessions instead of manual fetching
  const { data: threadSessions } = useThreadSessions(selectedThreadId);

  const handleSelectThread = async (id: number) => {
    if (threadsWithoutPersona.some((t) => t.id === id)) {
      setSelectedThread(id);
      setThreadId(id);
      setSelectedSession(null);
      setSessionId(null);

      // Check session status and get the latest active session
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

      // Select the new session
      setSelectedSession(newSession.id);
      setSessionId(newSession.id);

      toast.success("New session created!");
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create new session");
    }
  };

  // Helper: fetch all messages for all sessions in a thread
  const fetchAllMessagesForThread = async (threadId: number) => {
    const sessions = threadSessions || [];
    let allMessages: any[] = [];
    for (const session of sessions) {
      try {
        const response = await fetch(`/api/chat/${session.id}`);
        if (response.ok) {
          const sessionMessages = await response.json();
          allMessages = allMessages.concat(sessionMessages);
        }
      } catch (e) {
        // ignore error for now
      }
    }
    return allMessages;
  };

  // Updated handleExpireSession to work with new session management
  const handleExpireSession = async (threadId: number) => {
    try {
      // Get current sessions for this thread
      const currentSessions = threadSessions || [];
      const activeSession = currentSessions.find(
        (session) => session.status === "active"
      );

      if (!activeSession) {
        toast.error("No active session found to expire");
        return;
      }

      // Check if session has enough messages for progression
      try {
        const response = await fetch(`/api/chat/${activeSession.id}`);
        if (response.ok) {
          const messages = await response.json();
          if (messages.length < 7) {
            toast.error(
              "Session needs at least 7 messages before progressing to next session"
            );
            return;
          }
        }
      } catch (error) {
        console.warn(
          "Could not check message count, proceeding with session progression"
        );
      }

      // Call API to manually expire current session and create new one
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

      // If session was completed, show success message and trigger form flow
      if (result.sessionCompleted) {
        toast.success(
          `Session ${activeSession.sessionNumber} completed! Please complete the follow-up form.`
        );

        // Refresh the thread sessions query
        queryClient.invalidateQueries({
          queryKey: ["threadSessions", threadId],
        });

        // If the current thread is selected, force it to re-check session status
        // This will trigger the session completion dialog
        if (selectedThreadId === threadId) {
          console.log(
            "[EXPIRE SESSION] Forcing thread re-selection to trigger completion dialog"
          );
          // Briefly switch away and back to trigger the Thread component's useEffect
          setSelectedThread(null);
          setTimeout(() => {
            console.log(
              "[EXPIRE SESSION] Re-selecting thread to show completion dialog"
            );
            setSelectedThread(threadId);
          }, 200); // Increased timeout slightly
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
    // Don't set session ID here - let the Thread component handle it
    // The session ID will be set when the thread is selected
    clearMessages();
    const cleanAIResponse = aiResponse.replace(/^[0-9]+/, "").trim();
    addMessage({
      sender: "ai",
      text: cleanAIResponse,
      timestamp: new Date(),
      contextId: "default",
    });
    // Thread will be added automatically via optimistic updates in the mutation
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
    if (
      !isLoading &&
      threadsWithoutPersona.length > 0 &&
      selectedThreadId == null
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
  ]);

  // Ensure a session is selected for the selected thread on initial load/refresh
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

  // Prepare threads with sessions for sidebar - only for selected thread to avoid overfetching
  const threadsWithSessions: ThreadType[] = threadsWithoutPersona.map((t) => ({
    id: t.id,
    title: getThreadTitle(t),
    sessions: t.id === selectedThreadId ? threadSessions : undefined,
  }));

  // Helper to get the latest active session for a thread
  const getLatestActiveSession = useCallback(
    (threadId: number) => {
      const sessions = threadSessions || [];
      // Prefer the latest active session
      const active = sessions.filter((s) => s.status === "active");
      return active.length > 0
        ? active[active.length - 1]
        : sessions[sessions.length - 1];
    },
    [threadSessions]
  );

  // Use optimistic update hook instead of manual state manipulation

  // Dynamic form rendering for generated questions
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
      {/* Mobile Topbar for mobile screens */}
      <div className="md:hidden w-full fixed top-0 left-0 z-50">
        <MobileTopbar
          onMenuClick={() => setIsSidebarOpen(true)}
          preferences={conversationPreferences}
          onPreferencesChange={setConversationPreferences}
        />
      </div>
      <Sidebar
        threads={threadsWithSessions}
        onSelectThread={handleSelectThread}
        onSelectSession={handleSelectSession}
        onNewThread={handleNewThread}
        onNewSession={handleNewSession}
        onExpireSession={handleExpireSession}
        selectedThreadId={selectedThreadId ?? null}
        selectedSessionId={selectedSessionId ?? null}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        limit={limit}
        setLimit={setLimit}
        offset={offset}
        setOffset={setOffset}
        total={totalThreads}
      />
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
            conversationPreferences={conversationPreferences}
            onThreadDeleted={() => {
              // Select first available thread after deletion
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

            // Immediately select the new thread and session
            setSelectedThread(session.id);
            setThreadId(session.id);

            // Use the sessionId from the response immediately
            const sessionId = session.sessionId || session.id;
            setSelectedSession(sessionId);
            setSessionId(sessionId);

            // Optimistically update the thread sessions cache
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

            // The form already handled the optimistic update for the threads list
            // No need to do additional async operations here
          }}
        />
      </div>
      {/* Post-session dialog for loading/generation and form */}
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
                    // Save form answers using the Hono client
                    try {
                      await threadsApi.saveSessionForm(session.id, values);
                    } catch (err) {
                      throw err;
                    }
                    toast.success(
                      "Form saved! Answers will be used in your next session."
                    );
                    setPostSessionDialogOpen(false);
                    // --- Switch to the new session and show indicator ---
                    setSessionId(session.id);
                    clearMessages();
                    setShowFormIndicator(true);
                    if (formIndicatorTimeoutRef.current) {
                      clearTimeout(formIndicatorTimeoutRef.current);
                    }
                    formIndicatorTimeoutRef.current = setTimeout(() => {
                      setShowFormIndicator(false);
                    }, 4000); // Show for 4 seconds
                    // --- End indicator logic ---
                    // --- Trigger therapist to send first engaging message ---
                    // Fetch the initial form for the new session
                    const initialForm = getInitialForm(session.id);
                    // Compose a system message to prompt the therapist to engage
                    const systemPrompt =
                      "Please greet and engage the user at the start of this new session, referencing their follow-up form answers if appropriate.";
                    // Send an empty user message to trigger the AI therapist's first message
                    // Find the thread for this session to get userId
                    const thread = threadsWithoutPersona.find(
                      (t) => t.id === threadId
                    );
                    if (!thread)
                      throw new Error("Thread not found for userId lookup");
                    await chatApi.sendMessage({
                      message: "", // No user message, just trigger the AI
                      context: [],
                      sessionId: session.id,
                      userId: String(thread.userId), // Use userId from thread
                      initialForm: initialForm,
                      systemInstruction: systemPrompt,
                      threadType: "main",
                    });
                    // --- End therapist auto-engage ---
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
