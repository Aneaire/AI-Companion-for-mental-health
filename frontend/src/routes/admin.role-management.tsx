import { createFileRoute } from "@tanstack/react-router";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import RoleManagement from "@/components/admin/RoleManagement";

function RoleManagementPage() {
  return (
    <AdminProtectedRoute>
      <RoleManagement />
    </AdminProtectedRoute>
  );
}

export const Route = createFileRoute("/admin/role-management")({
  component: RoleManagementPage,
});