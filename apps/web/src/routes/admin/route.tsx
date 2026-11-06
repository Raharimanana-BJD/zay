import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import AccessDenied from "@/components/admin/access-denied";
import AdminShell from "@/components/admin/admin-shell";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

// This guard is a comfort only. The real check is on every server procedure.
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    return { user: session.data.user };
  },
  pendingComponent: () => (
    <div className="h-svh">
      <Loader />
    </div>
  ),
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  if (user.role !== "admin" && user.role !== "support") {
    return <AccessDenied />;
  }
  return (
    <AdminShell user={user}>
      <Outlet />
    </AdminShell>
  );
}
