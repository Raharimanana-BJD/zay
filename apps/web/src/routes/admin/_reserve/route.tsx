import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShieldAlertIcon } from "lucide-react";

export const Route = createFileRoute("/admin/_reserve")({
  component: AdminOnlyLayout,
});

function AdminOnlyLayout() {
  const { user } = Route.useRouteContext();
  if (user.role === "admin") {
    return <Outlet />;
  }
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-muted px-6 py-16 text-center">
      <ShieldAlertIcon aria-hidden="true" className="size-10" />
      <h1 className="text-3xl sm:text-4xl">
        Page réservée aux administrateurs
      </h1>
      <p className="max-w-md text-muted-foreground">
        Votre rôle ne donne pas accès à cette page. Demandez à un administrateur
        si vous avez besoin d'y faire un changement.
      </p>
    </div>
  );
}
