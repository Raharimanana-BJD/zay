import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@zay-app/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zay-app/ui/components/table";
import z from "zod";

import {
  LabeledSelect,
  Pagination,
  SearchField,
} from "@/components/admin/list-controls";
import PageHeader from "@/components/admin/page-header";
import { EmptyState, QueryState } from "@/components/admin/query-state";
import StatusBadge from "@/components/admin/status-badge";
import { activityLabel, VERIFICATION_STATUS_LABELS } from "@/lib/labels";
import { useTRPC } from "@/utils/trpc";

const STATUSES = [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
  "suspended",
] as const;

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  page: z.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/admin/chauffeurs/")({
  validateSearch: searchSchema,
  component: DriversPage,
});

function DriversPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.drivers.list.queryOptions(search, {
      placeholderData: keepPreviousData,
    })
  );
  const update = (change: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (previous) => ({ ...previous, page: 1, ...change }) });

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Consultez les dossiers et décidez."
        title="Chauffeurs"
      />
      <div className="flex flex-wrap items-end gap-4">
        <SearchField
          onSearch={(q) => update({ q })}
          placeholder="Nom ou téléphone"
          value={search.q}
        />
        <LabeledSelect
          allLabel="Tous les statuts"
          label="Dossier"
          onChange={(status) =>
            update({ status: status as (typeof STATUSES)[number] | undefined })
          }
          options={VERIFICATION_STATUS_LABELS}
          value={search.status}
        />
      </div>
      <QueryState query={query}>
        {({ items, total }) =>
          items.length === 0 ? (
            <EmptyState
              description="Essayez d'autres filtres."
              title="Aucun chauffeur"
            />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Dossier</TableHead>
                    <TableHead>Activité</TableHead>
                    <TableHead>Repères</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.userId}>
                      <TableCell>
                        <Link
                          className="underline"
                          params={{ driverId: item.userId }}
                          to="/admin/chauffeurs/$driverId"
                        >
                          {item.name}
                        </Link>
                      </TableCell>
                      <TableCell>{item.phone ?? "Non renseigné"}</TableCell>
                      <TableCell>
                        <StatusBadge kind="verification" status={item.status} />
                      </TableCell>
                      <TableCell>
                        {activityLabel(item.isOnline, item.isAvailable)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {item.isSimulated ? (
                            <Badge variant="outline">Simulé</Badge>
                          ) : null}
                          {item.banned ? (
                            <Badge variant="destructive">Compte suspendu</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                onPageChange={(page) => update({ page })}
                page={search.page}
                total={total}
              />
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
