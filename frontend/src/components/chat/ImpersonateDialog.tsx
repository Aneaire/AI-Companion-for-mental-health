import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImpersonateForm, type ImpersonateFormData } from "./ImpersonateForm";

export function ImpersonateDialog({
  open,
  onOpenChange,
  onSubmit,
  onThreadCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    formData: ImpersonateFormData,
    aiResponse: string,
    sessionId: number,
    templateId?: number | null
  ) => void;
  onThreadCreated?: (session: any) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl w-full max-h-[90vh] p-0 overflow-hidden border-0 rounded-2xl shadow-2xl"
        style={{ margin: "auto" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Create Therapy Session</DialogTitle>
          <DialogDescription>
            Set up AI impersonation parameters
          </DialogDescription>
        </DialogHeader>
        <div className="h-full overflow-y-scroll p-1.5">
          <ImpersonateForm
            onSubmit={onSubmit}
            onThreadCreated={onThreadCreated}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
