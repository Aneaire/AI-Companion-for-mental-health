// Appwrite database schema for counselor conversations
// This file defines the structure for Appwrite collections

export interface User {
  id: number;
  clerkId: string;
  email: string;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  status: string | null;
  role?: string; // User role (admin, user, etc.)
  hobby: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  threadCount: number;
}

export interface CounselorRequest {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string; // Clerk user ID
  adminId?: string; // Admin user ID
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  requestReason: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  userContext?: string; // Additional context from current session (JSON string)
  requestedAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  adminNotes?: string;
  satisfactionRating?: number; // 1-5 rating from user
}

export interface CounselorChat {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  requestId: string; // Reference to counselor request
  userId: string; // Clerk user ID
  adminId: string; // Admin user ID
  status: 'active' | 'ended' | 'transferred';
  startedAt?: string;
  endedAt?: string;
  messageCount?: number;
  sessionDuration?: number; // in minutes
  transferReason?: string;
  adminSummary?: string;
}

export interface CounselorMessage {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  chatId: string; // Reference to counselor chat
  senderId: string; // Clerk user ID
  senderType: 'user' | 'counselor';
  message: string;
  messageType: 'text' | 'system' | 'file';
  isRead?: boolean;
  timestamp?: string;
}

// Collection attributes for Appwrite setup
export const COLLECTION_ATTRIBUTES = {
  counselor_requests: [
    { name: 'userId', type: 'string', size: 255, required: true },
    { name: 'adminId', type: 'string', size: 255, required: false },
    { name: 'status', type: 'string', size: 20, required: true, default: 'pending' },
    { name: 'requestReason', type: 'string', size: 2000, required: true },
    { name: 'urgencyLevel', type: 'string', size: 10, required: true, default: 'medium' },
    { name: 'userContext', type: 'string', size: 5000, required: false },
    { name: 'requestedAt', type: 'datetime', required: false },
    { name: 'acceptedAt', type: 'datetime', required: false },
    { name: 'completedAt', type: 'datetime', required: false },
    { name: 'adminNotes', type: 'string', size: 2000, required: false },
    { name: 'satisfactionRating', type: 'integer', required: false },
  ],
  counselor_chats: [
    { name: 'requestId', type: 'string', size: 255, required: true },
    { name: 'userId', type: 'string', size: 255, required: true },
    { name: 'adminId', type: 'string', size: 255, required: true },
    { name: 'status', type: 'string', size: 20, required: true, default: 'active' },
    { name: 'startedAt', type: 'datetime', required: false },
    { name: 'endedAt', type: 'datetime', required: false },
    { name: 'messageCount', type: 'integer', required: false, default: 0 },
    { name: 'sessionDuration', type: 'integer', required: false },
    { name: 'transferReason', type: 'string', size: 1000, required: false },
    { name: 'adminSummary', type: 'string', size: 3000, required: false },
  ],
  counselor_messages: [
    { name: 'chatId', type: 'string', size: 255, required: true },
    { name: 'senderId', type: 'string', size: 255, required: true },
    { name: 'senderType', type: 'string', size: 20, required: true },
    { name: 'message', type: 'string', size: 5000, required: true },
    { name: 'messageType', type: 'string', size: 20, required: true, default: 'text' },
    { name: 'isRead', type: 'boolean', required: false, default: false },
    { name: 'timestamp', type: 'datetime', required: false },
  ],
};