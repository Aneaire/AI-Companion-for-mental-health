import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JSX } from "react";
import ChatForm from "./ChatForm";

export function ChatDialog({
  open,
  onOpenChange,
  onSubmit,
  onThreadCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: any, aiResponse: string, sessionId: number) => void;
  onThreadCreated?: (session: any) => void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Ensure dialog is full screen or nearly full screen on small devices
        className="
          flex flex-col h-[100dvh] w-full max-w-none rounded-none p-0 gap-0
          sm:h-[95vh] sm:max-w-2xl sm:rounded-xl
          md:max-w-3xl lg:max-w-4xl xl:max-w-5xl
          overflow-y-auto
        "
      >
        <DialogHeader className="px-6 pt-6 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
          <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-700">
            Welcome to your AI Companion ✨
          </DialogTitle>
          <DialogDescription className="text-base sm:text-lg text-gray-600 mt-2 sm:mt-3 leading-relaxed">
            Please tell me a little about yourself so I can better support you.
          </DialogDescription>
        </DialogHeader>
        {/* ChatForm takes up the rest of the available height within the dialog */}
        <div className="flex-1 overflow-y-auto">
          <ChatForm onSubmit={onSubmit} onThreadCreated={onThreadCreated} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

