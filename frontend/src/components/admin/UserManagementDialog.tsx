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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, UserX, UserCheck, Shield, Eye, Crown } from "lucide-react";
import type { User } from "@/lib/appwriteSchema";

interface UserManagementDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'block' | 'remove' | 'makeAdmin' | 'revokeAdmin' | 'updateRole', userId: number, newRole?: string) => void;
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
  const [selectedRole, setSelectedRole] = useState<string>(user?.role || 'user');

  const availableRoles = [
    { value: 'user', label: 'User', icon: UserCheck, color: 'bg-gray-100 text-gray-800' },
    { value: 'observer', label: 'Observer', icon: Eye, color: 'bg-blue-100 text-blue-800' },
    { value: 'admin', label: 'Admin', icon: Shield, color: 'bg-purple-100 text-purple-800' },
    { value: 'superadmin', label: 'Super Admin', icon: Crown, color: 'bg-yellow-100 text-yellow-800' },
  ];

  const getRoleBadge = (role: string) => {
    const roleConfig = availableRoles.find(r => r.value === role);
    if (!roleConfig) return null;
    const Icon = roleConfig.icon;
    return (
      <Badge className={roleConfig.color}>
        <Icon className="h-3 w-3 mr-1" />
        {roleConfig.label}
      </Badge>
    );
  };

  if (!user) return null;

  const handleAction = (action: 'block' | 'remove' | 'makeAdmin' | 'revokeAdmin' | 'updateRole') => {
    if (action === 'remove') {
      setConfirmAction(action);
    } else if (action === 'updateRole') {
      onAction(action, user.id, selectedRole);
      onClose();
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
                <label className="font-medium text-gray-700">Threads</label>
                <p className="text-gray-900">{user.threadCount}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Joined</label>
                <p className="text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Current Role</label>
                <div className="mt-1">
                  {getRoleBadge(user.role || 'user')}
                </div>
              </div>
             </div>

             <div className="border-t pt-4">
               <h4 className="font-medium mb-3">Role Management</h4>
               <div className="space-y-3">
                 <div>
                   <Label htmlFor="role-select">Assign New Role</Label>
                   <Select value={selectedRole} onValueChange={setSelectedRole}>
                     <SelectTrigger id="role-select">
                       <SelectValue placeholder="Select a role" />
                     </SelectTrigger>
                     <SelectContent>
                       {availableRoles.map((role) => {
                         const Icon = role.icon;
                         return (
                           <SelectItem key={role.value} value={role.value}>
                             <div className="flex items-center gap-2">
                               <Icon className="h-4 w-4" />
                               {role.label}
                             </div>
                           </SelectItem>
                         );
                       })}
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <Button
                   variant="default"
                   size="sm"
                   onClick={() => handleAction('updateRole')}
                   disabled={isLoading || selectedRole === (user.role || 'user')}
                   className="w-full justify-start"
                 >
                   <UserCheck className="h-4 w-4 mr-2" />
                   Update Role
                 </Button>
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
              <li>Delete the user account from the system</li>
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