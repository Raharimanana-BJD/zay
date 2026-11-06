import { createFileRoute, redirect } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  // The session cookie belongs to the API server, so only the browser can read it.
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/admin" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2">
          <img
            alt=""
            className="size-9"
            height={36}
            src="/logo.png"
            width={36}
          />
          <span className="font-bold text-xl">Zay</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-4xl">Connexion</h1>
            <p className="mt-2 mb-8 text-muted-foreground">
              Espace réservé à l'équipe Zay.
            </p>
            <SignInForm />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">Toliara, Madagascar</p>
      </div>
      <aside className="hidden flex-col justify-end gap-6 bg-primary p-12 text-primary-foreground lg:flex">
        <p className="max-w-md font-bold text-4xl leading-tight">
          Toutes les courses de Toliara, au même endroit.
        </p>
        <ul className="grid max-w-md gap-2 text-base text-white/80">
          <li>Suivez les réservations et les signalements.</li>
          <li>Validez les dossiers des chauffeurs.</li>
          <li>Réglez les tarifs sans mettre à jour l'application.</li>
        </ul>
      </aside>
    </main>
  );
}
