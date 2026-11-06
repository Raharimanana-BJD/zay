import { Button } from "@zay-app/ui/components/button";
import { ShieldXIcon } from "lucide-react";

import { useSignOut } from "@/lib/use-sign-out";

/** Shown to a signed in account that is not part of the team. */
export default function AccessDenied() {
  const signOut = useSignOut();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldXIcon aria-hidden="true" className="size-10" />
      <h1 className="text-4xl">Accès réservé à l'équipe</h1>
      <p className="max-w-md text-muted-foreground">
        Ce compte ne donne pas accès à l'espace admin. Pour réserver une course
        ou conduire, utilisez l'application mobile Zay.
      </p>
      <Button onClick={signOut} size="lg">
        Se déconnecter
      </Button>
    </main>
  );
}
