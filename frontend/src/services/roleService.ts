// Role constants and utilities for Clerk metadata-based role system
export const ADMIN_ROLES = ['superadmin', 'admin', 'observer'] as const;
export const OBSERVER_ROLES = ['superadmin', 'admin', 'observer'] as const;

export type AdminRole = typeof ADMIN_ROLES[number];
export type ObserverRole = typeof OBSERVER_ROLES[number];

export const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'superadmin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'observer':
      return 'Observer';
    case 'user':
      return 'User';
    default:
      return role;
  }
};

export const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (role) {
    case 'superadmin':
      return 'destructive'; // Red for highest privilege
    case 'admin':
      return 'default'; // Blue for admin
    case 'observer':
      return 'secondary'; // Gray for observer
    case 'user':
      return 'outline'; // Outlined for regular users
    default:
      return 'outline';
  }
};