import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { Search, Users, ChevronUp, ChevronDown, Shield, Eye, UserCog, Crown, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { userService } from '@/services/userService';
import type { User } from '@/lib/appwriteSchema';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RoleChange {
  userId: number;
  newRole: string;
}

const RoleManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'email' | 'firstName' | 'lastName' | 'createdAt'>('email');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedRole, setSelectedRole] = useState<RoleChange | null>(null);
  const [limit] = useState(10);
  const { getToken } = useAuth();

  // Debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
      setCurrentPage(1);
    }, 500);
  }, []);

  // Cleanup timeout
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const queryClient = useQueryClient();

  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users', currentPage, debouncedSearchTerm, sortBy, sortOrder, limit],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      return userService.getUsers({
        page: currentPage,
        search: debouncedSearchTerm,
        sortBy,
        sortOrder,
        limit,
        token
      });
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: number; newRole: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      return userService.updateUserRole(userId, newRole, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedRole(null);
    },
    onError: (error) => {
      console.error('Failed to update role:', error);
      setSelectedRole(null);
    }
  });

  const handleRoleChange = (userId: number, newRole: string) => {
    setSelectedRole({ userId, newRole });
  };

  const confirmRoleChange = () => {
    if (selectedRole) {
      updateRoleMutation.mutate(selectedRole);
    }
  };

  const cancelRoleChange = () => {
    setSelectedRole(null);
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'superadmin':
        return <Crown className="w-3 h-3" />;
      case 'admin':
        return <UserCog className="w-3 h-3" />;
      case 'observer':
        return <Eye className="w-3 h-3" />;
      default:
        return <Shield className="w-3 h-3" />;
    }
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'observer':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };



  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading users: {(error as Error).message}</p>
      </div>
    );
  }

  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-2">Role Management</h4>
        <ul className="space-y-2 text-xs text-purple-700">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Assign user roles
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Manage permissions
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Control access levels
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600">Manage user roles and permissions</p>
        </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'email' | 'firstName' | 'lastName' | 'createdAt')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="email">Email</option>
              <option value="firstName">First Name</option>
              <option value="lastName">Last Name</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading users...</span>
          </div>
        ) : usersData?.users?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No users found matching your search criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {usersData?.users?.map((user: User) => (
              <div key={user.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                     <div className="flex-shrink-0">
                       <Avatar className="w-10 h-10">
                         <AvatarImage 
                           src={user.profileImageUrl || undefined} 
                           alt={user.firstName && user.lastName 
                             ? `${user.firstName} ${user.lastName}` 
                             : user.nickname || user.email.split('@')[0]
                           } 
                         />
                         <AvatarFallback className="font-medium text-foreground">
                           {user.firstName && user.lastName
                             ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                             : (user.nickname || user.email.split('@')[0]).substring(0, 1).toUpperCase()
                           }
                         </AvatarFallback>
                       </Avatar>
                     </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.nickname || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                      </p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        <span className="ml-1 capitalize">{user.role}</span>
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedRole?.userId === user.id ? selectedRole.newRole : user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={updateRoleMutation.isPending}
                    >
                      <option value="user">User</option>
                      <option value="observer">Observer</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    
                    {selectedRole?.userId === user.id && (
                      <div className="flex space-x-1">
                        <button
                          onClick={confirmRoleChange}
                          disabled={updateRoleMutation.isPending}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Confirm role change"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelRoleChange}
                          disabled={updateRoleMutation.isPending}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Cancel role change"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {updateRoleMutation.isPending && selectedRole?.userId === user.id && (
                  <div className="mt-2 text-sm text-blue-600">
                    Updating role...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {usersData?.pagination && usersData.pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((usersData.pagination.currentPage - 1) * usersData.pagination.limit) + 1} to{' '}
            {Math.min(usersData.pagination.currentPage * usersData.pagination.limit, usersData.pagination.totalUsers)} of{' '}
            {usersData.pagination.totalUsers} results
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-700">
              Page {currentPage} of {usersData.pagination.totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(usersData.pagination.totalPages, prev + 1))}
              disabled={currentPage === usersData.pagination.totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

export default RoleManagement;