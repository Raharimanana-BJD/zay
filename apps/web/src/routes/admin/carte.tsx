import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import LiveMap from "@/components/admin/live-map";
import PageHeader from "@/components/admin/page-header";
import { QueryState } from "@/components/admin/query-state";
import { useTRPC } from "@/utils/trpc";

const REFRESH_MS = 5000;

export const Route = createFileRoute("/admin/carte")({
  component: MapPage,
});

function MapPage() {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.liveMap.drivers.queryOptions(undefined, {
      refetchInterval: REFRESH_MS,
    })
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Chauffeurs en ligne, actualisés toutes les 5 secondes."
        title="Carte"
      />
      <QueryState query={query}>
        {({ items }) => (
          <LiveMap drivers={items} isDisconnected={query.isRefetchError} />
        )}
      </QueryState>
    </div>
  );
}
