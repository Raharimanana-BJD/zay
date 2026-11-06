import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import ActionDialog from "@/components/admin/action-dialog";
import {
  BackLink,
  Details,
  Section,
  Timeline,
} from "@/components/admin/detail";
import PageHeader from "@/components/admin/page-header";
import { QueryState } from "@/components/admin/query-state";
import StatusBadge from "@/components/admin/status-badge";
import { formatDateTime } from "@/lib/format";
import {
  labelOf,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  ROLE_LABELS,
} from "@/lib/labels";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Detail = RouterOutputs["admin"]["reports"]["get"];

export const Route = createFileRoute("/admin/signalements/$reportId")({
  component: ReportPage,
});

function ReportActions({
  reportId,
  status,
}: {
  reportId: string;
  status: string;
}) {
  const trpc = useTRPC();
  const take = useMutation(trpc.admin.reports.take.mutationOptions());
  const addNote = useMutation(trpc.admin.reports.addNote.mutationOptions());
  const change = useMutation(trpc.admin.reports.changeStatus.mutationOptions());

  const changeTo =
    (to: "resolved" | "in_progress" | "closed") =>
    async ({ reasonNote }: { reasonNote?: string }) => {
      await change.mutateAsync({ reportId, to, note: reasonNote });
    };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "closed" ? null : (
        <ActionDialog
          confirmLabel="Ajouter"
          label="Ajouter une note"
          noteRequired
          onConfirm={async ({ reasonNote }) => {
            await addNote.mutateAsync({ reportId, note: reasonNote as string });
          }}
          success="Note ajoutée."
          title="Ajouter une note"
        />
      )}
      {status === "open" ? (
        <ActionDialog
          confirmLabel="Prendre en charge"
          label="Prendre en charge"
          onConfirm={async ({ reasonNote }) => {
            await take.mutateAsync({ reportId, note: reasonNote });
          }}
          success="Signalement pris en charge."
          title="Prendre en charge ce signalement ?"
          triggerVariant="default"
        />
      ) : null}
      {status === "in_progress" ? (
        <ActionDialog
          confirmLabel="Résoudre"
          label="Résoudre"
          noteRequired
          onConfirm={changeTo("resolved")}
          success="Signalement résolu."
          title="Résoudre ce signalement"
          triggerVariant="default"
        />
      ) : null}
      {status === "resolved" ? (
        <>
          <ActionDialog
            confirmLabel="Rouvrir"
            label="Rouvrir"
            noteRequired
            onConfirm={changeTo("in_progress")}
            success="Signalement rouvert."
            title="Rouvrir ce signalement"
          />
          <ActionDialog
            confirmLabel="Clore"
            description="Un signalement clos ne peut plus changer."
            label="Clore"
            onConfirm={changeTo("closed")}
            success="Signalement clos."
            title="Clore ce signalement ?"
            triggerVariant="default"
          />
        </>
      ) : null}
    </div>
  );
}

function ReportContent({ detail }: { detail: Detail }) {
  const { report } = detail;
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        action={<ReportActions reportId={report.id} status={report.status} />}
        description={`Créé le ${formatDateTime(report.createdAt)}`}
        title={labelOf(REPORT_TYPE_LABELS, report.typeCode)}
      />
      <div>
        <StatusBadge kind="report" status={report.status} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Section title="Détail">
          <div className="grid grid-cols-1 gap-4">
            <p className="whitespace-pre-wrap text-sm">
              {report.description ?? "Aucune description."}
            </p>
            <Details
              rows={[
                {
                  label: "Auteur",
                  value: `${detail.authorName} (${labelOf(ROLE_LABELS, detail.authorRole ?? "")})`,
                },
                { label: "Téléphone", value: detail.authorPhone },
                {
                  label: "Suivi par",
                  value: detail.assigneeName ?? "Personne",
                },
                {
                  label: "Réservation",
                  value: report.bookingId ? (
                    <Link
                      className="underline"
                      params={{ bookingId: report.bookingId }}
                      to="/admin/reservations/$bookingId"
                    >
                      {detail.bookingCreatedAt
                        ? formatDateTime(detail.bookingCreatedAt)
                        : "Voir"}
                    </Link>
                  ) : (
                    "Aucune"
                  ),
                },
              ]}
            />
          </div>
        </Section>
        <Section title="Historique">
          {detail.events.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun geste pour l'instant.
            </p>
          ) : (
            <Timeline
              items={detail.events.map((event) => ({
                id: event.id,
                title: event.toStatus
                  ? labelOf(REPORT_STATUS_LABELS, event.toStatus)
                  : "Note",
                meta: `${formatDateTime(event.createdAt)}, ${event.actorName}`,
                body: event.note,
              }))}
            />
          )}
        </Section>
      </div>
    </div>
  );
}

function ReportPage() {
  const { reportId } = Route.useParams();
  const trpc = useTRPC();
  const query = useQuery(trpc.admin.reports.get.queryOptions({ reportId }));
  return (
    <div className="grid grid-cols-1 gap-4">
      <BackLink label="Signalements" to="/admin/signalements" />
      <QueryState query={query}>
        {(detail) => <ReportContent detail={detail} />}
      </QueryState>
    </div>
  );
}
