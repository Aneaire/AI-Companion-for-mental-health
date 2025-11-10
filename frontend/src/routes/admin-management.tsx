import { createRoute, createFileRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Settings, Save, Plus, Edit, Trash2 } from "lucide-react";

export const Route = createRoute("/admin-management")({
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

function AdminManagementContent() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

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
                <h3 className="text-lg font-semibold mb-4">User Management</h3>
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    User management features will be available here. You can manage user roles, permissions, and access levels.
                  </AlertDescription>
                </Alert>
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