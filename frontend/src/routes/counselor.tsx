import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";
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
import { formatRelativeTime } from "@/lib/utils";

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
  counselor?: {
    profileImageUrl?: string;
    firstName?: string;
    lastName?: string;
  };
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
  const { user } = useUser();
  const { conversationPreferences, setConversationPreferences } = useChatStore();
  const [requests, setRequests] = useState<AppwriteCounselorRequest[]>([]);
  const [activeChat, setActiveChat] = useState<AppwriteCounselorChat | null>(null);
  const [chatMessages, setChatMessages] = useState<AppwriteCounselorMessage[]>([]);
  const [requestLimit, setRequestLimit] = useState<RequestLimit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Auto-scroll refs and state
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Counselor dialog state
  const [counselorRequestDialogOpen, setCounselorRequestDialogOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchRequestLimit();
    
    // Set up real-time subscription for request updates
    if (user?.id) {
      const unsubscribe = subscribeToCounselorRequests(user.id, (updatedRequest: any) => {
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
  }, [user?.id]);

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
      if (!user?.id) throw new Error("No user ID available");
      
      const data = await getCounselorRequests(user.id);
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
      if (!user?.id) throw new Error("No user ID available");

      await createCounselorMessage({
        chatId: activeChat.$id,
        senderId: user.id,
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
    return formatRelativeTime(timestamp);
  };

  // Handle scroll events to track if user is at bottom
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50; // 50px threshold
    setIsScrolledToBottom(isAtBottom);
  };

  // Auto-scroll to bottom if user was already scrolled to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current && isScrolledToBottom) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  // Initial scroll to bottom when messages are loaded
  const scrollToBottomInitial = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setIsScrolledToBottom(true); // Mark as at bottom after initial scroll
      }
    }
  };

  // Handle chat selection from sidebar
  useEffect(() => {
    if (activeChat) {
      setIsInitialLoad(true); // Reset for new chat
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

  // Auto-scroll when messages change
  useEffect(() => {
    if (chatMessages.length > 0) {
      if (isInitialLoad) {
        // Initial load - always scroll to bottom
        setTimeout(() => {
          scrollToBottomInitial();
          setIsInitialLoad(false);
        }, 100);
      } else {
        // Subsequent messages - only scroll if user was at bottom
        scrollToBottom();
      }
    }
  }, [chatMessages]);

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
      
      {/* Sidebar - Hidden on mobile, overlay when open */}
       <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full md:relative md:translate-x-0 ${
         isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
       }`}>
        {/* Navigation Section - Sticky on mobile */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-3 md:relative md:z-auto">
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CounselorSidebar
          onSelectChat={(chat) => setActiveChat(chat as unknown as AppwriteCounselorChat)}
          onOpenRequestDialog={() => setCounselorRequestDialogOpen(true)}
          selectedChatId={activeChat?.$id || null}
        />
        </div>
      </div>

      {/* Mobile Backdrop - Only covers area behind sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-y-0 left-64 right-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-30 md:ml-0">
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
            <div className="flex flex-col h-full bg-gradient-to-br from-gray-50/50 via-white to-indigo-50/30 md:max-w-5xl md:mx-auto md:py-8 py-0 w-full max-w-full flex-1 relative">
             {/* Mobile Header */}
              <div className="md:hidden bg-white/90 backdrop-blur-sm border-b border-gray-200/60 px-3 py-2 sticky top-16 z-10">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-1.5"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                   <div>
                     <h2 className="text-base font-semibold text-gray-800">Counselor Chat</h2>
                     <p className="text-xs text-gray-600">
                       Session started: {formatTime(activeChat.startedAt || activeChat.$createdAt)}
                     </p>
                   </div>
                 </div>
<Avatar className="w-8 h-8 border-2 border-white shadow-sm">
                    <AvatarImage src={user?.imageUrl} alt={user?.firstName || "User"} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
               </div>
             </div>

             {/* Desktop Header with subtle shadow */}
             <div className="hidden md:block relative z-10">
                <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 rounded-t-2xl shadow-sm px-4 py-3">
                  <div className="flex items-center gap-2">
<Avatar className="w-8 h-8 border-2 border-white shadow-sm">
                      <AvatarImage src={user?.imageUrl} alt={user?.firstName || "User"} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-base font-semibold text-gray-800">Counselor Chat</h2>
                      <p className="text-xs text-gray-600">
                        Session started: {formatTime(activeChat.startedAt || activeChat.$createdAt)}
                      </p>
                    </div>
                 </div>
               </div>
             </div>
             
             {/* Main Content Area with enhanced styling */}
              <main className="flex-1 overflow-hidden md:pb-0 w-full flex h-full flex-col relative bg-white/60 backdrop-blur-sm md:rounded-b-2xl md:border-x md:border-b border-gray-200/60 md:shadow-lg">
                <ScrollArea
                  ref={scrollAreaRef}
                  className="flex-1 h-full min-h-0"
                  onScroll={handleScroll}
                >
                    <div className="px-2 md:px-3 pt-20 md:pt-4 pb-3 md:pb-4">
                   {chatMessages.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-3">
                          <MessageCircle size={24} className="text-blue-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-800 mb-2">
                          Start Your Counselor Conversation
                        </h3>
                        <p className="text-xs text-gray-600 max-w-md">
                          Send a message to begin your conversation with the counselor.
                        </p>
                     </div>
                   ) : (
                      <div className="space-y-2 sm:space-y-3">
                       {chatMessages.map((message, index) => {
                         const isUser = message.senderType === "user";
                         const isConsecutive = index > 0 && chatMessages[index - 1]?.senderType === message.senderType;
                         
                         return (
                            <div
                              key={message.$id}
                              className={`flex items-end gap-1.5 sm:gap-2 animate-in fade-in duration-300 ${
                                isUser ? "justify-end" : "justify-start"
                              } ${isConsecutive ? "mt-0.5" : "mt-1"}`}
                            >
{!isUser && (
                                  <div className="flex flex-col items-center">
                                   <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white shadow-sm rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                       <User size={10} className="text-white sm:w-3.5 sm:h-3.5" />
                                     </div>
                                  </div>
                                )}
                             
                               <div className={`max-w-[75%] sm:max-w-[70%] group relative ${isConsecutive ? "mt-0.5" : "mt-0"}`}>
                                <div
                                  className={`rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm transition-all duration-200 hover:shadow-md ${
                                    isUser
                                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                      : "bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-800"
                                  }`}
                                  role="article"
                                  aria-label={isUser ? "User message" : "Counselor message"}
                                >
                                  <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""} [&_p]:mb-1 sm:[&_p]:mb-1.5 [&_p:last-child]:mb-0`}>
                                    <p className="text-sm sm:text-base">{message.message}</p>
                                  </div>
                                  <p className={`text-xs mt-0.5 ${isUser ? "text-blue-100" : "text-gray-500"}`}>
                                    {formatTime(message.timestamp || message.$createdAt)}
                                  </p>
                                </div>
                              </div>
                             
{isUser && (
                                   <div className="flex flex-col items-center">
                                      <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white shadow-sm">
                                        <AvatarImage src={user?.imageUrl} alt={user?.firstName || "User"} />
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                          <User size={10} className="text-white sm:w-3.5 sm:h-3.5" />
                                        </AvatarFallback>
                                      </Avatar>
                                   </div>
                                 )}
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>
               </ScrollArea>
               
               {/* Enhanced Input Area */}
                <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200/50 p-3">
                 <div className="w-full mx-auto bg-white/50 backdrop-blur-sm">
                   <div className="relative">
                      <div className="flex items-end gap-1.5 p-1.5 sm:p-2 bg-white rounded-lg border border-gray-200 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200">
                       <Textarea
                         value={newMessage}
                         onChange={(e) => setNewMessage(e.target.value)}
                         placeholder="Type your message..."
                          className="flex-1 min-h-[32px] sm:min-h-[36px] max-h-20 sm:max-h-28 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm sm:text-base"
                         disabled={isSending}
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
                           className="shrink-0 h-8 sm:h-8 px-2 sm:px-2"
                       >
                         <div className="flex items-center">
                           {isSending ? (
                              <Loader2 size={12} className="mr-1 sm:w-3.5 sm:h-3.5 animate-spin" />
                           ) : (
                              <Send size={12} className="mr-1 sm:w-3.5 sm:h-3.5" />
                           )}
                            <span className="text-xs">{isSending ? "Sending..." : "Send"}</span>
                         </div>
                       </Button>
                     </div>
                   </div>
                   <div className="mt-2 text-xs text-gray-500 text-center px-2">
                     Press Enter to send, Shift+Enter for a new line
                   </div>
                 </div>
               </div>
             </main>
             
             {/* Subtle background pattern overlay */}
             <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
               <div
                 className="absolute inset-0"
                 style={{
                   backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.3) 1px, transparent 0)`,
                   backgroundSize: "20px 20px",
                 }}
               ></div>
             </div>
           </div>
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