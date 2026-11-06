import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@zay-app/ui/components/badge";

import BanControls from "@/components/admin/ban-controls";
import { BackLink, Details, Section } from "@/components/admin/detail";
import PageHeader from "@/components/admin/page-header";
import { QueryState } from "@/components/admin/query-state";
import RecentBookings from "@/components/admin/recent-bookings";
import { banReasonText } from "@/lib/ban-reason";
import { formatDateTime } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/clients/$clientId")({
  component: ClientPage,
});

function ClientPage() {
  const { clientId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.accounts.getClient.queryOptions({ userId: clientId })
  );
  return (
    <div className="grid grid-cols-1 gap-4">
      <BackLink label="Clients" to="/admin/clients" />
      <QueryState query={query}>
        {(client) => (
          <div className="grid grid-cols-1 gap-6">
            <PageHeader
              action={
                user.role === "admin" ? (
                  <BanControls
                    banned={client.banned}
                    name={client.name}
                    suspensionIncomplete={client.suspensionIncomplete}
                    userId={client.id}
                  />
                ) : null
              }
              description={client.email}
              title={client.name}
            />
            <Section title="Identité">
              <Details
                rows={[
                  { label: "Téléphone", value: client.phone },
                  { label: "Email", value: client.email },
                  {
                    label: "Inscrit le",
                    value: formatDateTime(client.createdAt),
                  },
                  {
                    label: "État du compte",
                    value: client.banned ? (
                      <Badge variant="destructive">Suspendu</Badge>
                    ) : (
                      <Badge variant="secondary">Actif</Badge>
                    ),
                  },
                  ...(client.banned
                    ? [
                        {
                          label: "Motif de suspension",
                          value: banReasonText(client.banReason),
                        },
                      ]
                    : []),
                ]}
              />
            </Section>
            <Section title="10 dernières réservations">
              <RecentBookings bookings={client.bookings} />
            </Section>
          </div>
        )}
      </QueryState>
    </div>
  );
}
