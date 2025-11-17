import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Settings, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getUsers, type UserListParams } from "@/services/userService";
import type { User } from "@/lib/appwriteSchema";

export const Route = createFileRoute("/admin-management")({
  component: AdminManagement,
});

function AdminManagement() {
  return (
    <AdminProtectedRoute>
      <AdminManagementContent />
    </AdminProtectedRoute>
  );
}

function AdminManagementContent() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'createdAt' | 'email' | 'firstName' | 'lastName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['admin-users', currentPage, searchTerm, sortBy, sortOrder],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      return getUsers({
        page: currentPage,
        limit: 20,
        search: searchTerm,
        sortBy,
        sortOrder,
        token,
      });
    },
  });

  const handleSort = (column: 'createdAt' | 'email' | 'firstName' | 'lastName') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-2">Admin Management</h4>
        <ul className="space-y-2 text-xs text-purple-700">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            User role management
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Persona configuration
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            System settings
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="personas">Persona Configuration</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
          </TabsList>

           <TabsContent value="users" className="space-y-6">
             <Card>
               <div className="p-6">
                 <div className="flex items-center gap-4 mb-6">
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                       <Input
                         placeholder="Search users..."
                         value={searchTerm}
                         onChange={(e) => {
                           setSearchTerm(e.target.value);
                           setCurrentPage(1);
                         }}
                         className="pl-10 w-64"
                       />
                     </div>
                     <Select value={sortBy} onValueChange={(value: any) => handleSort(value)}>
                       <SelectTrigger className="w-40">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="createdAt">Created Date</SelectItem>
                         <SelectItem value="email">Email</SelectItem>
                         <SelectItem value="firstName">First Name</SelectItem>
                         <SelectItem value="lastName">Last Name</SelectItem>
                       </SelectContent>
                      </Select>
                  </div>

                 {error && (
                   <Alert className="mb-4">
                     <AlertDescription>
                       Error loading users: {error.message}
                     </AlertDescription>
                   </Alert>
                 )}

                 <div className="border rounded-lg overflow-hidden">
                   <table className="w-full">
                     <thead className="bg-gray-50">
                       <tr>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           <button
                             onClick={() => handleSort('firstName')}
                             className="flex items-center gap-1 hover:text-gray-700"
                           >
                             Name {getSortIcon('firstName')}
                           </button>
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           <button
                             onClick={() => handleSort('email')}
                             className="flex items-center gap-1 hover:text-gray-700"
                           >
                             Email {getSortIcon('email')}
                           </button>
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Status
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           <button
                             onClick={() => handleSort('createdAt')}
                             className="flex items-center gap-1 hover:text-gray-700"
                           >
                             Created {getSortIcon('createdAt')}
                           </button>
                         </th>
                       </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                       {isLoading ? (
                         <tr>
                           <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                             Loading users...
                           </td>
                         </tr>
                       ) : userData?.users.length === 0 ? (
                         <tr>
                           <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                             No users found
                           </td>
                         </tr>
                       ) : (
                         userData?.users.map((user: User) => (
                           <tr key={user.id} className="hover:bg-gray-50">
                             <td className="px-4 py-4 whitespace-nowrap">
                               <div className="flex items-center">
                                 <div className="flex-shrink-0 h-10 w-10">
                                   <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                     <span className="text-sm font-medium text-gray-700">
                                       {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                                     </span>
                                   </div>
                                 </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {user.firstName && user.lastName
                                        ? `${user.firstName} ${user.lastName}`
                                        : user.nickname || user.email.split('@')[0]
                                      }
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Threads: {user.threadCount}
                                      {user.age && user.age > 0 && ` • Age: ${user.age}`}
                                    </div>
                                  </div>
                               </div>
                             </td>
                             <td className="px-4 py-4 whitespace-nowrap">
                               <div className="text-sm text-gray-900">{user.email}</div>
                             </td>
                             <td className="px-4 py-4 whitespace-nowrap">
                               <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                 {user.status || 'active'}
                               </Badge>
                             </td>
                             <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                               {new Date(user.createdAt).toLocaleDateString()}
                             </td>
                           </tr>
                         ))
                       )}
                     </tbody>
                   </table>
                 </div>

                 {userData && userData.pagination.totalPages > 1 && (
                   <div className="flex items-center justify-between mt-4">
                     <div className="text-sm text-gray-700">
                       Showing {((userData.pagination.currentPage - 1) * userData.pagination.limit) + 1} to{' '}
                       {Math.min(userData.pagination.currentPage * userData.pagination.limit, userData.pagination.totalUsers)}{' '}
                       of {userData.pagination.totalUsers} users
                     </div>
                     <div className="flex items-center gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                         disabled={!userData.pagination.hasPrev}
                       >
                         <ChevronLeft className="h-4 w-4" />
                         Previous
                       </Button>
                       <span className="text-sm text-gray-700">
                         Page {userData.pagination.currentPage} of {userData.pagination.totalPages}
                       </span>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => setCurrentPage(prev => Math.min(userData.pagination.totalPages, prev + 1))}
                         disabled={!userData.pagination.hasNext}
                       >
                         Next
                         <ChevronRight className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>
                 )}
               </div>
             </Card>
           </TabsContent>

          <TabsContent value="personas" className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Persona Configuration</h3>
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    Persona configuration tools will be available here. You can customize AI personas, conversation styles, and behavioral patterns.
                  </AlertDescription>
                </Alert>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">System Settings</h3>
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    System configuration options will be available here. You can manage API keys, integration settings, and system preferences.
                  </AlertDescription>
                </Alert>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}