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
import { 
  getCounselorRequests, 
  getCounselorChats, 
  getCounselorMessages, 
  createCounselorMessage,
  subscribeToChatMessages,
  subscribeToCounselorRequests
} from "@/services/appwriteService";
import type { CounselorRequest, CounselorChat, CounselorMessage } from "@/lib/appwriteSchema";

// Extended interfaces to include Appwrite document properties
interface AppwriteCounselorRequest extends CounselorRequest {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
}

interface AppwriteCounselorChat extends CounselorChat {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
}

interface AppwriteCounselorMessage extends CounselorMessage {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
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
  const { getToken, userId } = useAuth();
  const { conversationPreferences, setConversationPreferences } = useChatStore();
  const [requests, setRequests] = useState<AppwriteCounselorRequest[]>([]);
  const [activeChat, setActiveChat] = useState<AppwriteCounselorChat | null>(null);
  const [chatMessages, setChatMessages] = useState<AppwriteCounselorMessage[]>([]);
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
    
    // Set up real-time subscription for request updates
    if (userId) {
      const unsubscribe = subscribeToCounselorRequests(userId, (updatedRequest: any) => {
        setRequests(prev => {
          const index = prev.findIndex(req => req.$id === updatedRequest.$id);
          if (index !== -1) {
            const newRequests = [...prev];
            newRequests[index] = updatedRequest as AppwriteCounselorRequest;
            return newRequests;
          } else {
            return [...prev, updatedRequest as AppwriteCounselorRequest];
          }
        });
      });
      
      return () => {
        unsubscribe();
      };
    }
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
      if (!userId) throw new Error("No user ID available");
      
      const data = await getCounselorRequests(userId);
      console.log("Counselor page - User requests:", data.documents);
      setRequests(data.documents as unknown as AppwriteCounselorRequest[] || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load counselor requests");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRequestLimit = async () => {
    // TODO: Implement request limit logic with Appwrite
    // For now, set a default limit
    setRequestLimit({
      limit: 5,
      used: 0,
      remaining: 5,
      resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      const data = await getCounselorMessages(chatId);
      console.log(`Counselor page - Messages for chat ${chatId}:`, data.documents);
      setChatMessages(data.documents as unknown as AppwriteCounselorMessage[] || []);
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast.error("Failed to load chat messages");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    setIsSending(true);
    try {
      if (!userId) throw new Error("No user ID available");

      await createCounselorMessage({
        chatId: activeChat.$id,
        senderId: userId,
        senderType: "user",
        message: newMessage.trim(),
        messageType: "text",
      });

      setNewMessage("");
      loadChatMessages(activeChat.$id);
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
      loadChatMessages(activeChat.$id);
      
      // Set up real-time subscription for new messages
      const unsubscribe = subscribeToChatMessages(activeChat.$id, (newMessage) => {
        setChatMessages(prev => [...prev, newMessage as AppwriteCounselorMessage]);
      });
      
      return () => {
        unsubscribe();
      };
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
          onSelectChat={(chat) => setActiveChat(chat as unknown as AppwriteCounselorChat)}
          onOpenRequestDialog={() => setCounselorRequestDialogOpen(true)}
          selectedChatId={activeChat?.$id || null}
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
                      Session started: {formatTime(activeChat.startedAt || activeChat.$createdAt)}
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
                      key={message.$id}
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
                          {formatTime(message.timestamp || message.$createdAt)}
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