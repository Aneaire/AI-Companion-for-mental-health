import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@clerk/clerk-react";
import { useChatStore } from "@/stores/chatStore";
import {
  MessageCircle,
  Send,
  User,
  Loader2,
} from "lucide-react";
import MobileTopbar from "@/components/chat/MobileTopbar";
import { CounselorSidebar } from "@/components/chat/CounselorSidebar";
import { CounselorRequestDialog } from "@/components/chat/CounselorRequestDialog";

interface CounselorRequest {
  id: number;
  status: "pending" | "accepted" | "completed" | "cancelled";
  requestReason: string;
  urgencyLevel: "low" | "medium" | "high" | "urgent";
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  adminNotes?: string;
}

interface CounselorChat {
  id: number;
  requestId: number;
  status: "active" | "ended";
  startedAt: string;
  messageCount: number;
}

interface CounselorMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderType: "user" | "counselor";
  message: string;
  messageType: "text" | "system";
  timestamp: string;
}

interface RequestLimit {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export const Route = createFileRoute("/counselor")({
  component: CounselorPage,
});

function CounselorPage() {
  const { getToken } = useAuth();
  const { conversationPreferences, setConversationPreferences } = useChatStore();
  const [requests, setRequests] = useState<CounselorRequest[]>([]);
  const [activeChat, setActiveChat] = useState<CounselorChat | null>(null);
  const [chatMessages, setChatMessages] = useState<CounselorMessage[]>([]);
  const [requestLimit, setRequestLimit] = useState<RequestLimit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  
  // Counselor dialog state
  const [counselorRequestDialogOpen, setCounselorRequestDialogOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchRequestLimit();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchRequests = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch("/api/counselor/user/requests", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch requests");
      const data = await response.json();
      console.log("Counselor page - User requests:", data.requests);
      setRequests(data.requests || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load counselor requests");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRequestLimit = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch("/api/counselor/limit", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch request limit");
      const data = await response.json();
      setRequestLimit(data);
    } catch (error) {
      console.error("Error fetching request limit:", error);
    }
  };

  const loadChatMessages = async (chatId: number) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch(`/api/counselor/user/messages/${chatId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to load chat messages");
      const data = await response.json();
      console.log(`Counselor page - Messages for chat ${chatId}:`, data.messages);
      setChatMessages(data.messages || []);
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast.error("Failed to load chat messages");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    setIsSending(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch(`/api/counselor/user/message/${activeChat.id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          messageType: "text",
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      setNewMessage("");
      loadChatMessages(activeChat.id);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Handle chat selection from sidebar
  useEffect(() => {
    if (activeChat) {
      loadChatMessages(activeChat.id);
    }
  }, [activeChat]);

  const handleRequestSubmitted = () => {
    fetchRequests();
    fetchRequestLimit();
  };

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
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Navigation Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-col gap-1">
            <a
              href="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50`}
            >
              <MessageCircle size={16} />
              Chat
            </a>
            <a
              href="/impersonate"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50`}
            >
              <MessageCircle size={16} />
              Impersonate
            </a>
            <a
              href="/counselor"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-blue-50 text-blue-700 border border-blue-200`}
            >
              <User size={16} />
              Counselor
            </a>
          </div>
        </div>
        
        {/* Counselor Section */}
        <div className="border-t border-gray-200 flex-1 flex flex-col min-h-0">
          <CounselorSidebar
            onSelectChat={setActiveChat}
            onOpenRequestDialog={() => setCounselorRequestDialogOpen(true)}
            selectedChatId={activeChat?.id || null}
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        ) : !activeChat ? (
          <div className="flex flex-1 flex-col items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-700">
                Counselor Support
              </h2>
              <p className="text-gray-600">
                Connect with professional counselors for personalized support and guidance.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Getting Started:</strong> Use the sidebar to view your requests or click the + button to create a new counselor request.
                </p>
              </div>
              {requestLimit && (
                <div className="text-sm text-gray-600">
                  You have <span className="font-semibold text-blue-600">{requestLimit.remaining}</span> of {requestLimit.limit} requests remaining today.
                </div>
              )}
            </div>
          </div>
        ) : (
          <Card className="h-full flex flex-col m-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">Counselor Chat</CardTitle>
                    <CardDescription>
                      Session started: {formatTime(activeChat.startedAt)}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.senderType === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.senderType === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[40px] max-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    size="sm"
                    className="self-end"
                  >
                    {isSending ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Counselor Request Dialog */}
      <CounselorRequestDialog
        open={counselorRequestDialogOpen}
        onOpenChange={setCounselorRequestDialogOpen}
        onRequestSubmitted={handleRequestSubmitted}
        requestLimit={requestLimit || undefined}
      />
    </div>
  );
}

export default Route.options.component;