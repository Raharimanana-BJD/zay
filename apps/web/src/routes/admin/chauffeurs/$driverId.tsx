import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@zay-app/ui/components/badge";
import { Button } from "@zay-app/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zay-app/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zay-app/ui/components/table";
import { useState } from "react";

import ActionDialog from "@/components/admin/action-dialog";
import BanControls from "@/components/admin/ban-controls";
import {
  BackLink,
  Details,
  Section,
  Timeline,
} from "@/components/admin/detail";
import PageHeader from "@/components/admin/page-header";
import { EmptyState, QueryState } from "@/components/admin/query-state";
import RecentBookings from "@/components/admin/recent-bookings";
import StatusBadge from "@/components/admin/status-badge";
import { banReasonText } from "@/lib/ban-reason";
import { formatDateTime, formatDay, todayIsoDay } from "@/lib/format";
import {
  activityLabel,
  CATEGORY_LABELS,
  DOCUMENT_TYPE_LABELS,
  EMPLOYMENT_LABELS,
  labelOf,
  REJECTION_REASON_LABELS,
  reasonLabel,
  SUBJECT_LABELS,
  SUSPENSION_REASON_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@/lib/labels";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Detail = RouterOutputs["admin"]["drivers"]["get"];
type Subject = "driver" | "vehicle" | "document";
type Blocker = Detail["blockers"][number];

export const Route = createFileRoute("/admin/chauffeurs/$driverId")({
  component: DriverPage,
});

function blockerText(blockers: Blocker[], documents: Detail["documents"]) {
  return blockers
    .map(({ documentId, code }) => {
      if (code === "NO_DOCUMENT") {
        return "Aucune pièce envoyée.";
      }
      const document = documents.find((item) => item.id === documentId);
      const name = document
        ? labelOf(DOCUMENT_TYPE_LABELS, document.typeCode)
        : "Une pièce";
      return code === "EXPIRED"
        ? `${name} : expirée.`
        : `${name} : pas encore approuvée.`;
    })
    .join(" ");
}

/** The decision buttons for one element. Support accounts never see them. */
function Decisions({
  subject,
  subjectId,
  status,
  canApprove,
  approveHint,
}: {
  subject: Subject;
  subjectId: string;
  status: string;
  canApprove: boolean;
  approveHint?: string;
}) {
  const trpc = useTRPC();
  const decide = useMutation(trpc.admin.drivers.decide.mutationOptions());
  const isDocument = subject === "document";
  const send =
    (next: "approved" | "rejected" | "changes_requested" | "suspended") =>
    async ({
      date,
      reasonCode,
      reasonNote,
    }: {
      date?: string;
      reasonCode?: string;
      reasonNote?: string;
    }) => {
      await decide.mutateAsync({
        subject,
        subjectId,
        status: next,
        reasonCode,
        reasonNote,
        // Only a document approval carries an expiry date (spec 0005, AC-17).
        expiresAt: isDocument && next === "approved" ? date : undefined,
      });
    };
  const name = labelOf(SUBJECT_LABELS, subject).toLowerCase();

  if (status === "approved" && subject !== "document") {
    return (
      <ActionDialog
        confirmLabel="Suspendre"
        danger
        description="Ses offres ouvertes sont annulées. Une course active continue, et le compte reste connecté."
        label="Suspendre l'activité"
        onConfirm={send("suspended")}
        reasons={SUSPENSION_REASON_LABELS}
        success="Activité suspendue."
        title={`Suspendre ce ${name} ?`}
      />
    );
  }
  if (status === "suspended" && subject !== "document") {
    return (
      <div className="grid gap-1">
        <ActionDialog
          confirmLabel="Réactiver"
          disabled={!canApprove}
          label="Réactiver"
          onConfirm={send("approved")}
          success="Activité réactivée."
          title={`Réactiver ce ${name} ?`}
        />
        {!canApprove && approveHint ? (
          <p className="text-destructive text-sm">{approveHint}</p>
        ) : null}
      </div>
    );
  }
  if (status !== "pending" && status !== "changes_requested") {
    return null;
  }
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        <ActionDialog
          confirmLabel="Approuver"
          dateHint={
            isDocument
              ? "Laissez vide si la pièce n'expire pas. Elle reste valable jusqu'à la fin de ce jour."
              : undefined
          }
          dateLabel={isDocument ? "Date d'expiration" : undefined}
          dateMin={isDocument ? todayIsoDay() : undefined}
          disabled={!canApprove}
          label="Approuver"
          onConfirm={send("approved")}
          success="Décision enregistrée."
          title={`Approuver ce ${name} ?`}
          triggerVariant="default"
        />
        <ActionDialog
          confirmLabel="Demander un complément"
          label="Complément"
          onConfirm={send("changes_requested")}
          reasons={REJECTION_REASON_LABELS}
          success="Décision enregistrée."
          title="Demander un complément"
        />
        <ActionDialog
          confirmLabel="Rejeter"
          danger
          label="Rejeter"
          onConfirm={send("rejected")}
          reasons={REJECTION_REASON_LABELS}
          success="Décision enregistrée."
          title={`Rejeter ce ${name} ?`}
        />
      </div>
      {!canApprove && approveHint ? (
        <p className="text-destructive text-sm">{approveHint}</p>
      ) : null}
    </div>
  );
}

