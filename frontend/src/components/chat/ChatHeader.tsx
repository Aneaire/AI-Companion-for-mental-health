import { BrainCircuit } from "lucide-react";
import type { JSX } from "react";

export function ChatHeader(): JSX.Element {
  return (
    <header className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 shadow text-white rounded-t-sm">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20">
        <BrainCircuit size={32} className="text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">AI Companion</h1>
        <p className="text-sm opacity-80">
          You're chatting with your AI support companion
        </p>
      </div>
    </header>
  );
}

export default ChatHeader;
