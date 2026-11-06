import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
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
import { formatDateTime, priceLabel } from "@/lib/format";
import { BOOKING_STATUS_LABELS, CATEGORY_LABELS, labelOf } from "@/lib/labels";
import { useTRPC } from "@/utils/trpc";

const REFRESH_MS = 10_000;
const STATUSES = [
  "PENDING",
  "SEARCHING",
  "OFFERED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_DRIVER_FOUND",
  "DISPUTED",
] as const;

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/admin/reservations/")({
  validateSearch: searchSchema,
  component: BookingsPage,
});

function BookingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.bookings.list.queryOptions(search, {
      refetchInterval: REFRESH_MS,
      placeholderData: keepPreviousData,
    })
  );
  const update = (change: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (previous) => ({ ...previous, page: 1, ...change }) });

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Suivez chaque course et son histoire."
        title="Réservations"
      />
      <div className="flex flex-wrap items-end gap-4">
        <SearchField
          onSearch={(q) => update({ q })}
          placeholder="Nom ou téléphone"
          value={search.q}
        />
        <LabeledSelect
          allLabel="Tous les statuts"
          label="Statut"
          onChange={(status) =>
            update({ status: status as (typeof STATUSES)[number] | undefined })
          }
          options={BOOKING_STATUS_LABELS}
          value={search.status}
        />
        <div className="grid gap-2">
          <Label htmlFor="from">Du</Label>
          <Input
            id="from"
            onChange={(event) =>
              update({ from: event.target.value || undefined })
            }
            type="date"
            value={search.from ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="to">Au</Label>
          <Input
            id="to"
            onChange={(event) =>
              update({ to: event.target.value || undefined })
            }
            type="date"
            value={search.to ?? ""}
          />
        </div>
      </div>
      <QueryState query={query}>
        {({ items, total }) =>
          items.length === 0 ? (
            <EmptyState
              description="Essayez d'autres filtres."
              title="Aucune réservation"
            />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Chauffeur</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Trajet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          className="underline"
                          params={{ bookingId: item.id }}
                          to="/admin/reservations/$bookingId"
                        >
                          {formatDateTime(item.createdAt)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="booking" status={item.status} />
                      </TableCell>
                      <TableCell>{item.clientName}</TableCell>
                      <TableCell>{item.driverName ?? "Aucun"}</TableCell>
                      <TableCell>
                        {labelOf(CATEGORY_LABELS, item.category)}
                      </TableCell>
                      <TableCell>
                        {priceLabel(item.agreedPriceAr, item.estimatedPriceAr)}
                      </TableCell>
                      <TableCell>
                        {item.pickup} → {item.destination}
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
