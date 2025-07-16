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
import { generateFormApi, threadsApi } from "@/lib/client";
import { useCreateThread, useNormalThreads } from "@/lib/queries/threads";
import { useChatStore } from "@/stores/chatStore";
import { useThreadsStore } from "@/stores/threadsStore";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
  // Remove local state for selectedThreadId and selectedSessionId
  // Use Zustand store for selection state
  const selectedThreadId = useChatStore((s) => s.currentContext.threadId);
  const selectedSessionId = useChatStore((s) => s.currentContext.sessionId);
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
    setThreadSessions,
    getThreadSessions,
    getInitialForm,
    setInitialForm,
  } = useChatStore();

  const { data: threadsData, isLoading } = useNormalThreads(true);
  const { normalThreads, setNormalThreads, addNormalThread } =
    useThreadsStore();

  // Clear chat state when main page loads
  useEffect(() => {
    const { clearMessages, setSessionId, setThreadId } =
      useChatStore.getState();
    clearMessages();
    setSessionId(null);
    setThreadId(null);
  }, []);

  useEffect(() => {
    if (!isLoading && Array.isArray(threadsData)) {
      setNormalThreads(threadsData);
    }
  }, [isLoading, threadsData, setNormalThreads]);

  const threadsWithoutPersona = normalThreads;
  const createThread = useCreateThread();
  const { addMessage, clearMessages } = useChatStore();

  // Fetch sessions for threads
  useEffect(() => {
    const fetchSessionsForThreads = async () => {
      for (const thread of threadsWithoutPersona) {
        try {
          const sessions = await threadsApi.getSessions(thread.id);
          setThreadSessions(thread.id, sessions);
        } catch (error) {
          console.error(
            `Error fetching sessions for thread ${thread.id}:`,
            error
          );
        }
      }
    };

    if (threadsWithoutPersona.length > 0) {
      fetchSessionsForThreads();
    }
  }, [threadsWithoutPersona, setThreadSessions]);

  const handleSelectThread = async (id: number) => {
    if (threadsWithoutPersona.some((t) => t.id === id)) {
      setThreadId(id);
      setSessionId(null); // Clear session selection when selecting thread

      // Check session status and get the latest active session
      try {
        const sessionCheck = await threadsApi.checkSession(id);

        // Update sessions for this thread
        const sessions = await threadsApi.getSessions(id);
        setThreadSessions(id, sessions);

        // Select the latest active session
        if (sessionCheck.latestSession) {
          setSessionId(sessionCheck.latestSession.id);
        }
      } catch (error) {
        console.error("Error checking session status:", error);
      }
    }
  };

  const handleSelectSession = (sessionId: number) => {
    setSessionId(sessionId);
  };

  const handleNewThread = () => {
    setChatDialogOpen(true);
  };

  const handleNewSession = async (threadId: number) => {
    try {
      const newSession = await threadsApi.createSession(threadId, {
        sessionName: `Session ${(getThreadSessions(threadId)?.length || 0) + 1}`,
      });

      // Update sessions for this thread
      const currentSessions = getThreadSessions(threadId) || [];
      setThreadSessions(threadId, [...currentSessions, newSession]);

      // Select the new session
      setSessionId(newSession.id);

      toast.success("New session created!");
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create new session");
    }
  };

  // Helper: fetch all messages for all sessions in a thread
  const fetchAllMessagesForThread = async (threadId: number) => {
    const sessions = getThreadSessions(threadId) || [];
    let allMessages: any[] = [];
    for (const session of sessions) {
      try {
        const response = await fetch(
          `http://localhost:4000/api/chat/${session.id}`
        );
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

  // Patch handleExpireSession to trigger post-session dialog and generation
  const handleExpireSession = async (threadId: number) => {
    try {
      setPostSessionDialogOpen(true);
      setIsGeneratingForm(true);
      setGeneratedQuestions(null);
      setFormError(null);
      postSessionThreadIdRef.current = threadId;

      // Get current sessions for this thread
      const currentSessions = getThreadSessions(threadId) || [];
      const activeSession = currentSessions.find(
        (session) => session.status === "active"
      );

      if (!activeSession) {
        toast.error("No active session found to expire");
        setPostSessionDialogOpen(false);
        return;
      }

      // Get the initial form from the current session before expiring it
      const currentInitialForm = getInitialForm(activeSession.id);

      // Call API to mark session as finished
      const response = await fetch(
        `http://localhost:4000/api/threads/${threadId}/expire-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: activeSession.id }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to expire session");
      }

      // Refresh sessions for this thread
      const updatedSessions = await threadsApi.getSessions(threadId);
      setThreadSessions(threadId, updatedSessions);

      // Fetch all messages for all sessions
      const allMessages = await fetchAllMessagesForThread(threadId);

      // Get persona/initialForm for the thread (use the first session's initialForm or fallback)
      let personaForm = null;
      if (currentSessions.length > 0) {
        personaForm =
          getInitialForm(currentSessions[0].id) || currentInitialForm;
      } else {
        personaForm = currentInitialForm;
      }
      // Defensive fallback: ensure personaForm is always a non-null object
      if (
        typeof personaForm !== "object" ||
        personaForm === null ||
        Array.isArray(personaForm)
      ) {
        personaForm = {};
      }
      // Call generate-form API
      const genData = await generateFormApi.generate({
        initialForm: personaForm,
        messages: allMessages.map((m) => ({ sender: m.sender, text: m.text })),
      });
      setGeneratedQuestions(genData.questions || []);
      setIsGeneratingForm(false);
    } catch (error: any) {
      setFormError(error.message || "Unknown error");
      setIsGeneratingForm(false);
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
    if (newThread) {
      addNormalThread(newThread);
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
    if (
      !isLoading &&
      threadsWithoutPersona.length > 0 &&
      selectedThreadId == null
    ) {
      setThreadId(threadsWithoutPersona[0].id);
    }
  }, [isLoading, threadsWithoutPersona, selectedThreadId, setThreadId]);

  // Prepare threads with sessions for sidebar
  const threadsWithSessions: ThreadType[] = threadsWithoutPersona.map((t) => ({
    id: t.id,
    title: getThreadTitle(t),
    sessions: getThreadSessions(t.id),
  }));

  // Helper to get the latest active session for a thread
  const getLatestActiveSession = useCallback(
    (threadId: number) => {
      const sessions = getThreadSessions(threadId) || [];
      // Prefer the latest active session
      const active = sessions.filter((s) => s.status === "active");
      return active.length > 0
        ? active[active.length - 1]
        : sessions[sessions.length - 1];
    },
    [getThreadSessions]
  );

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
          />
        )}
        <ChatDialog
          open={chatDialogOpen}
          onOpenChange={setChatDialogOpen}
          onSubmit={handleChatFormSubmit}
          onThreadCreated={async (session) => {
            // Close the dialog first
            setChatDialogOpen(false);

            // Select the new thread (session contains both thread data and sessionId)
            setThreadId(session.id);

            // Add a small delay to ensure the thread is properly created
            setTimeout(async () => {
              // Fetch sessions for the new thread and select the first session
              try {
                const sessions = await threadsApi.getSessions(session.id);
                setThreadSessions(session.id, sessions);

                // Select the first session (Session 1) or use the sessionId from the response
                if (sessions.length > 0) {
                  setSessionId(sessions[0].id);
                } else if (session.sessionId) {
                  // If no sessions found but we have a sessionId from the response, use it
                  setSessionId(session.sessionId);
                }
              } catch (error) {
                console.error("Error fetching sessions for new thread:", error);
                // If we can't fetch sessions, still try to select the thread
                // The Thread component will handle creating a session if needed
              }
            }, 100);
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
