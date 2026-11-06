import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zay-app/ui/components/table";
import z from "zod";

import { LabeledSelect, Pagination } from "@/components/admin/list-controls";
import PageHeader from "@/components/admin/page-header";
import { EmptyState, QueryState } from "@/components/admin/query-state";
import StatusBadge from "@/components/admin/status-badge";
import { formatDateTime } from "@/lib/format";
import {
  labelOf,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
} from "@/lib/labels";
import { useTRPC } from "@/utils/trpc";

const REFRESH_MS = 10_000;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const TYPES = [
  "client_absent",
  "driver_absent",
  "payment_issue",
  "safety",
  "help",
  "other",
] as const;

const searchSchema = z.object({
  status: z.enum(STATUSES).optional().catch(undefined),
  typeCode: z.enum(TYPES).optional().catch(undefined),
  page: z.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/admin/signalements/")({
  validateSearch: searchSchema,
  component: ReportsPage,
});

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.reports.list.queryOptions(search, {
      refetchInterval: REFRESH_MS,
      placeholderData: keepPreviousData,
    })
  );
  const update = (change: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (previous) => ({ ...previous, page: 1, ...change }) });

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Traitez les incidents jusqu'à leur clôture."
        title="Signalements"
      />
      <div className="flex flex-wrap items-end gap-4">
        <LabeledSelect
          allLabel="Tous les statuts"
          label="Statut"
          onChange={(status) =>
            update({ status: status as (typeof STATUSES)[number] | undefined })
          }
          options={REPORT_STATUS_LABELS}
          value={search.status}
        />
        <LabeledSelect
          allLabel="Tous les types"
          label="Type"
          onChange={(typeCode) =>
            update({ typeCode: typeCode as (typeof TYPES)[number] | undefined })
          }
          options={REPORT_TYPE_LABELS}
          value={search.typeCode}
        />
      </div>
      <QueryState query={query}>
        {({ items, total }) =>
          items.length === 0 ? (
            <EmptyState
              description="Essayez d'autres filtres."
              title="Aucun signalement"
            />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Suivi par</TableHead>
                    <TableHead>Réservation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          className="underline"
                          params={{ reportId: item.id }}
                          to="/admin/signalements/$reportId"
                        >
                          {formatDateTime(item.createdAt)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="report" status={item.status} />
                      </TableCell>
                      <TableCell>
                        {labelOf(REPORT_TYPE_LABELS, item.typeCode)}
                      </TableCell>
                      <TableCell>{item.authorName}</TableCell>
                      <TableCell>{item.assigneeName ?? "Personne"}</TableCell>
                      <TableCell>{item.bookingId ? "Oui" : "Non"}</TableCell>
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
