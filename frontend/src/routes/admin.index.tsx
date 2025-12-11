import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
// import { PersonaSelectionAnalytics } from "@/components/admin/PersonaSelectionAnalytics";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { Shield, Users } from "lucide-react";

interface MetricsData {
  threadMetrics: {
    total: number;
    withSessions: number;
    percentageWithSessions: number;
  };
  sessionMetrics: {
    total: number;
    completed: number;
    completionRate: number;
  };
  messageMetrics: {
    total: number;
    averagePerSession: number;
  };
  formMetrics: {
    total: number;
    completionRate: number;
  };
}

interface PersonaAnalytics {
  historicalAnalytics: Array<{
    personaId: number;
    totalSelections: number;
    lastSelectedAt: string;
  }>;
  currentCache: Array<{
    personaId: number;
    currentSelections: number;
    cachePeriodStart: string;
    cachePeriodEnd: string;
  }>;
  period: string;
}

const personaIdMapping: Record<number, string> = {
  1: 'listener',
  2: 'guide',
  3: 'crisis',
  4: 'companion',
  5: 'anchor',
  6: 'confrontational',
  7: 'direct_engager',
};

const personaNames: Record<number, string> = {
  1: 'Empathetic Listener',
  2: 'Supportive Guide',
  3: 'Crisis Support',
  4: 'Friendly Companion',
  5: 'Calm Anchor',
  6: 'Direct Confrontational',
  7: 'Direct Engager',
};

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#6366f1'];

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <AdminProtectedRoute>
      <AdminDashboardContent />
    </AdminProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  const { data: metrics, isLoading } = useQuery<MetricsData>({
    queryKey: ["adminMetrics"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("/api/admin/metrics", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch metrics:", response.status, response.statusText);
        throw new Error("Failed to fetch metrics");
      }

      const data = await response.json();
      return data;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<PersonaAnalytics>({
    queryKey: ["personaAnalytics"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("/api/persona-cards/analytics", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch analytics:", response.status, response.statusText);
        throw new Error("Failed to fetch analytics");
      }

      const data = await response.json();
      return data;
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8">Loading metrics...</div>
      </AdminLayout>
    );
  }

  if (!metrics) {
    return (
      <AdminLayout>
        <div className="p-8">No metrics available</div>
      </AdminLayout>
    );
  }

  const userRole = user?.publicMetadata?.role as string;
  
  const sidebarContent = (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Dashboard Features</h4>
        <ul className="space-y-2 text-xs text-blue-700">
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            System metrics overview
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Persona analytics & insights
          </li>
          <li className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Usage pattern tracking
          </li>
        </ul>
      </div>
      
      {userRole === 'superadmin' && (
        <div className="p-3 bg-purple-50 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Quick Actions</h4>
          <div className="space-y-2">
            <Link
              to="/admin/role-management"
              className="flex items-center gap-2 p-2 text-xs text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Manage User Roles</span>
            </Link>
            <Link
              to="/admin-management"
              className="flex items-center gap-2 p-2 text-xs text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>User Management</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout sidebarContent={sidebarContent}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-6">
          <MetricCard
            title="Messages per Session"
            value={metrics.messageMetrics.averagePerSession.toFixed(1)}
            description="average"
          />
          
          <MetricCard
            title="Form Completion"
            value={`${metrics.formMetrics.completionRate.toFixed(1)}%`}
            description={`${metrics.formMetrics.total} forms submitted`}
          />
        </div>

        {/* Enhanced Analytics Section */}
        {/* <PersonaSelectionAnalytics
          analytics={analytics}
          analyticsLoading={analyticsLoading}
          personaNames={personaNames}
          personaIdMapping={personaIdMapping}
          COLORS={COLORS}
        /> */}
        </div>

        {/* Role Permissions Table */}
        <Card className="mt-8 mx-6">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Role Permissions</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Feature</th>
                    <th className="text-center py-3 px-4 font-semibold text-red-600">Superadmin</th>
                    <th className="text-center py-3 px-4 font-semibold text-blue-600">Admin</th>
                    <th className="text-center py-3 px-4 font-semibold text-yellow-600">Observer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">Admin Dashboard</td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">User Management</td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                  </tr>
                   <tr className="hover:bg-gray-50">
                     <td className="py-3 px-4 text-gray-900 font-medium">Counselor Management</td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                   </tr>
                   <tr className="hover:bg-gray-50">
                     <td className="py-3 px-4 text-gray-900 font-medium">Monitor Threads</td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                   </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">Quality Analysis</td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">System Settings</td>
                    <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                    <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                    <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                  </tr>
                   <tr className="hover:bg-gray-50">
                     <td className="py-3 px-4 text-gray-900 font-medium">Persona Configuration</td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                     <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                   </tr>
                   <tr className="hover:bg-gray-50">
                     <td className="py-3 px-4 text-gray-900 font-medium">Admin Management</td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                   </tr>
                   <tr className="hover:bg-gray-50">
                     <td className="py-3 px-4 text-gray-900 font-medium">Role Assignment</td>
                     <td className="text-center py-3 px-4"><span className="text-green-600 font-bold">✓</span></td>
                     <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                     <td className="text-center py-3 px-4"><span className="text-red-600 font-bold">✗</span></td>
                   </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Roles are managed through Clerk user metadata. Contact superadmin to change role assignments.
              </p>
            </div>
          </div>
        </Card>
    </AdminLayout>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Card>
  );
}