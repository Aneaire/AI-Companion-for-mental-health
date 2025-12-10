import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, UserX } from "lucide-react";
import type { User } from "@/lib/appwriteSchema";

interface UserManagementDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'block' | 'remove', userId: number) => void;
  isLoading?: boolean;
}

export function UserManagementDialog({
  user,
  isOpen,
  onClose,
  onAction,
  isLoading = false
}: UserManagementDialogProps) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  if (!user) return null;

  const handleAction = (action: 'block' | 'remove') => {
    if (action === 'remove') {
      setConfirmAction(action);
    } else {
      onAction(action, user.id);
      onClose();
    }
  };

  const handleConfirmAction = () => {
    if (confirmAction) {
      onAction(confirmAction as any, user.id);
      setConfirmAction(null);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarImage 
                  src={user.profileImageUrl || undefined} 
                  alt={user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.nickname || user.email.split('@')[0]
                  } 
                  onError={(e) => {
                    // Force fallback when image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <AvatarFallback className="font-medium text-foreground">
                  {user.firstName && user.lastName
                    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                    : (user.nickname || user.email.split('@')[0]).substring(0, 1).toUpperCase()
                  }
                </AvatarFallback>
              </Avatar>
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.nickname || user.email.split('@')[0]}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-t pt-4">
              <div className="text-sm">
                <label className="font-medium text-gray-700">Email</label>
                <p className="text-gray-900 mt-1">{user.email}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm">
                <div className="flex justify-between">
                  <div>
                    <label className="font-medium text-gray-700">Threads</label>
                    <p className="text-gray-900 mt-1">{user.threadCount}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Joined</label>
                    <p className="text-gray-900 mt-1">{new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Account Actions</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('block')}
                  disabled={isLoading}
                  className="w-full justify-start"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Block User
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleAction('remove')}
                  disabled={isLoading}
                  className="w-full justify-start text-white hover:text-white"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Remove User
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Remove Action */}
      <Dialog open={confirmAction === 'remove'} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm User Removal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove <strong>{user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.nickname || user.email}</strong>?
              <br /><br />
              This action cannot be undone and will:
            </DialogDescription>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-600">
              <li>Delete user account from system</li>
              <li>Remove all associated data and threads</li>
              <li>Revoke all access permissions</li>
            </ul>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmAction} className="text-white">
              Yes, Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}