import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import type { CounselorRequest, CounselorChat, CounselorMessage, ActiveView } from "@/types/counselor";
import {
  getAllCounselorRequests,
  getAllCounselorChats,
  getCounselorChatWithMessages,
  acceptCounselorRequest,
  sendAdminMessage,
  endCounselorChat,
  subscribeToNewRequests,
  subscribeToChatMessages,
} from "@/services/appwriteAdminService";

export function useCounselorChat() {
  const { getToken, userId } = useAuth();
  const [requests, setRequests] = useState<CounselorRequest[]>([]);
  const [chats, setChats] = useState<CounselorChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<CounselorChat | null>(null);
  const [chatMessages, setChatMessages] = useState<CounselorMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("current");

  // Fetch initial data
  useEffect(() => {
    fetchRequests();
    fetchChats();
    
    // Set up real-time subscription for new requests
    const unsubscribeRequests = subscribeToNewRequests((newRequest) => {
      setRequests(prev => [newRequest, ...prev]);
      toast.info("New counselor request received");
    });
    
    return () => {
      unsubscribeRequests();
    };
  }, []);

  // Set up real-time subscription for chat messages when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      const unsubscribeMessages = subscribeToChatMessages(selectedChat.$id, (newMessage) => {
        setChatMessages(prev => [...prev, newMessage]);
      });

      return () => {
        unsubscribeMessages();
      };
    }
  }, [selectedChat]);

  const fetchRequests = useCallback(async () => {
    try {
      if (!userId) throw new Error("No user ID available");
      
      const data = await getAllCounselorRequests("pending");
      console.log("Admin counselor - Admin requests:", data.documents);
      setRequests(data.documents as any || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error(`Failed to load counselor requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const fetchChats = useCallback(async () => {
    try {
      if (!userId) throw new Error("No user ID available");
      
      const data = await getAllCounselorChats(userId);
      console.log("Admin counselor - Admin chats:", data.documents);
      setChats(data.documents as any || []);
    } catch (error) {
      console.error("Error fetching chats:", error);
      toast.error("Failed to load counselor chats");
    }
  }, [userId]);

  const acceptRequest = useCallback(async (requestId: string) => {
    setIsAccepting(requestId);
    try {
      if (!userId) throw new Error("No user ID available");
      
      await acceptCounselorRequest(requestId, userId);
      
      toast.success("Request accepted successfully");
      fetchRequests();
      fetchChats();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept request");
    } finally {
      setIsAccepting(null);
    }
  }, [userId, fetchRequests, fetchChats]);

  const loadChatMessages = useCallback(async (chatId: string) => {
    try {
      const data = await getCounselorChatWithMessages(chatId);
      console.log(`Admin counselor - Messages for chat ${chatId}:`, data.messages);
      console.log(`Admin counselor - Current admin userId:`, userId);
      // Debug: Log senderType for each message
      data.messages?.forEach((msg: any, index: number) => {
        console.log(`Message ${index}:`, {
          senderId: msg.senderId,
          senderType: msg.senderType,
          isAdmin: msg.senderId === userId,
          message: msg.message.substring(0, 50) + '...'
        });
      });
      setChatMessages(data.messages as any || []);
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast.error("Failed to load chat messages");
    }
  }, [userId]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedChat) return;

    setIsSending(true);
    try {
      if (!userId) throw new Error("No user ID available");
      
      await sendAdminMessage(selectedChat.$id, userId, newMessage.trim());

      setNewMessage("");
      loadChatMessages(selectedChat.$id);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedChat, userId, loadChatMessages]);

  const selectChat = useCallback((chat: CounselorChat) => {
    setSelectedChat(chat);
    loadChatMessages(chat.$id);
  }, [loadChatMessages]);

  const endChat = useCallback(async (chatId: string) => {
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
  }, [fetchChats]);

  const selectView = useCallback((view: "pending" | "current") => {
    setActiveView(view);
    if (view === "pending") {
      setSelectedChat(null);
      setChatMessages([]);
    }
  }, []);

  return {
    // State
    requests,
    chats,
    selectedChat,
    chatMessages,
    newMessage,
    isLoading,
    isAccepting,
    isSending,
    activeView,
    
    // Actions
    setNewMessage,
    setActiveView,
    selectChat,
    acceptRequest,
    sendMessage,
    endChat,
    selectView,
  };
}