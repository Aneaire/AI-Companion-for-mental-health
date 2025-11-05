import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Clock,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  User,
  Send,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface CounselorRequest {
  id: number;
  userId: number;
  status: "pending" | "accepted" | "completed" | "cancelled";
  requestReason: string;
  urgencyLevel: "low" | "medium" | "high";
  userContext?: any;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  adminNotes?: string;
  user?: {
    id: number;
    nickname?: string;
    firstName?: string;
    email: string;
  };
}

interface CounselorChat {
  id: number;
  requestId: number;
  userId: number;
  adminId: number;
  status: "active" | "ended" | "transferred";
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  sessionDuration?: number;
  transferReason?: string;
  adminSummary?: string;
  user?: {
    id: number;
    nickname?: string;
    firstName?: string;
    email: string;
  };
  messages?: CounselorMessage[];
}

interface CounselorMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderType: "user" | "admin";
  message: string;
  messageType: "text" | "system";
  isRead: boolean;
  timestamp: string;
}

export const Route = createFileRoute("/admin/counselor")({
  component: CounselorDashboard,
});

function CounselorDashboard() {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState<CounselorRequest[]>([]);
  const [chats, setChats] = useState<CounselorChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<CounselorChat | null>(null);
  const [chatMessages, setChatMessages] = useState<CounselorMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeView, setActiveView] = useState<"pending" | "current" | null>(null);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchChats();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = await getToken();
      console.log("Admin counselor - token:", token ? "found" : "not found");
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch("/api/counselor/admin/requests", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      console.log("Admin counselor - response status:", response.status);
      if (!response.ok) throw new Error(`Failed to fetch requests: ${response.status}`);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error(`Failed to load counselor requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChats = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch("/api/counselor/admin/chats", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch chats");
      const data = await response.json();
      setChats(data.chats || []);
    } catch (error) {
      console.error("Error fetching chats:", error);
      toast.error("Failed to load counselor chats");
    }
  };

  const acceptRequest = async (requestId: number) => {
    setIsAccepting(requestId);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch(`/api/counselor/admin/accept/${requestId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to accept request");
      
      toast.success("Request accepted successfully");
      fetchRequests();
      fetchChats();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept request");
    } finally {
      setIsAccepting(null);
    }
  };

  const loadChatMessages = async (chatId: number) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch(`/api/counselor/chat/${chatId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to load chat messages");
      const data = await response.json();
      setChatMessages(data.messages || []);
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast.error("Failed to load chat messages");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    setIsSending(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch(`/api/counselor/admin/message/${selectedChat.id}`, {
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
      loadChatMessages(selectedChat.id);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const endChat = async (chatId: number) => {
    try {
      const response = await fetch(`/api/counselor/admin/end/${chatId}`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to end chat");
      
      toast.success("Chat ended successfully");
      setSelectedChat(null);
      setChatMessages([]);
      fetchChats();
    } catch (error) {
      console.error("Error ending chat:", error);
      toast.error("Failed to end chat");
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "accepted": return "default";
      case "active": return "default";
      case "completed": return "secondary";
      case "ended": return "secondary";
      default: return "secondary";
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const selectChat = (chat: CounselorChat) => {
    setSelectedChat(chat);
    loadChatMessages(chat.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const toggleAccordion = () => {
    setIsAccordionOpen(!isAccordionOpen);
  };

  const selectView = (view: "pending" | "current") => {
    setActiveView(view);
    if (view === "pending") {
      setSelectedChat(null);
      setChatMessages([]);
    }
  };

  const sidebarContent = (
    <div className="space-y-4">
      {/* Accordion Button */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={toggleAccordion}
          className="w-full justify-between bg-white border-gray-200 hover:bg-gray-50"
        >
          <span className="font-medium">Counseling Options</span>
          {isAccordionOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        
        {/* Accordion Content */}
        {isAccordionOpen && (
          <div className="space-y-1 pl-2 border-l-2 border-gray-200 ml-2">
            <Button
              variant={activeView === "pending" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => selectView("pending")}
              className="w-full justify-start text-sm"
            >
              Pending Requests ({requests.filter(r => r.status === "pending").length})
            </Button>
            <Button
              variant={activeView === "current" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => selectView("current")}
              className="w-full justify-start text-sm"
            >
              Current Sessions ({chats.filter(c => c.status === "active").length})
            </Button>
          </div>
        )}
      </div>

      {/* Current Sessions Sidebar (similar to main page threads) */}
      {activeView === "current" && (
        <div className="space-y-2">
          <div className="px-2 py-1.5 bg-gray-50 rounded text-sm text-gray-600 flex justify-between">
            <span>Active Sessions</span>
            <span className="font-medium">{chats.filter(c => c.status === "active").length}</span>
          </div>
          <ScrollArea className="h-[350px]">
            {chats.filter(c => c.status === "active").length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                No active sessions
              </div>
            ) : (
              <div className="space-y-1">
                {chats
                  .filter(c => c.status === "active")
                  .map((chat) => (
                    <div
                      key={chat.id}
                      className={`cursor-pointer transition-all duration-200 rounded px-2 py-2 ${
                        selectedChat?.id === chat.id 
                          ? "bg-blue-50 border border-blue-200" 
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => selectChat(chat)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-2 w-2 text-green-600" />
                          </div>
                          <span className="text-sm font-medium truncate">
                            {chat.user?.nickname || chat.user?.firstName || "Anonymous User"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant="outline" className="text-sm px-1 py-0 h-5">
                            {chat.messageCount}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {new Date(chat.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Stats Summary */}
      <div className="p-3 bg-red-50 rounded-lg">
        <h4 className="font-medium text-red-900 mb-2">Counseling Stats</h4>
        <div className="space-y-2 text-xs text-red-700">
          <div className="flex justify-between">
            <span>Pending Requests:</span>
            <span className="font-medium">{requests.filter(r => r.status === "pending").length}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Sessions:</span>
            <span className="font-medium">{chats.filter(c => c.status === "active").length}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Counselor Dashboard</h1>
          <p className="text-muted-foreground">Manage counseling requests and active sessions</p>
        </div>

        {/* Pending Requests View */}
        {activeView === "pending" && (
          <div className="space-y-4">
            {requests.filter(r => r.status === "pending").length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {requests
                  .filter(r => r.status === "pending")
                  .map((request) => (
                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-lg">
                                {request.user?.nickname || request.user?.firstName || "Anonymous User"}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {formatTime(request.requestedAt)}
                                <Badge variant={getUrgencyColor(request.urgencyLevel)}>
                                  {request.urgencyLevel.toUpperCase()}
                                </Badge>
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            onClick={() => acceptRequest(request.id)}
                            disabled={isAccepting === request.id}
                            size="sm"
                          >
                            {isAccepting === request.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Accepting...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Accept
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Reason:</strong> {request.requestReason}
                        </p>
                        {request.userContext && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer">View Context</summary>
                            <pre className="mt-2 p-2 bg-muted rounded">
                              {JSON.stringify(request.userContext, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Current Sessions View */}
        {activeView === "current" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {selectedChat ? (
                <Card className="h-[600px] flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">
                            {selectedChat.user?.nickname || selectedChat.user?.firstName || "Anonymous User"}
                          </CardTitle>
                          <CardDescription>
                            Session started: {formatTime(selectedChat.startedAt)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => endChat(selectedChat.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          End Session
                        </Button>
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
                              message.senderType === "admin" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                message.senderType === "admin"
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-[600px]">
                  <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Select a session from the sidebar to start chatting</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Default View - No Selection */}
        {!activeView && (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Counselor Dashboard</h3>
                <p className="text-muted-foreground">Select an option from the sidebar to get started</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}