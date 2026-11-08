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
import { formatDateTime } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  banned: z.boolean().optional().catch(undefined),
  page: z.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/admin/clients/")({
  validateSearch: searchSchema,
  component: ClientsPage,
});

function ClientsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.accounts.listClients.queryOptions(search, {
      placeholderData: keepPreviousData,
    })
  );
  const update = (change: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (previous) => ({ ...previous, page: 1, ...change }) });
  let bannedValue: string | undefined;
  if (search.banned !== undefined) {
    bannedValue = search.banned ? "yes" : "no";
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Retrouvez les comptes clients."
        title="Clients"
      />
      <div className="flex flex-wrap items-end gap-4">
        <SearchField
          onSearch={(q) => update({ q })}
          placeholder="Nom, email ou téléphone"
          value={search.q}
        />
        <LabeledSelect
          allLabel="Tous les comptes"
          label="État"
          onChange={(value) =>
            update({
              banned: value === undefined ? undefined : value === "yes",
            })
          }
          options={{ no: "Actifs", yes: "Suspendus" }}
          value={bannedValue}
        />
      </div>
      <QueryState query={query}>
        {({ items, total }) =>
          items.length === 0 ? (
            <EmptyState
              description="Essayez d'autres filtres."
              title="Aucun client"
            />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Inscrit le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          className="underline"
                          params={{ clientId: item.id }}
                          to="/admin/clients/$clientId"
                        >
                          {item.name}
                        </Link>
                      </TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell>{item.phone ?? "Non renseigné"}</TableCell>
                      <TableCell>
                        {item.banned ? (
                          <Badge variant="destructive">Suspendu</Badge>
                        ) : (
                          <Badge variant="secondary">Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
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
