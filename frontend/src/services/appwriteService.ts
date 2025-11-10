import {
  databases,
  DATABASE_ID,
  COUNSELOR_REQUESTS_COLLECTION,
  COUNSELOR_CHATS_COLLECTION,
  COUNSELOR_MESSAGES_COLLECTION,
  ID,
  Query
} from '@/lib/appwrite';
import type { CounselorRequest, CounselorChat, CounselorMessage } from '@/lib/appwriteSchema';

// Counselor Requests
export const createCounselorRequest = async (data: Omit<CounselorRequest, '$id' | '$createdAt' | '$updatedAt'>) => {
  try {
    const request = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      ID.unique(),
      {
        ...data,
        requestedAt: new Date().toISOString(),
      }
    );
    return request;
  } catch (error) {
    console.error('Error creating counselor request:', error);
    throw error;
  }
};

export const getCounselorRequests = async (userId?: string, status?: string) => {
  try {
    let queries = [];

    if (userId) {
      queries.push(Query.equal('userId', userId));
    }

    if (status) {
      queries.push(Query.equal('status', status));
    }

    const requests = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      queries.length > 0 ? queries : undefined
    );

    // Fetch user data for each request
    const requestsWithUsers = await Promise.all(
      requests.documents.map(async (request: any) => {
        try {
          const response = await fetch(`/api/user/profile/${request.userId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.status}`);
          }
          const user = await response.json();
          return {
            ...request,
            user: {
              id: user.id,
              nickname: user.nickname,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              profileImageUrl: user.profileImageUrl,
            },
          };
        } catch (error) {
          console.warn(`Could not fetch user data for request ${request.$id}:`, error);
          return request;
        }
      })
    );

    return {
      ...requests,
      documents: requestsWithUsers,
    };
  } catch (error) {
    console.error('Error fetching counselor requests:', error);
    throw error;
  }
};

export const updateCounselorRequest = async (requestId: string, data: Partial<CounselorRequest>) => {
  try {
    const request = await databases.updateDocument(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      requestId,
      data
    );
    return request;
  } catch (error) {
    console.error('Error updating counselor request:', error);
    throw error;
  }
};

// Counselor Chats
export const createCounselorChat = async (data: Omit<CounselorChat, '$id' | '$createdAt' | '$updatedAt'>) => {
  try {
    const chat = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      ID.unique(),
      {
        ...data,
        startedAt: new Date().toISOString(),
        messageCount: 0,
      }
    );
    return chat;
  } catch (error) {
    console.error('Error creating counselor chat:', error);
    throw error;
  }
};

export const getCounselorChats = async (userId?: string, adminId?: string, status?: string) => {
  try {
    let queries = [];

    if (userId) {
      queries.push(Query.equal('userId', userId));
    }

    if (adminId) {
      queries.push(Query.equal('adminId', adminId));
    }

    if (status) {
      queries.push(Query.equal('status', status));
    }

    const chats = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      queries.length > 0 ? queries : undefined
    );

    // Fetch user data for each chat
    const chatsWithUsers = await Promise.all(
      chats.documents.map(async (chat: any) => {
        try {
          const response = await fetch(`/api/user/profile/${chat.userId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.status}`);
          }
          const user = await response.json();
          return {
            ...chat,
            user: {
              id: user.id,
              nickname: user.nickname,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              profileImageUrl: user.profileImageUrl,
            },
          };
        } catch (error) {
          console.warn(`Could not fetch user data for chat ${chat.$id}:`, error);
          return chat;
        }
      })
    );

    return {
      ...chats,
      documents: chatsWithUsers,
    };
  } catch (error) {
    console.error('Error fetching counselor chats:', error);
    throw error;
  }
};

export const updateCounselorChat = async (chatId: string, data: Partial<CounselorChat>) => {
  try {
    const chat = await databases.updateDocument(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      chatId,
      data
    );
    return chat;
  } catch (error) {
    console.error('Error updating counselor chat:', error);
    throw error;
  }
};

// Counselor Messages
export const createCounselorMessage = async (data: Omit<CounselorMessage, '$id' | '$createdAt' | '$updatedAt'>) => {
  try {
    const message = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      ID.unique(),
      {
        ...data,
        timestamp: new Date().toISOString(),
        isRead: false,
      }
    );
    
    // Update message count in chat
    await updateCounselorChat(data.chatId, {
      messageCount: (await getChatMessageCount(data.chatId)) + 1
    });
    
    return message;
  } catch (error) {
    console.error('Error creating counselor message:', error);
    throw error;
  }
};

export const getCounselorMessages = async (chatId: string) => {
  try {
    const messages = await databases.listDocuments(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      [Query.equal('chatId', chatId)]
    );
    return messages;
  } catch (error) {
    console.error('Error fetching counselor messages:', error);
    throw error;
  }
};

export const markMessagesAsRead = async (chatId: string, senderId: string) => {
  try {
    const messages = await getCounselorMessages(chatId);
    const unreadMessages = messages.documents.filter(
      (msg: any) => msg.senderId !== senderId && !msg.isRead
    );
    
    for (const message of unreadMessages) {
      await databases.updateDocument(
        DATABASE_ID,
        COUNSELOR_MESSAGES_COLLECTION,
        message.$id,
        { isRead: true }
      );
    }
    
    return unreadMessages.length;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Helper function to get message count for a chat
const getChatMessageCount = async (chatId: string): Promise<number> => {
  try {
    const messages = await getCounselorMessages(chatId);
    return messages.documents.length;
  } catch (error) {
    console.error('Error getting message count:', error);
    return 0;
  }
};

// Real-time subscription setup (using client for subscriptions)
import { client } from '@/lib/appwrite';

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

export const subscribeToCounselorRequests = (userId: string, callback: (request: any) => void) => {
  return client.subscribe(
    `databases.${DATABASE_ID}.collections.${COUNSELOR_REQUESTS_COLLECTION}.documents`,
    (response: any) => {
      if (response.payload.userId === userId) {
        callback(response.payload);
      }
    }
  );
};