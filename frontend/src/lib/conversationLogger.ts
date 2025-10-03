import type { Message } from "@/types/chat";

export interface ConversationLog {
  threadId: number;
  timestamp: string;
  personaName?: string;
  messages: Message[];
}

export interface ConversationExport {
  threadId: number;
  timestamp: string;
  personaName?: string;
  formattedConversation: string;
}

class ConversationLogger {
  private logs: Map<number, ConversationLog> = new Map();

  logConversation(threadId: number, messages: Message[], personaName?: string) {
    const log: ConversationLog = {
      threadId,
      timestamp: new Date().toISOString(),
      personaName,
      messages: [...messages] // Deep copy to avoid reference issues
    };

    this.logs.set(threadId, log);
    this.saveToFile(log);
  }

  private async saveToFile(log: ConversationLog) {
    try {
      // In a real implementation, this would save to the conversation/impersonate folder
      // For now, we'll store in localStorage for development
      const existingLogs = this.getLogsFromStorage();
      existingLogs[log.threadId] = log;
      
      localStorage.setItem('conversation-logs', JSON.stringify(existingLogs));
      console.log(`[CONVERSATION LOGGER] Saved conversation for thread ${log.threadId}`);
    } catch (error) {
      console.error('[CONVERSATION LOGGER] Failed to save conversation:', error);
    }
  }

  private getLogsFromStorage(): Record<number, ConversationLog> {
    try {
      const stored = localStorage.getItem('conversation-logs');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  getConversation(threadId: number): ConversationLog | null {
    return this.logs.get(threadId) || null;
  }

  getAllConversations(): ConversationLog[] {
    return Array.from(this.logs.values());
  }

  formatConversationForExport(log: ConversationLog): string {
    const therapistMessages = log.messages.filter(msg => msg.sender === "ai");
    const impostorMessages = log.messages.filter(msg => msg.sender === "impostor");
    
    let formatted = `Conversation Log - Thread ${log.threadId}\n`;
    formatted += `Timestamp: ${new Date(log.timestamp).toLocaleString()}\n`;
    if (log.personaName) {
      formatted += `Persona: ${log.personaName}\n`;
    }
    formatted += `\n${'='.repeat(80)}\n\n`;

    // Create side-by-side format
    const maxTurns = Math.max(therapistMessages.length, impostorMessages.length);
    
    for (let i = 0; i < maxTurns; i++) {
      const therapistMsg = therapistMessages[i];
      const impostorMsg = impostorMessages[i];

      formatted += `Turn ${i + 1}:\n`;
      formatted += `${'─'.repeat(40)}\n`;
      
      // Therapist (left side)
      formatted += `THERAPIST:\n`;
      if (therapistMsg) {
        formatted += `${therapistMsg.text}\n`;
      } else {
        formatted += "[No response]\n";
      }
      
      formatted += `\n`;
      
      // Impostor (right side)
      formatted += `IMPOSTOR:\n`;
      if (impostorMsg) {
        formatted += `${impostorMsg.text}\n`;
      } else {
        formatted += "[No response]\n";
      }
      
      formatted += `\n${'─'.repeat(80)}\n\n`;
    }

    return formatted;
  }

  downloadConversation(threadId: number) {
    const log = this.getConversation(threadId);
    if (!log) {
      console.error(`[CONVERSATION LOGGER] No conversation found for thread ${threadId}`);
      return;
    }

    const formatted = this.formatConversationForExport(log);
    const blob = new Blob([formatted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-thread-${threadId}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log(`[CONVERSATION LOGGER] Downloaded conversation for thread ${threadId}`);
  }

  loadFromStorage() {
    const logs = this.getLogsFromStorage();
    Object.entries(logs).forEach(([threadId, log]) => {
      this.logs.set(parseInt(threadId), log);
    });
  }
}

export const conversationLogger = new ConversationLogger();