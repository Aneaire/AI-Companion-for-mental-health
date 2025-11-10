export interface CounselorRequest {
  $id: string;
  userId: string;
  status: "pending" | "accepted" | "completed" | "cancelled";
  requestReason: string;
  urgencyLevel: "low" | "medium" | "high";
  userContext?: any;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  adminNotes?: string;
  user?: {
    id: string;
    nickname?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    profileImageUrl?: string;
  };
}

export interface CounselorChat {
  $id: string;
  requestId: string;
  userId: string;
  adminId: string;
  status: "active" | "ended" | "transferred";
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  sessionDuration?: number;
  transferReason?: string;
  adminSummary?: string;
  user?: {
    id: string;
    nickname?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    profileImageUrl?: string;
  };
  messages?: CounselorMessage[];
}

export interface CounselorMessage {
  $id: string;
  chatId: string;
  senderId: string;
  senderType: "user" | "admin" | "counselor";
  message: string;
  messageType: "text" | "system";
  isRead: boolean;
  timestamp: string;
}

export type ActiveView = "pending" | "current" | null;