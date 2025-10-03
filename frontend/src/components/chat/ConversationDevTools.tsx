import { useState } from "react";
import { Download, Eye, EyeOff, Trash2, FileText } from "lucide-react";
import { conversationLogger, type ConversationLog } from "@/lib/conversationLogger";
import { useChatStore } from "@/stores/chatStore";

interface ConversationDevToolsProps {
  threadId: number | null;
  personaName?: string;
}

export function ConversationDevTools({ threadId, personaName }: ConversationDevToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { currentContext } = useChatStore();

  const handleLogConversation = () => {
    if (!threadId) return;
    
    conversationLogger.logConversation(threadId, currentContext.messages, personaName);
    console.log(`[DEV TOOLS] Logged conversation for thread ${threadId}`);
  };

  const handleDownloadConversation = () => {
    if (!threadId) return;
    
    conversationLogger.downloadConversation(threadId);
  };

  const handlePreviewConversation = () => {
    if (!threadId) return;
    
    const log = conversationLogger.getConversation(threadId);
    if (!log) {
      // Log current conversation if not already logged
      handleLogConversation();
    }
    setShowPreview(!showPreview);
  };

  const getConversationPreview = () => {
    if (!threadId) return "";
    
    const log = conversationLogger.getConversation(threadId);
    if (!log) {
      // Return current conversation preview
      const therapistMessages = currentContext.messages.filter(msg => msg.sender === "ai");
      const impostorMessages = currentContext.messages.filter(msg => msg.sender === "impostor");
      
      let preview = `Current Conversation - Thread ${threadId}\n`;
      preview += `${'='.repeat(80)}\n\n`;
      
      const maxTurns = Math.max(therapistMessages.length, impostorMessages.length);
      
      for (let i = 0; i < Math.min(maxTurns, 3); i++) { // Show only first 3 turns
        const therapistMsg = therapistMessages[i];
        const impostorMsg = impostorMessages[i];

        preview += `Turn ${i + 1}:\n`;
        preview += `${'─'.repeat(40)}\n`;
        
        preview += `THERAPIST:\n`;
        preview += therapistMsg ? `${therapistMsg.text.substring(0, 100)}${therapistMsg.text.length > 100 ? '...' : ''}\n` : "[No response]\n";
        preview += `\n`;
        
        preview += `IMPOSTOR:\n`;
        preview += impostorMsg ? `${impostorMsg.text.substring(0, 100)}${impostorMsg.text.length > 100 ? '...' : ''}\n` : "[No response]\n";
        preview += `\n${'─'.repeat(80)}\n\n`;
      }
      
      if (maxTurns > 3) {
        preview += `... and ${maxTurns - 3} more turns\n`;
      }
      
      return preview;
    }
    
    return conversationLogger.formatConversationForExport(log);
  };

  if (!threadId) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg shadow-lg transition-colors"
        title="Conversation Dev Tools"
      >
        <FileText size={20} />
      </button>

      {/* Dev Tools Panel */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Conversation Tools</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            {/* Thread Info */}
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <div>Thread: {threadId}</div>
              {personaName && <div>Persona: {personaName}</div>}
              <div>Messages: {currentContext.messages.length}</div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleLogConversation}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
              >
                <FileText size={14} />
                Log
              </button>
              
              <button
                onClick={handleDownloadConversation}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
              >
                <Download size={14} />
                Download
              </button>
              
              <button
                onClick={handlePreviewConversation}
                className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPreview ? 'Hide' : 'Preview'}
              </button>
              
              <button
                onClick={() => {
                  if (confirm('Clear all conversation logs?')) {
                    localStorage.removeItem('conversation-logs');
                    console.log('[DEV TOOLS] Cleared all conversation logs');
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="border border-gray-200 rounded p-3 bg-gray-50">
                <h4 className="font-medium text-gray-700 mb-2">Conversation Preview:</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                  {getConversationPreview()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}