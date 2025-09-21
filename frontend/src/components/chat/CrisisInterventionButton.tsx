import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, Phone, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chatStore";

interface CrisisInterventionButtonProps {
  sessionId?: number | null;
}

export function CrisisInterventionButton({ sessionId }: CrisisInterventionButtonProps) {
  const { crisisDetected, checkCrisisStatus, currentContext } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (sessionId) {
      checkCrisisStatus(sessionId);
    }
  }, [sessionId, checkCrisisStatus, currentContext.messages.length]);

  if (!crisisDetected) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
        >
          <Shield size={16} className="mr-2" />
          Crisis Support
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Heart size={20} />
            Crisis Intervention & Safety Tools
          </DialogTitle>
          <DialogDescription>
            Professional help is available. Please reach out to these trusted resources.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Immediate Crisis Support</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <Phone size={16} className="text-red-600" />
                <div>
                  <p className="font-medium text-red-900">National Center for Mental Health Crisis Hotline</p>
                  <p className="text-sm text-red-700">Call: 1553</p>
                  <p className="text-xs text-red-600">24/7 mental health crisis support</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Phone size={16} className="text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Philippine Mental Health Association</p>
                  <p className="text-sm text-blue-700">Call: (02) 725-5121</p>
                  <p className="text-xs text-blue-600">Mental health support and counseling</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">DHVSU Student Support</h3>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Phone size={16} className="text-green-600" />
              <div>
                <p className="font-medium text-green-900">DHVSU Help Center</p>
                <p className="text-sm text-green-700">Call: (123) 456-7890</p>
                <p className="text-xs text-green-600">Support services for students</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Mental Health Professionals</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <Heart size={16} className="text-purple-600" />
                <div>
                  <p className="font-medium text-purple-900">Philippine Psychiatric Association</p>
                  <p className="text-sm text-purple-700">
                    <a
                      href="https://www.ppsych.org.ph"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      ppsych.org.ph
                    </a>
                  </p>
                  <p className="text-xs text-purple-600">Directory of licensed psychiatrists</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <Heart size={16} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-indigo-900">Department of Health Philippines</p>
                  <p className="text-sm text-indigo-700">
                    <a
                      href="https://www.doh.gov.ph/mental-health"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      doh.gov.ph/mental-health
                    </a>
                  </p>
                  <p className="text-xs text-indigo-600">Mental health programs and resources</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Remember:</strong> If you or someone you know is in immediate danger,
              call emergency services (911) right away. These resources are here to help you through difficult times.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}