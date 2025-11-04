import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@clerk/clerk-react";
import {
  MessageCircle,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  Plus,
  Loader2,
} from "lucide-react";

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
  const [requests, setRequests] = useState<CounselorRequest[]>([]);
  const [activeChat, setActiveChat] = useState<CounselorChat | null>(null);
  const [chatMessages, setChatMessages] = useState<CounselorMessage[]>([]);
  const [requestLimit, setRequestLimit] = useState<RequestLimit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Form state
  const [requestReason, setRequestReason] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    fetchRequests();
    fetchRequestLimit();
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

  const submitRequest = async () => {
    if (!requestReason.trim()) {
      toast.error("Please provide a reason for your request");
      return;
    }

    if (requestReason.trim().length < 10) {
      toast.error("Request reason must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token available");
      
      const response = await fetch("/api/counselor/request", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestReason: requestReason.trim(),
          urgencyLevel,
          userContext: {
            requestedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      toast.success("Counselor request submitted successfully");
      setRequestReason("");
      setUrgencyLevel("medium");
      fetchRequests();
      fetchRequestLimit();
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
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

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "urgent": return "destructive";
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

  const selectChat = (request: CounselorRequest) => {
    // Create a mock chat object for active requests
    const chat: CounselorChat = {
      id: request.id, // Using request ID as chat ID for simplicity
      requestId: request.id,
      status: "active",
      startedAt: request.acceptedAt || request.requestedAt,
      messageCount: 0,
    };
    setActiveChat(chat);
    loadChatMessages(chat.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Counselor Support</h1>
          <p className="text-muted-foreground">Connect with professional counselors for support</p>
        </div>
        {requestLimit && (
          <div className="text-right">
            <Badge variant="outline" className="mb-2">
              {requestLimit.remaining} of {requestLimit.limit} requests remaining today
            </Badge>
            <p className="text-xs text-muted-foreground">
              Resets at {new Date(requestLimit.resetsAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      <Tabs defaultValue="request" className="space-y-4">
        <TabsList>
          <TabsTrigger value="request">Request Counselor</TabsTrigger>
          <TabsTrigger value="status">Request Status</TabsTrigger>
          <TabsTrigger value="chat">Active Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Counselor Support</CardTitle>
              <CardDescription>
                Submit a request to connect with a professional counselor. You have {requestLimit?.remaining || 0} requests remaining today.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency Level</Label>
                <Select value={urgencyLevel} onValueChange={(value: any) => setUrgencyLevel(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - General support</SelectItem>
                    <SelectItem value="medium">Medium - Need guidance</SelectItem>
                    <SelectItem value="high">High - Immediate support needed</SelectItem>
                    <SelectItem value="urgent">Urgent - Crisis situation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Request</Label>
                <Textarea
                  id="reason"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Please describe why you need counselor support..."
                  className="min-h-[120px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {requestReason.length}/500 characters
                </p>
              </div>

              <Button
                onClick={submitRequest}
                disabled={isSubmitting || !requestReason.trim() || (requestLimit?.remaining || 0) === 0}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>

              {(requestLimit?.remaining || 0) === 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  You've reached your daily request limit. Try again tomorrow.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No counselor requests yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">Request #{request.id}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {formatTime(request.requestedAt)}
                          <Badge variant={getUrgencyColor(request.urgencyLevel)}>
                            {request.urgencyLevel.toUpperCase()}
                          </Badge>
                          <Badge variant={getStatusColor(request.status)}>
                            {request.status.toUpperCase()}
                          </Badge>
                        </CardDescription>
                      </div>
                      {request.status === "accepted" && (
                        <Button
                          size="sm"
                          onClick={() => selectChat(request)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Open Chat
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-2">{request.requestReason}</p>
                    {request.acceptedAt && (
                      <p className="text-xs text-muted-foreground">
                        Accepted at: {formatTime(request.acceptedAt)}
                      </p>
                    )}
                    {request.completedAt && (
                      <p className="text-xs text-muted-foreground">
                        Completed at: {formatTime(request.completedAt)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          {!activeChat ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active chat session</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your counselor request must be accepted to start chatting
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
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
                      <CardTitle className="text-lg">Counselor</CardTitle>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}