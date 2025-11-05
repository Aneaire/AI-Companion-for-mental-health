import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Clock,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  User,
  Phone,
  Send,
  X,
  Eye,
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Counselor Dashboard</h1>
          <p className="text-muted-foreground">Manage counseling requests and active sessions</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {requests.filter(r => r.status === "pending").length} Pending
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {chats.filter(c => c.status === "active").length} Active
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Requests</TabsTrigger>
          <TabsTrigger value="current">Current Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="current" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-lg font-semibold">Active Sessions</h3>
              {chats.filter(c => c.status === "active").length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">No active sessions</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {chats
                    .filter(c => c.status === "active")
                    .map((chat) => (
                      <Card
                        key={chat.id}
                        className={`cursor-pointer transition-colors ${
                          selectedChat?.id === chat.id ? "ring-2 ring-primary" : "hover:bg-muted/50"
                        }`}
                        onClick={() => selectChat(chat)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {chat.user?.nickname || chat.user?.firstName || "Anonymous User"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Started: {formatTime(chat.startedAt)}
                              </p>
                              <Badge variant="outline" className="mt-1">
                                {chat.messageCount} messages
                              </Badge>
                            </div>
                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>

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
                      <p className="text-muted-foreground">Select a session to start chatting</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}