import { 
  databases, 
  client,
  DATABASE_ID, 
  COUNSELOR_REQUESTS_COLLECTION, 
  COUNSELOR_CHATS_COLLECTION, 
  COUNSELOR_MESSAGES_COLLECTION,
  ID,
  Query 
} from '@/lib/appwrite';
import type { CounselorRequest, CounselorChat, CounselorMessage } from '@/lib/appwriteSchema';

// Admin-specific counselor management functions

// Get all counselor requests (for admin dashboard)
export const getAllCounselorRequests = async (status?: string, page = 1, limit = 20) => {
  try {
    let queries = [];
    
    if (status) {
      queries.push(Query.equal('status', status));
    }
    
    // Add pagination
    const offset = (page - 1) * limit;
    queries.push(Query.limit(limit));
    queries.push(Query.offset(offset));
    
    const requests = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      queries.length > 0 ? queries : undefined
    );
    
    // Get total count for pagination
    const totalCount = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      status ? [Query.equal('status', status)] : undefined
    );
    
    return {
      documents: requests.documents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount.total / limit),
        totalRequests: totalCount.total,
        hasNext: page * limit < totalCount.total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error('Error fetching all counselor requests:', error);
    throw error;
  }
};

// Accept a counselor request and create chat
export const acceptCounselorRequest = async (requestId: string, adminId: string, adminNotes?: string) => {
  try {
    // Update the request status
    const updatedRequest = await databases.updateDocument(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      requestId,
      {
        status: 'accepted',
        adminId,
        adminNotes,
        acceptedAt: new Date().toISOString(),
      }
    );
    
    // Create a new chat session
    const request = updatedRequest as any;
    const chat = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      ID.unique(),
      {
        requestId: request.$id,
        userId: request.userId,
        adminId,
        status: 'active',
        startedAt: new Date().toISOString(),
        messageCount: 0,
      }
    );
    
    return { request: updatedRequest, chat };
  } catch (error) {
    console.error('Error accepting counselor request:', error);
    throw error;
  }
};

// Get all active counselor chats (for admin dashboard)
export const getAllCounselorChats = async (adminId?: string) => {
  try {
    let queries = [Query.equal('status', 'active')];
    
    if (adminId) {
      queries.push(Query.equal('adminId', adminId));
    }
    
    const chats = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      queries
    );
    
    return chats;
  } catch (error) {
    console.error('Error fetching all counselor chats:', error);
    throw error;
  }
};

// Get counselor chat with messages
export const getCounselorChatWithMessages = async (chatId: string) => {
  try {
    // Get chat details
    const chat = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      [Query.equal('$id', chatId)]
    );
    
    // Get messages for this chat
    const messages = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      [Query.equal('chatId', chatId)]
    );
    
    return {
      chat: chat.documents[0],
      messages: messages.documents,
    };
  } catch (error) {
    console.error('Error fetching counselor chat with messages:', error);
    throw error;
  }
};

// Send admin message
export const sendAdminMessage = async (chatId: string, adminId: string, message: string) => {
  try {
    const newMessage = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      ID.unique(),
      {
        chatId,
        senderId: adminId,
        senderType: 'counselor',
        message,
        messageType: 'text',
        timestamp: new Date().toISOString(),
        isRead: false,
      }
    );
    
    // Update message count in chat
    await databases.updateDocument(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      chatId,
      {
        messageCount: (await getChatMessageCount(chatId)) + 1,
      }
    );
    
    return newMessage;
  } catch (error) {
    console.error('Error sending admin message:', error);
    throw error;
  }
};

// End counselor chat
export const endCounselorChat = async (chatId: string, adminSummary?: string) => {
  try {
    const updatedChat = await databases.updateDocument(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      chatId,
      {
        status: 'ended',
        endedAt: new Date().toISOString(),
        adminSummary,
      }
    );
    
    return updatedChat;
  } catch (error) {
    console.error('Error ending counselor chat:', error);
    throw error;
  }
};

// Complete counselor request
export const completeCounselorRequest = async (requestId: string, satisfactionRating?: number) => {
  try {
    const updatedRequest = await databases.updateDocument(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      requestId,
      {
        status: 'completed',
        completedAt: new Date().toISOString(),
        satisfactionRating,
      }
    );
    
    return updatedRequest;
  } catch (error) {
    console.error('Error completing counselor request:', error);
    throw error;
  }
};

// Helper function to get message count for a chat
const getChatMessageCount = async (chatId: string): Promise<number> => {
  try {
    const messages = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      [Query.equal('chatId', chatId)]
    );
    return messages.documents.length;
  } catch (error) {
    console.error('Error getting message count:', error);
    return 0;
  }
};

// Real-time subscriptions for admin
export const subscribeToNewRequests = (callback: (request: any) => void) => {
  return client.subscribe(
    `databases.${DATABASE_ID}.collections.${COUNSELOR_REQUESTS_COLLECTION}.documents`,
    (response: any) => {
      if (response.payload.status === 'pending') {
        callback(response.payload);
      }
    }
  );
};

export const subscribeToChatMessages = (chatId: string, callback: (message: any) => void) => {
  return client.subscribe(
    `databases.${DATABASE_ID}.collections.${COUNSELOR_MESSAGES_COLLECTION}.documents`,
    (response: any) => {
      if (response.payload.chatId === chatId) {
        callback(response.payload);
      }
    }
  );
};