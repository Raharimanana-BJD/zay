import { useRouter } from "@tanstack/react-router";
import { Button } from "@zay-app/ui/components/button";
import { CloudOffIcon } from "lucide-react";

/** Shown when a page cannot load at all, for example if the API server does not answer. */
export default function RouteError() {
  const router = useRouter();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <CloudOffIcon aria-hidden="true" className="size-10" />
      <h1 className="text-4xl">Le serveur ne répond pas</h1>
      <p className="max-w-md text-muted-foreground">
        Cette page n'a pas pu se charger. Vérifiez votre connexion, puis
        réessayez.
      </p>
      <Button onClick={() => router.invalidate()} size="lg">
        Réessayer
      </Button>
    </main>
  );
}
