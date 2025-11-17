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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, UserX, UserCheck } from "lucide-react";
import type { User } from "@/lib/appwriteSchema";

interface UserManagementDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'block' | 'remove' | 'makeAdmin' | 'revokeAdmin', userId: number) => void;
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

  const handleAction = (action: 'block' | 'remove' | 'makeAdmin' | 'revokeAdmin') => {
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

  const isAdmin = user.status === 'admin'; // We'll need to add this field to the User type

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                </span>
              </div>
              User Management
            </DialogTitle>
            <DialogDescription>
              Manage user account for <strong>{user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.nickname || user.email.split('@')[0]}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Role</label>
                <div className="flex items-center gap-2">
                  <Badge variant={isAdmin ? "default" : "secondary"}>
                    {isAdmin ? "Admin" : "User"}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="font-medium text-gray-700">Threads</label>
                <p className="text-gray-900">{user.threadCount}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Joined</label>
                <p className="text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Available Actions</h4>
              <div className="space-y-2">
                {isAdmin ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('revokeAdmin')}
                    disabled={isLoading}
                    className="w-full justify-start"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Revoke Admin Privileges
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('makeAdmin')}
                    disabled={isLoading}
                    className="w-full justify-start"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Make Administrator
                  </Button>
                )}

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
                  className="w-full justify-start text-red-600 hover:text-red-700"
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
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Delete the user account from the system</li>
                <li>Remove all associated data and threads</li>
                <li>Revoke all access permissions</li>
              </ul>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmAction}>
              Yes, Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}