function DocumentViewer({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const trpc = useTRPC();
  const file = useQuery(
    trpc.admin.drivers.documentUrl.queryOptions(
      { documentId },
      { enabled: open, retry: false, staleTime: 0, gcTime: 0 }
    )
  );
  return (
    <>
      <Button
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        size="sm"
        variant="outline"
      >
        Voir
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {file.data?.fileKind === "pdf" ? (
            <div className="grid gap-2">
              {/* The browser PDF viewer shows the file; it runs no script from this page. */}
              <object
                aria-label={title}
                className="h-[480px] w-full rounded-lg border"
                data={file.data.url}
                type="application/pdf"
              >
                <p>Ce navigateur n'affiche pas les PDF ici.</p>
              </object>
              <a
                className="font-medium text-sm underline underline-offset-4"
                href={file.data.url}
                rel="noopener"
                target="_blank"
              >
                Ouvrir
              </a>
            </div>
          ) : null}
          {file.data && file.data.fileKind === "image" && !failed ? (
            <img
              alt={title}
              className="w-full rounded-lg"
              onError={() => setFailed(true)}
              src={file.data.url}
            />
          ) : null}
          {file.isError || failed ? (
            <p role="alert">Fichier indisponible</p>
          ) : null}
          {file.isPending && open ? <p>Chargement...</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentsTable({
  documents,
  isAdmin,
}: {
  documents: Detail["documents"];
  isAdmin: boolean;
}) {
  if (documents.length === 0) {
    return <EmptyState title="Aucune pièce" />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pièce</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Expiration</TableHead>
          <TableHead>Fichier</TableHead>
          {isAdmin ? <TableHead>Décision</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const name = labelOf(DOCUMENT_TYPE_LABELS, doc.typeCode);
          return (
            <TableRow key={doc.id}>
              <TableCell>{name}</TableCell>
              <TableCell>
                <StatusBadge kind="verification" status={doc.status} />
              </TableCell>
              <TableCell>
                {doc.expiresAt ? (
                  <span
                    className={
                      doc.isExpired ? "font-medium text-destructive" : undefined
                    }
                  >
                    {formatDay(doc.expiresAt)}
                    {doc.isExpired ? " (expirée)" : ""}
                  </span>
                ) : (
                  "Aucune"
                )}
              </TableCell>
              <TableCell>
                <DocumentViewer documentId={doc.id} title={name} />
              </TableCell>
              {isAdmin ? (
                <TableCell>
                  <Decisions
                    approveHint={doc.isExpired ? "Pièce expirée." : undefined}
                    canApprove={!doc.isExpired}
                    status={doc.status}
                    subject="document"
                    subjectId={doc.id}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DriverContent({
  detail,
  isAdmin,
}: {
  detail: Detail;
  isAdmin: boolean;
}) {
  const personal = detail.documents.filter((doc) => doc.vehicleId === null);
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        action={
          isAdmin ? (
            <BanControls
              banned={detail.banned}
              name={detail.name}
              suspensionIncomplete={detail.suspensionIncomplete}
              userId={detail.userId}
            />
          ) : null
        }
        description={detail.phone ?? "Téléphone non renseigné"}
        title={detail.name}
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge kind="verification" status={detail.status} />
        {detail.isSimulated ? <Badge variant="outline">Simulé</Badge> : null}
        {detail.banned ? (
          <Badge variant="destructive">Compte suspendu</Badge>
        ) : null}
      </div>
      <Section
        action={
          isAdmin ? (
            <Decisions
              approveHint={blockerText(detail.blockers, detail.documents)}
              canApprove={detail.canApprove}
              status={detail.status}
              subject="driver"
              subjectId={detail.userId}
            />
          ) : null
        }
        title="Dossier"
      >
        <Details
          rows={[
            {
              label: "Relation professionnelle",
              value: labelOf(EMPLOYMENT_LABELS, detail.employmentRelation),
            },
            { label: "Email", value: detail.email },
            {
              label: "Activité",
              value: activityLabel(detail.isOnline, detail.isAvailable),
            },
            ...(detail.banned
              ? [
                  {
                    label: "Motif de suspension du compte",
                    value: banReasonText(detail.banReason),
                  },
                ]
              : []),
          ]}
        />
      </Section>
      <Section title="Pièces personnelles">
        <DocumentsTable documents={personal} isAdmin={isAdmin} />
      </Section>
      {detail.vehicles.map((vehicle) => (
        <Section
          action={
            isAdmin ? (
              <Decisions
                approveHint={blockerText(vehicle.blockers, detail.documents)}
                canApprove={vehicle.canApprove}
                status={vehicle.status}
                subject="vehicle"
                subjectId={vehicle.id}
              />
            ) : null
          }
          key={vehicle.id}
          title={`${vehicle.make ?? ""} ${vehicle.model}`.trim()}
        >
          <div className="grid grid-cols-1 gap-4">
            <Details
              rows={[
                {
                  label: "Statut",
                  value: (
                    <StatusBadge kind="verification" status={vehicle.status} />
                  ),
                },
                {
                  label: "Catégorie",
                  value: labelOf(CATEGORY_LABELS, vehicle.category),
                },
                { label: "Immatriculation", value: vehicle.registration },
                { label: "Capacité", value: `${vehicle.capacity} places` },
              ]}
            />
            <DocumentsTable
              documents={detail.documents.filter(
                (doc) => doc.vehicleId === vehicle.id
              )}
              isAdmin={isAdmin}
            />
          </div>
        </Section>
      ))}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Section title="Décisions">
          {detail.decisions.length === 0 ? (
            <EmptyState title="Aucune décision" />
          ) : (
            <Timeline
              items={detail.decisions.map((decision) => ({
                id: decision.id,
                title: `${labelOf(SUBJECT_LABELS, decision.subject)} : ${labelOf(VERIFICATION_STATUS_LABELS, decision.status)}`,
                meta: `${formatDateTime(decision.createdAt)}, ${decision.decidedByName}`,
                body:
                  decision.reasonCode || decision.reasonNote
                    ? [
                        decision.reasonCode
                          ? reasonLabel(decision.reasonCode)
                          : null,
                        decision.reasonNote,
                      ]
                        .filter(Boolean)
                        .join(" : ")
                    : null,
              }))}
            />
          )}
        </Section>
        <Section title="10 dernières réservations">
          <RecentBookings bookings={detail.bookings} />
        </Section>
      </div>
    </div>
  );
}

function DriverPage() {
  const { driverId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const trpc = useTRPC();
  const query = useQuery(trpc.admin.drivers.get.queryOptions({ driverId }));
  return (
    <div className="grid grid-cols-1 gap-4">
      <BackLink label="Chauffeurs" to="/admin/chauffeurs" />
      <QueryState query={query}>
        {(detail) => (
          <DriverContent detail={detail} isAdmin={user.role === "admin"} />
        )}
      </QueryState>
    </div>
  );
}
