import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/types/chat";
import type { JSX } from "react";
import MessageInput from "./MessageInput";
import { MessageList } from "./MessageList";

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  loadingState: "idle" | "observer" | "generating" | "streaming";
  inputVisible: boolean;
}

export function ChatInterface({
  messages,
  onSendMessage,
  loadingState,
  inputVisible,
}: ChatInterfaceProps): JSX.Element {
  return (
    <div className="flex flex-col h-full min-h-0 ">
      <ScrollArea className="flex-1 h-full min-h-0 pt-14 md:pt-0">
        <MessageList messages={messages} isLoading={loadingState} />
      </ScrollArea>
      {inputVisible && (
        <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 z-10">
          <MessageInput
            disabled={loadingState !== "idle"}
            onSendMessage={onSendMessage}
          />
        </div>
      )}
    </div>
  );
}

/*
// --- ImpersonateForm (archived for future use) ---
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const impersonateSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  age: z.string().min(1, "Age is required"),
  problemDescription: z.string().min(1, "Problem description is required"),
  background: z.string().optional(),
  personality: z.string().optional(),
});

export type ImpersonateFormData = z.infer<typeof impersonateSchema>;

interface ImpersonateFormProps {
  onSubmit: (data: ImpersonateFormData) => void;
}

export function ImpersonateForm({ onSubmit }: ImpersonateFormProps): JSX.Element {
  const form = useForm<ImpersonateFormData>({
    resolver: zodResolver(impersonateSchema),
    defaultValues: {
      fullName: "",
      age: "",
      problemDescription: "",
      background: "",
      personality: "",
    },
  });

  const handleSubmit = async (data: ImpersonateFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div>
        <label>Full Name</label>
        <input {...form.register("fullName")}/>
      </div>
      <div>
        <label>Age</label>
        <input {...form.register("age")}/>
      </div>
      <div>
        <label>Problem Description</label>
        <textarea {...form.register("problemDescription")}/>
      </div>
      <div>
        <label>Background (optional)</label>
        <textarea {...form.register("background")}/>
      </div>
      <div>
        <label>Personality (optional)</label>
        <textarea {...form.register("personality")}/>
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
// --- End ImpersonateForm ---
*/
