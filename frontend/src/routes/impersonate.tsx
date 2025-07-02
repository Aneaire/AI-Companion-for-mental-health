import { ImpersonateDialog } from "@/components/chat/ImpersonateDialog";
import type { ImpersonateFormData } from "@/components/chat/ImpersonateForm";
import { createFileRoute } from "@tanstack/react-router";
import { useSidebarContext } from "./__root";

export const Route = createFileRoute("/impersonate")({
  component: Impersonate,
});

function Impersonate() {
  const { chatDialogOpen, setChatDialogOpen } = useSidebarContext();

  // Stub handlers for now
  const handleImpersonateSubmit = (
    formData: ImpersonateFormData,
    aiResponse: string,
    sessionId: number
  ) => {
    // TODO: Implement actual impersonation logic
    setChatDialogOpen(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Impersonate Mode</h1>
      <p>This is the impersonate page where AI will roleplay as a patient.</p>
      <ImpersonateDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        onSubmit={handleImpersonateSubmit}
      />
    </div>
  );
}

export default Route.options.component;
