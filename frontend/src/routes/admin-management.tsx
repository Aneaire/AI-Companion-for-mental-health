import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useRef } from "react";
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
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Users, Settings, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Save, RotateCcw, Bot, Zap, Shield, Target, AlertTriangle, X, Plus } from "lucide-react";
import { getUsers, type UserListParams } from "@/services/userService";
import { UserManagementDialog } from "@/components/admin/UserManagementDialog";
import type { User } from "@/lib/appwriteSchema";

// Personas configuration types
interface Persona {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  triggers: string[];
  emotionalIndicators: string[];
  conversationStyle: {
    pace: string;
    tone: string;
    responseLength: string;
    questionStyle: string;
    focus: string;
  };
  suitableFor: string[];
}

interface SelectionRules {
  priorityOrder: string[];
  contextWeighting: {
    triggers: number;
    emotionalIndicators: number;
    conversationHistory: number;
    userPreferences: number;
  };
  fallbackPersona: string;
}

interface AngerDetection {
  keywords: string[];
  sentimentThreshold: {
    anger: number;
    frustration: number;
    disgust: number;
  };
  toxicityThreshold: number;
  repetitionDetection: {
    enabled: boolean;
    tolerance: number;
    timeWindowSec: number;
    triggerIfRepeatedPhrases: boolean;
  };
  capsLockDetection: {
    enabled: boolean;
    sensitivity: number;
    minCapsPercent: number;
    triggerOnRepeatedCaps: boolean;
  };
  punctuationPatterns: {
    excessiveExclamations: boolean;
    excessiveQuestionMarks: boolean;
    mixedPunctuation: boolean;
  };
  emojiIndicators: string[];
  behavioralSignals: {
    shortReplies: {
      enabled: boolean;
      maxLength: number;
      minConsecutiveCount: number;
    };
    rapidMessages: {
      enabled: boolean;
      maxIntervalSec: number;
      minMessages: number;
    };
    engagementDrop: {
      enabled: boolean;
      noResponseTimeoutSec: number;
    };
  };
  personaSwitchingRules: {
    from: string[];
    to: string;
    triggerConditions: string[];
    cooldownSec: number;
    returnToPersona: string;
    returnConditions: string[];
  };
}

