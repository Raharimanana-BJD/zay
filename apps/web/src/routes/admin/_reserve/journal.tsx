import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABELS, labelOf } from "@/lib/labels";
import { useTRPC } from "@/utils/trpc";

const ACTIONS = [
  "account.banned",
  "account.unbanned",
  "team.created",
  "team.role_changed",
] as const;

const searchSchema = z.object({
  action: z.enum(ACTIONS).optional().catch(undefined),
  page: z.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/admin/_reserve/journal")({
  validateSearch: searchSchema,
  component: JournalPage,
});

function Values({ values }: { values: Record<string, unknown> | null }) {
  if (!values) {
    return <span className="text-muted-foreground">Aucune</span>;
  }
  return (
    <ul className="grid gap-0.5">
      {Object.entries(values).map(([key, value]) => (
        <li key={key}>
          <span className="text-muted-foreground">{key} :</span> {String(value)}
        </li>
      ))}
    </ul>
  );
}

function JournalPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.audit.list.queryOptions(search, {
      placeholderData: keepPreviousData,
    })
  );
  const update = (change: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (previous) => ({ ...previous, page: 1, ...change }) });

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Toutes les actions sensibles, avec leur auteur."
        title="Journal"
      />
      <div className="flex flex-wrap items-end gap-4">
        <LabeledSelect
          allLabel="Toutes les actions"
          label="Action"
          onChange={(action) =>
            update({ action: action as (typeof ACTIONS)[number] | undefined })
          }
          options={AUDIT_ACTION_LABELS}
          value={search.action}
        />
      </div>
      <QueryState query={query}>
        {({ items, total }) =>
          items.length === 0 ? (
            <EmptyState
              description="Les actions sensibles apparaîtront ici."
              title="Aucune ligne"
            />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Avant</TableHead>
                    <TableHead>Après</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow className="align-top" key={item.id}>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell>{item.actorName ?? "Système"}</TableCell>
                      <TableCell>
                        {labelOf(AUDIT_ACTION_LABELS, item.action)}
                      </TableCell>
                      <TableCell>{item.targetName ?? item.targetId}</TableCell>
                      <TableCell>
                        <Values values={item.before} />
                      </TableCell>
                      <TableCell>
                        <Values values={item.after} />
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
