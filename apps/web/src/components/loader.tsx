import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div
      className="flex h-full min-h-40 items-center justify-center"
      role="status"
    >
      <Loader2 aria-hidden="true" className="animate-spin" />
      <span className="sr-only">Chargement</span>
    </div>
  );
}
