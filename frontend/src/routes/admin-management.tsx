import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageSquare, BarChart3, Users, Settings, Save, RotateCcw, Download, Upload, AlertTriangle, CheckCircle, Edit, Plus, Trash2 } from "lucide-react";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin-management",
  component: AdminManagement,
});

function AdminManagement() {
  return (
    <AdminProtectedRoute>
      <AdminManagementContent />
    </AdminProtectedRoute>
  );
}

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

interface PersonasConfig {
  personas: Record<string, Persona>;
  selectionRules: {
    priorityOrder: string[];
    contextWeighting: {
      triggers: number;
      emotionalIndicators: number;
      conversationHistory: number;
      userPreferences: number;
    };
    fallbackPersona: string;
  };
  angerDetection: any;
}

function AdminManagementContent() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Personas management state
  const [personasConfig, setPersonasConfig] = useState<PersonasConfig | null>(null);
  const [defaultConfig, setDefaultConfig] = useState<PersonasConfig | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState('personas');

  // Load personas configuration
  useEffect(() => {
    loadPersonasConfig();
  }, []);

  const loadPersonasConfig = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      // Load current config
      const currentResponse = await fetch("/api/admin/personas/config", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!currentResponse.ok) {
        throw new Error("Failed to load current personas configuration");
      }

      const currentData = await currentResponse.json();
      setPersonasConfig(currentData);

      // Load default config
      const defaultResponse = await fetch("/api/admin/personas/default", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (defaultResponse.ok) {
        const defaultData = await defaultResponse.json();
        setDefaultConfig(defaultData);
      }
    } catch (error) {
      console.error("Error loading personas config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePersonasConfig = async () => {
    if (!personasConfig) return;
    
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/admin/personas/config", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(personasConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save personas configuration");
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving personas config:", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const revertToDefault = async () => {
    if (!defaultConfig) return;
    
    if (confirm("Are you sure you want to revert to the default configuration? This will overwrite all current changes.")) {
      setPersonasConfig(defaultConfig);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const exportConfig = () => {
    if (!personasConfig) return;
    
    const dataStr = JSON.stringify(personasConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `personas-config-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        setPersonasConfig(importedConfig);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (error) {
        console.error("Error importing config:", error);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
  };

  const updatePersona = (personaId: string, updates: Partial<Persona>) => {
    if (!personasConfig) return;
    
    setPersonasConfig(prev => ({
      ...prev!,
      personas: {
        ...prev!.personas,
        [personaId]: {
          ...prev!.personas[personaId],
          ...updates
        }
      }
    }));
  };

  const startEditingPersona = (personaId: string) => {
    setSelectedPersona(personaId);
    setEditingPersona({...personasConfig!.personas[personaId]});
  };

  const savePersonaEdits = () => {
    if (!editingPersona || !selectedPersona) return;
    
    updatePersona(selectedPersona, editingPersona);
    setEditingPersona(null);
    setSelectedPersona(null);
  };

  const cancelPersonaEdits = () => {
    setEditingPersona(null);
    setSelectedPersona(null);
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = sidebarRef.current;
      if (sidebar && !sidebar.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    if (isSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen]);

  if (isLoading) {
    return <div className="p-8">Loading personas configuration...</div>;
  }

  return (
    <div className="flex h-screen w-full">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Navigation Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <MessageSquare size={16} />
              Chat
            </Link>
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={16} />
              Admin
            </Link>
            <Link
              to="/quality-analysis"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/quality-analysis"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={16} />
              Quality Analysis
            </Link>
            <Link
              to="/admin-management"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin-management"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Users size={16} />
              Admin Management
            </Link>
          </div>
        </div>

        {/* Admin Management Section */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-lg text-gray-800">Admin Management</span>
          <Settings size={18} className="text-gray-500" />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 text-gray-500 text-sm">
            <p className="mb-2">Admin management functions:</p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Personas configuration
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                System settings
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Backup & restore
              </li>
            </ul>
          </div>
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">
                {user?.firstName?.charAt(0) || user?.emailAddresses?.[0]?.emailAddress?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.emailAddresses?.[0]?.emailAddress
                }
              </p>
              <p className="text-xs text-gray-500">
                Admin User
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Users size={20} />
            <span className="ml-2">Admin Management</span>
          </Button>
          <h1 className="font-semibold">Management</h1>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="hidden md:block mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
          </div>

          {/* Status Alert */}
          {saveStatus !== 'idle' && (
            <Alert className={`mb-6 ${saveStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              {saveStatus === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                {saveStatus === 'success' ? 'Changes saved successfully!' : 'Error saving changes. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Button 
              onClick={savePersonasConfig} 
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button 
              variant="outline" 
              onClick={revertToDefault}
              disabled={!defaultConfig}
              className="flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Revert to Default
            </Button>
            <Button 
              variant="outline" 
              onClick={exportConfig}
              className="flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </Button>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
              <Upload size={16} />
              Import
              <input
                type="file"
                accept=".json"
                onChange={importConfig}
                className="hidden"
              />
            </label>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personas">Personas</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="personas" className="mt-6">
              {personasConfig && (
                <div className="space-y-6">
                  <div className="grid gap-4">
                    {Object.entries(personasConfig.personas).map(([id, persona]) => (
                      <Card key={id} className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{persona.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{persona.description}</p>
                            <Badge variant="secondary" className="mt-2">{id}</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditingPersona(id)}
                              className="flex items-center gap-1"
                            >
                              <Edit size={14} />
                              Edit
                            </Button>
                          </div>
                        </div>

                        {/* Editing Mode */}
                        {selectedPersona === id && editingPersona && (
                          <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <Input
                                  value={editingPersona.name}
                                  onChange={(e) => setEditingPersona({...editingPersona, name: e.target.value})}
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                                <Input
                                  value={editingPersona.id}
                                  disabled
                                  className="w-full bg-gray-100"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                              <Textarea
                                value={editingPersona.description}
                                onChange={(e) => setEditingPersona({...editingPersona, description: e.target.value})}
                                className="w-full"
                                rows={3}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">System Instruction</label>
                              <Textarea
                                value={editingPersona.systemInstruction}
                                onChange={(e) => setEditingPersona({...editingPersona, systemInstruction: e.target.value})}
                                className="w-full"
                                rows={6}
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button onClick={savePersonaEdits} size="sm">
                                Save Changes
                              </Button>
                              <Button onClick={cancelPersonaEdits} variant="outline" size="sm">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Read-only View */}
                        {selectedPersona !== id && (
                          <div className="mt-4 space-y-3">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Triggers</h4>
                              <div className="flex flex-wrap gap-1">
                                {persona.triggers.map((trigger, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {trigger}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Conversation Style</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                <div><strong>Pace:</strong> {persona.conversationStyle.pace}</div>
                                <div><strong>Tone:</strong> {persona.conversationStyle.tone}</div>
                                <div><strong>Length:</strong> {persona.conversationStyle.responseLength}</div>
                                <div><strong>Questions:</strong> {persona.conversationStyle.questionStyle}</div>
                                <div><strong>Focus:</strong> {persona.conversationStyle.focus}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              {personasConfig && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Selection Rules</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority Order</label>
                      <div className="flex flex-wrap gap-2">
                        {personasConfig.selectionRules.priorityOrder.map((personaId, index) => (
                          <Badge key={index} variant="outline">
                            {index + 1}. {personaId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Context Weighting</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><strong>Triggers:</strong> {personasConfig.selectionRules.contextWeighting.triggers}</div>
                        <div><strong>Emotional:</strong> {personasConfig.selectionRules.contextWeighting.emotionalIndicators}</div>
                        <div><strong>History:</strong> {personasConfig.selectionRules.contextWeighting.conversationHistory}</div>
                        <div><strong>Preferences:</strong> {personasConfig.selectionRules.contextWeighting.userPreferences}</div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Persona</label>
                      <Badge variant="secondary">{personasConfig.selectionRules.fallbackPersona}</Badge>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}