interface PersonasConfig {
  personas: Record<string, Persona>;
  selectionRules: SelectionRules;
  angerDetection: AngerDetection;
}

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

  // Personas configuration state
  const [personasConfig, setPersonasConfig] = useState<PersonasConfig | null>(null);
  const [personasBackup, setPersonasBackup] = useState<PersonasConfig | null>(null);
  const [isPersonasDirty, setIsPersonasDirty] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [originalJson, setOriginalJson] = useState<string>("");

  // User management dialog state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState(false);

  // System settings state
  const [systemSettings, setSystemSettings] = useState<{
    geminiApiKey: string;
    elevenlabsApiKey: string;
  }>({
    geminiApiKey: '',
    elevenlabsApiKey: '',
  });
  const [systemSettingsBackup, setSystemSettingsBackup] = useState<{
    geminiApiKey: string;
    elevenlabsApiKey: string;
  }>({
    geminiApiKey: '',
    elevenlabsApiKey: '',
  });
  const [isSystemSettingsDirty, setIsSystemSettingsDirty] = useState(false);

  const { data: userData, isLoading, error, refetch: refetchUsers } = useQuery({
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

  // Helper component for managing array items with badges
  const ArrayItemManager = ({
    items,
    onAdd,
    onRemove,
    placeholder
  }: {
    items: string[];
    onAdd: (item: string) => void;
    onRemove: (index: number) => void;
    placeholder: string;
  }) => {
    const [localInputValue, setLocalInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleAdd = () => {
      if (localInputValue.trim()) {
        onAdd(localInputValue.trim());
        setLocalInputValue("");
        // Focus back to input after adding
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <Badge key={`${item}-${index}`} variant="secondary" className="group relative pr-6">
              {item}
              <button
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-3 w-3 rounded-full bg-gray-400 hover:bg-red-500 flex items-center justify-center"
              >
                <X className="h-2 w-2 text-white" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={localInputValue}
            onChange={(e) => setLocalInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            size="sm"
            disabled={!localInputValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Load personas data on component mount
  useEffect(() => {
    const loadPersonasData = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.error('No authentication token available');
          return;
        }

        const response = await fetch('/api/admin/personas', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data: PersonasConfig = await response.json();
          const jsonString = JSON.stringify(data, null, 2);
          setPersonasConfig(data);
          setPersonasBackup(data);
          setOriginalJson(jsonString);
          setIsPersonasDirty(false);
          // Select first persona by default
          const firstPersonaId = Object.keys(data.personas)[0];
          setSelectedPersona(firstPersonaId);
        } else {
          console.error('Failed to load personas:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to load personas data:', error);
      }
    };

    loadPersonasData();
  }, [getToken]);

  // Load system settings on component mount
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.error('No authentication token available');
          return;
        }

        const response = await fetch('/api/admin/system-settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSystemSettings(data);
          setSystemSettingsBackup(data);
        } else {
          console.error('Failed to load system settings:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to load system settings:', error);
      }
    };

    loadSystemSettings();
  }, [getToken]);

  // Handle personas config changes
  const handlePersonaChange = (personaId: string, field: string, value: any) => {
    if (!personasConfig) return;

    const updatedConfig = { ...personasConfig };
    if (field.includes('.')) {
      // Handle nested fields like conversationStyle.pace
      const [parent, child] = field.split('.');
      if (updatedConfig.personas[personaId] && updatedConfig.personas[personaId][parent as keyof Persona]) {
        (updatedConfig.personas[personaId][parent as keyof Persona] as any)[child] = value;
      }
    } else {
      (updatedConfig.personas[personaId] as any)[field] = value;
    }

    setPersonasConfig(updatedConfig);
    // Check if the config has changed from original
    const currentJson = JSON.stringify(updatedConfig, null, 2);
    const hasChanged = currentJson !== originalJson;
    console.log('Persona changed:', hasChanged, field, value);
    setIsPersonasDirty(hasChanged);
  };

  const handleSelectionRulesChange = (field: string, value: any) => {
    if (!personasConfig) return;

    const updatedConfig = { ...personasConfig };
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (updatedConfig.selectionRules[parent as keyof SelectionRules]) {
        (updatedConfig.selectionRules[parent as keyof SelectionRules] as any)[child] = value;
      }
    } else {
      (updatedConfig.selectionRules as any)[field] = value;
    }

    setPersonasConfig(updatedConfig);
    const currentJson = JSON.stringify(updatedConfig, null, 2);
    const hasChanged = currentJson !== originalJson;
    console.log('Selection rules changed:', hasChanged, field, value);
    setIsPersonasDirty(hasChanged);
  };

  const handleAngerDetectionChange = (field: string, value: any) => {
    if (!personasConfig) return;

    const updatedConfig = { ...personasConfig };
    if (field.includes('.')) {
      const parts = field.split('.');
      let current: any = updatedConfig.angerDetection;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    } else {
      (updatedConfig.angerDetection as any)[field] = value;
    }

    setPersonasConfig(updatedConfig);
    const currentJson = JSON.stringify(updatedConfig, null, 2);
    const hasChanged = currentJson !== originalJson;
    console.log('Anger detection changed:', hasChanged, field, value);
    setIsPersonasDirty(hasChanged);
  };

  // Handle system settings changes
  const handleSystemSettingsChange = (field: string, value: string) => {
    const updatedSettings = { ...systemSettings, [field]: value };
    setSystemSettings(updatedSettings);
    const hasChanged = JSON.stringify(updatedSettings) !== JSON.stringify(systemSettingsBackup);
    setIsSystemSettingsDirty(hasChanged);
  };

  // Handle user management actions
  const handleUserAction = async (action: 'block' | 'remove' | 'makeAdmin' | 'revokeAdmin', userId: number) => {
    setUserActionLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const actionMessages = {
          block: 'User has been blocked',
          remove: 'User has been removed',
          makeAdmin: 'User has been made an administrator',
          revokeAdmin: 'Admin privileges have been revoked'
        };
        toast.success(actionMessages[action]);
        // Refresh the user list
        refetchUsers();
      } else {
        const error = await response.json();
        toast.error(`Action failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error performing user action:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setUserActionLoading(false);
    }
  };

  // Save system settings
  const handleSaveSystemSettings = async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/system-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(systemSettings),
      });

      if (response.ok) {
        setSystemSettingsBackup(systemSettings);
        setIsSystemSettingsDirty(false);
        toast.success('System settings saved successfully!');
      } else {
        const error = await response.json();
        toast.error(`Save failed: ${error.message}`);
      }

    } catch (error) {
      console.error('Error saving system settings:', error);
      toast.error('Network error. Please try again.');
    }
  };

  // Restore system settings
  const handleRestoreSystemSettings = () => {
    if (confirm('Are you sure you want to restore system settings to their previous saved state?')) {
      setSystemSettings(systemSettingsBackup);
      setIsSystemSettingsDirty(false);
    }
  };

  // Save personas data
  const handleSavePersonas = async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/personas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ personasData: JSON.stringify(personasConfig, null, 2) }),
      });

      if (response.ok) {
        const currentJson = JSON.stringify(personasConfig, null, 2);
        setOriginalJson(currentJson);
        setPersonasBackup(personasConfig);
        setIsPersonasDirty(false);
        toast.success('Personas configuration saved successfully!');
      } else {
        const error = await response.json();
        toast.error(`Save failed: ${error.message}`);
      }

    } catch (error) {
      console.error('Error saving personas:', error);
      toast.error('Network error. Please try again.');
    }
  };

  // Restore to default
  const handleRestorePersonas = () => {
    if (confirm('Are you sure you want to restore to the default personas configuration? This will discard all your changes.')) {
      setPersonasConfig(personasBackup);
      setIsPersonasDirty(false);
    }
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
             <TabsTrigger value="personas">Persona</TabsTrigger>
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
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              Loading users...
                            </td>
                          </tr>
                        ) : userData?.users.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              No users found
                            </td>
                          </tr>
                       ) : (
                          userData?.users.map((user: User) => (
                            <tr
                              key={user.id}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowUserDialog(true);
                              }}
                            >
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
                                     
                                    </div>
                                  </div>
                               </div>
                             </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{user.email}</div>
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

              <UserManagementDialog
                user={selectedUser}
                isOpen={showUserDialog}
                onClose={() => {
                  setShowUserDialog(false);
                  setSelectedUser(null);
                }}
                onAction={handleUserAction}
                isLoading={userActionLoading}
              />
            </TabsContent>

            <TabsContent value="personas" className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold hidden md:block">Persona Configuration</h3>
                <div className="flex items-center gap-2">
                 <Button
                   onClick={handleRestorePersonas}
                   variant="outline"
                   size="sm"
                   disabled={!isPersonasDirty}
                 >
                   <RotateCcw className="h-4 w-4 mr-2" />
                   Restore Default
                 </Button>
                 <Button
                   onClick={handleSavePersonas}
                   size="sm"
                   disabled={!isPersonasDirty}
                 >
                   <Save className="h-4 w-4 mr-2" />
                   Save Changes
                 </Button>
               </div>
             </div>

             {isPersonasDirty && (
               <Alert className="border-yellow-200 bg-yellow-50">
                 <AlertDescription className="text-yellow-800">
                   You have unsaved changes. Click "Save Changes" to apply them or "Restore Default" to discard.
                   DEBUG: isPersonasDirty = {isPersonasDirty.toString()}
                 </AlertDescription>
               </Alert>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Persona List */}
               <Card className="lg:col-span-1">
                 <div className="p-4">
                   <h4 className="font-semibold mb-4 flex items-center gap-2">
                     <Bot className="h-4 w-4" />
                     AI Personas
                   </h4>
                   <div className="space-y-2">
                     {personasConfig && Object.entries(personasConfig.personas).map(([id, persona]) => (
                       <button
                         key={id}
                         onClick={() => setSelectedPersona(id)}
                         className={`w-full text-left p-3 rounded-lg border transition-colors ${
                           selectedPersona === id
                             ? 'border-blue-500 bg-blue-50'
                             : 'border-gray-200 hover:border-gray-300'
                         }`}
                       >
                         <div className="font-medium text-sm">{persona.name}</div>
                         <div className="text-xs text-gray-500 mt-1">{persona.description.slice(0, 60)}...</div>
                       </button>
                     ))}
                   </div>
                 </div>
               </Card>

               {/* Persona Editor */}
               <Card className="lg:col-span-2">
                 <div className="p-6">
                   {selectedPersona && personasConfig?.personas[selectedPersona] && (
                     <div className="space-y-6">
                       <div className="flex items-center gap-3">
                         <Bot className="h-5 w-5 text-blue-500" />
                         <h4 className="text-lg font-semibold">
                           {personasConfig.personas[selectedPersona].name}
                         </h4>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label htmlFor="persona-name">Display Name</Label>
                           <Input
                             id="persona-name"
                             value={personasConfig.personas[selectedPersona].name}
                             onChange={(e) => handlePersonaChange(selectedPersona, 'name', e.target.value)}
                             disabled
                           />
                         </div>
                         <div className="space-y-2">
                           <Label htmlFor="persona-id">ID (read-only)</Label>
                           <Input
                             id="persona-id"
                             value={personasConfig.personas[selectedPersona].id}
                             disabled
                             className="bg-gray-50"
                           />
                         </div>
                       </div>

                       <div className="space-y-2">
                         <Label htmlFor="persona-description">Description</Label>
                         <Textarea
                           id="persona-description"
                           value={personasConfig.personas[selectedPersona].description}
                           onChange={(e) => handlePersonaChange(selectedPersona, 'description', e.target.value)}
                           rows={3}
                         />
                       </div>

                       <div className="space-y-2">
                         <Label htmlFor="persona-instruction">System Instruction</Label>
                         <Textarea
                           id="persona-instruction"
                           value={personasConfig.personas[selectedPersona].systemInstruction}
                           onChange={(e) => handlePersonaChange(selectedPersona, 'systemInstruction', e.target.value)}
                           rows={6}
                           className="font-mono text-sm"
                         />
                       </div>

                        <div className="space-y-2">
                          <Label>Conversation Style</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="pace" className="text-sm text-gray-600">Pace</Label>
                              <Input
                                id="pace"
                                value={personasConfig.personas[selectedPersona].conversationStyle.pace}
                                onChange={(e) => handlePersonaChange(selectedPersona, 'conversationStyle.pace', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="tone" className="text-sm text-gray-600">Tone</Label>
                              <Input
                                id="tone"
                                value={personasConfig.personas[selectedPersona].conversationStyle.tone}
                                onChange={(e) => handlePersonaChange(selectedPersona, 'conversationStyle.tone', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Triggers</Label>
                           <ArrayItemManager
                             items={personasConfig.personas[selectedPersona].triggers}
                             onAdd={(item) => {
                               const updatedTriggers = [...personasConfig.personas[selectedPersona].triggers, item];
                               handlePersonaChange(selectedPersona, 'triggers', updatedTriggers);
                             }}
                             onRemove={(index) => {
                               const updatedTriggers = personasConfig.personas[selectedPersona].triggers.filter((_, i) => i !== index);
                               handlePersonaChange(selectedPersona, 'triggers', updatedTriggers);
                             }}
                             placeholder="Add new trigger..."
                           />
                        </div>
                     </div>
                   )}
                 </div>
               </Card>
             </div>

             {/* Selection Rules */}
             <Card>
               <div className="p-6">
                 <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                   <Target className="h-5 w-5 text-green-500" />
                   Selection Rules
                 </h4>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="space-y-4">
                     <div>
                       <Label>Fallback Persona</Label>
                       <Select
                         value={personasConfig?.selectionRules.fallbackPersona || ''}
                         onValueChange={(value) => handleSelectionRulesChange('fallbackPersona', value)}
                       >
                         <SelectTrigger>
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           {personasConfig && Object.entries(personasConfig.personas).map(([id, persona]) => (
                             <SelectItem key={id} value={id}>{persona.name}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>

                     <div>
                       <Label>Priority Order (drag to reorder)</Label>
                       <div className="space-y-2">
                         {personasConfig?.selectionRules.priorityOrder.map((personaId, index) => (
                           <div key={personaId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                             <span className="text-sm font-medium">{index + 1}.</span>
                             <span className="text-sm">{personasConfig.personas[personaId]?.name || personaId}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <Label>Context Weighting</Label>
                     <div className="space-y-3">
                       {personasConfig && Object.entries(personasConfig.selectionRules.contextWeighting).map(([key, value]) => (
                         <div key={key} className="flex items-center justify-between">
                           <Label className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                           <Input
                             type="number"
                             step="0.1"
                             min="0"
                             max="1"
                             value={value}
                             onChange={(e) => handleSelectionRulesChange(`contextWeighting.${key}`, parseFloat(e.target.value))}
                             className="w-20"
                           />
                         </div>
                       ))}
                     </div>
                   </div>

                   <div className="space-y-4">
                     <Label className="text-sm text-gray-600">
                       These weights determine how much each factor influences persona selection
                     </Label>
                     <Alert>
                       <AlertDescription className="text-sm">
                         Higher weights give more importance to that factor when choosing which AI persona to activate.
                       </AlertDescription>
                     </Alert>
                   </div>
                 </div>
               </div>
             </Card>

             {/* Anger Detection */}
             <Card>
               <div className="p-6">
                 <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                   <AlertTriangle className="h-5 w-5 text-red-500" />
                   Anger Detection Settings
                 </h4>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                     <div>
                       <Label>Toxicity Threshold</Label>
                       <Input
                         type="number"
                         step="0.1"
                         min="0"
                         max="1"
                         value={personasConfig?.angerDetection.toxicityThreshold || 0}
                         onChange={(e) => handleAngerDetectionChange('toxicityThreshold', parseFloat(e.target.value))}
                       />
                     </div>

                     <div>
                       <Label>Sentiment Thresholds</Label>
                       <div className="space-y-2">
                         {personasConfig && Object.entries(personasConfig.angerDetection.sentimentThreshold).map(([key, value]) => (
                           <div key={key} className="flex items-center justify-between">
                             <Label className="text-sm capitalize">{key}</Label>
                             <Input
                               type="number"
                               step="0.1"
                               min="0"
                               max="1"
                               value={value}
                               onChange={(e) => handleAngerDetectionChange(`sentimentThreshold.${key}`, parseFloat(e.target.value))}
                               className="w-20"
                             />
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <div>
                       <Label>Anger Keywords</Label>
                       <ArrayItemManager
                         items={personasConfig?.angerDetection.keywords || []}
                         onAdd={(item) => {
                           const updatedKeywords = [...(personasConfig?.angerDetection.keywords || []), item];
                           handleAngerDetectionChange('keywords', updatedKeywords);
                         }}
                         onRemove={(index) => {
                           const updatedKeywords = (personasConfig?.angerDetection.keywords || []).filter((_, i) => i !== index);
                           handleAngerDetectionChange('keywords', updatedKeywords);
                         }}
                         placeholder="Add anger keyword..."
                       />
                     </div>
                   </div>
                 </div>
               </div>
             </Card>
           </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold hidden md:block">System Settings</h3>
                <div className="flex items-center gap-2">
                 <Button
                   onClick={handleRestoreSystemSettings}
                   variant="outline"
                   size="sm"
                   disabled={!isSystemSettingsDirty}
                 >
                   <RotateCcw className="h-4 w-4 mr-2" />
                   Restore Previous
                 </Button>
                 <Button
                   onClick={handleSaveSystemSettings}
                   size="sm"
                   disabled={!isSystemSettingsDirty}
                 >
                   <Save className="h-4 w-4 mr-2" />
                   Save Settings
                 </Button>
               </div>
             </div>

             {isSystemSettingsDirty && (
               <Alert className="border-yellow-200 bg-yellow-50">
                 <AlertDescription className="text-yellow-800">
                   You have unsaved changes. Click "Save Settings" to apply them or "Restore Previous" to discard.
                 </AlertDescription>
               </Alert>
             )}

             <Card>
               <div className="p-6">
                 <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                   <Zap className="h-5 w-5 text-blue-500" />
                   API Keys Configuration
                 </h4>

                 <div className="space-y-6">
                   <Alert>
                     <AlertDescription className="text-sm">
                       Configure API keys for external services. These keys will be prioritized over environment variables.
                       Keys are stored securely and only accessible to administrators.
                     </AlertDescription>
                   </Alert>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-3">
                       <div className="flex items-center gap-2">
                         <Bot className="h-4 w-4 text-blue-500" />
                         <Label htmlFor="gemini-key" className="text-sm font-medium">
                           Gemini API Key
                         </Label>
                       </div>
                       <Input
                         id="gemini-key"
                         type="password"
                         value={systemSettings.geminiApiKey}
                         onChange={(e) => handleSystemSettingsChange('geminiApiKey', e.target.value)}
                         placeholder="Enter your Gemini API key..."
                         className="font-mono"
                       />
                       <p className="text-xs text-gray-500">
                         Used for AI text generation and conversation processing.
                         {systemSettings.geminiApiKey ? ' ✓ Configured' : ' ⚠ Not configured (using environment variable)'}
                       </p>
                     </div>

                     <div className="space-y-3">
                       <div className="flex items-center gap-2">
                         <Settings className="h-4 w-4 text-green-500" />
                         <Label htmlFor="elevenlabs-key" className="text-sm font-medium">
                           ElevenLabs API Key
                         </Label>
                       </div>
                       <Input
                         id="elevenlabs-key"
                         type="password"
                         value={systemSettings.elevenlabsApiKey}
                         onChange={(e) => handleSystemSettingsChange('elevenlabsApiKey', e.target.value)}
                         placeholder="Enter your ElevenLabs API key..."
                         className="font-mono"
                       />
                       <p className="text-xs text-gray-500">
                         Used for text-to-speech voice generation.
                         {systemSettings.elevenlabsApiKey ? ' ✓ Configured' : ' ⚠ Not configured (using environment variable)'}
                       </p>
                     </div>
                   </div>

                   <div className="border-t pt-6">
                     <h5 className="text-sm font-medium mb-3">Security Notes</h5>
                     <ul className="text-xs text-gray-600 space-y-1">
                       <li>• API keys are encrypted before storage</li>
                       <li>• Keys are only accessible to administrators</li>
                       <li>• Changes take effect immediately after saving</li>
                       <li>• Environment variables are used as fallback if admin keys are not set</li>
                     </ul>
                   </div>
                 </div>
               </div>
             </Card>

             <Card>
               <div className="p-6">
                 <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                   <Shield className="h-5 w-5 text-purple-500" />
                   System Information
                 </h4>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <div>
                       <Label className="text-sm font-medium">Environment</Label>
                       <p className="text-sm text-gray-600">
                         {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
                       </p>
                     </div>

                     <div>
                       <Label className="text-sm font-medium">API Status</Label>
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                         <span className="text-sm text-gray-600">All systems operational</span>
                       </div>
                     </div>
                   </div>

                   <div className="space-y-3">
                     <div>
                       <Label className="text-sm font-medium">Last Updated</Label>
                       <p className="text-sm text-gray-600">
                         {new Date().toLocaleString()}
                       </p>
                     </div>

                     <div>
                       <Label className="text-sm font-medium">Version</Label>
                       <p className="text-sm text-gray-600">v1.0.0</p>
                     </div>
                   </div>
                 </div>
               </div>
             </Card>
           </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}