import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@zay-app/ui/components/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl">Page introuvable</h1>
      <p className="text-muted-foreground">Cette adresse n'existe pas.</p>
      <Link className={buttonVariants()} to="/admin">
        Retour à l'espace admin
      </Link>
    </main>
  );
}
