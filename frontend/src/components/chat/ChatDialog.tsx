import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JSX } from "react";
import ChatForm from "./ChatForm";

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (sessionId: number) => void;
}

export function ChatDialog({
  open,
  onOpenChange,
  onSubmit,
}: ChatDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[95vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-8 pt-8 pb-4">
          <DialogTitle className="text-3xl font-bold text-gray-700">
            Welcome to your AI Companion ✨
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600 mt-3 leading-relaxed">
            Please tell me a little about yourself so I can better support you.
          </DialogDescription>
        </DialogHeader>
        <div className="px-8 pb-8">
          <ChatForm onSubmit={onSubmit} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
