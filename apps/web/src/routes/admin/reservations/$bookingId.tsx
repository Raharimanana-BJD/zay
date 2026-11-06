import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zay-app/ui/components/table";

import ActionDialog from "@/components/admin/action-dialog";
import {
  BackLink,
  Details,
  Section,
  Timeline,
} from "@/components/admin/detail";
import PageHeader from "@/components/admin/page-header";
import { EmptyState, QueryState } from "@/components/admin/query-state";
import StatusBadge from "@/components/admin/status-badge";
import { formatAr, formatDateTime } from "@/lib/format";
import {
  ACTOR_KIND_LABELS,
  BOOKING_EVENT_LABELS,
  BOOKING_STATUS_LABELS,
  CANCELLATION_REASON_LABELS,
  CATEGORY_LABELS,
  DESTINATION_STATUS_LABELS,
  DISPUTE_REASON_LABELS,
  labelOf,
  OFFER_STATUS_LABELS,
  PAYMENT_EVENT_LABELS,
  PAYMENT_RESOLUTION_LABELS,
  PROPOSAL_KIND_LABELS,
  reasonLabel,
} from "@/lib/labels";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Detail = RouterOutputs["admin"]["bookings"]["get"];

const CANCELLABLE = [
  "PENDING",
  "SEARCHING",
  "OFFERED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
];

export const Route = createFileRoute("/admin/reservations/$bookingId")({
  component: BookingPage,
});

const actorName = (kind: string, name: string | null) =>
  kind === "system"
    ? "Système"
    : `${name ?? "Inconnu"} (${labelOf(ACTOR_KIND_LABELS, kind)})`;

const reasonText = (code: string | null, note: string | null) =>
  code || note
    ? [code ? reasonLabel(code) : null, note].filter(Boolean).join(" : ")
    : null;

function BookingActions({ detail }: { detail: Detail }) {
  const trpc = useTRPC();
  const cancel = useMutation(trpc.admin.bookings.cancel.mutationOptions());
  const open = useMutation(trpc.admin.bookings.openDispute.mutationOptions());
  const close = useMutation(trpc.admin.bookings.closeDispute.mutationOptions());
  const bookingId = detail.booking.id;
  const { status } = detail.booking;

  if (CANCELLABLE.includes(status)) {
    return (
      <ActionDialog
        confirmLabel="Annuler la réservation"
        danger
        description="Le chauffeur et le prix sont gardés. Les offres ouvertes sont annulées."
        label="Annuler"
        onConfirm={async ({ clientRequestId, reasonCode, reasonNote }) => {
          await cancel.mutateAsync({
            bookingId,
            clientRequestId,
            reasonCode: reasonCode as string,
            reasonNote,
          });
        }}
        reasons={CANCELLATION_REASON_LABELS}
        success="Réservation annulée."
        title="Annuler cette réservation ?"
      />
    );
  }
  if (status === "COMPLETED") {
    return (
      <ActionDialog
        confirmLabel="Ouvrir le litige"
        label="Ouvrir un litige"
        onConfirm={async ({ clientRequestId, reasonCode, reasonNote }) => {
          await open.mutateAsync({
            bookingId,
            clientRequestId,
            reasonCode: reasonCode as string,
            reasonNote,
          });
        }}
        reasons={DISPUTE_REASON_LABELS}
        success="Litige ouvert."
        title="Ouvrir un litige ?"
      />
    );
  }
  if (status === "DISPUTED") {
    return (
      <ActionDialog
        confirmLabel="Fermer le litige"
        label="Fermer le litige"
        noteRequired
        onConfirm={async ({ clientRequestId, reasonNote }) => {
          await close.mutateAsync({
            bookingId,
            clientRequestId,
            reasonNote: reasonNote as string,
          });
        }}
        success="Litige fermé."
        title="Fermer ce litige ?"
      />
    );
  }
  return null;
}

function PaymentSection({
  payment,
}: {
  payment: NonNullable<Detail["payment"]>;
}) {
  const trpc = useTRPC();
  const resolve = useMutation(
    trpc.admin.bookings.resolvePayment.mutationOptions()
  );
  return (
    <Section
      action={
        payment.status === "disputed" ? (
          <ActionDialog
            amountLabel="Montant retenu (Ar)"
            confirmLabel="Résoudre"
            description={`Prix convenu : ${formatAr(payment.agreedAmountAr)}. Montant déclaré d'origine : ${payment.originalDeclaredAr === null ? "aucun" : formatAr(payment.originalDeclaredAr)}.`}
            label="Résoudre"
            onConfirm={async ({
              amount,
              clientRequestId,
              reasonCode,
              reasonNote,
            }) => {
              await resolve.mutateAsync({
                paymentId: payment.paymentId,
                retainedAmountAr: amount as number,
                reasonCode: reasonCode as string,
                reasonNote,
                clientRequestId,
              });
            }}
            reasons={PAYMENT_RESOLUTION_LABELS}
            success="Paiement résolu."
            title="Résoudre ce paiement contesté"
          />
        ) : null
      }
      title="Paiement"
    >
      <div className="grid grid-cols-1 gap-4">
        <Details
          rows={[
            {
              label: "Statut",
              value: <StatusBadge kind="payment" status={payment.status} />,
            },
            { label: "Prix convenu", value: formatAr(payment.agreedAmountAr) },
            {
              label: "Montant déclaré",
              value:
                payment.declaredAmountAr === null
                  ? "Aucun"
                  : formatAr(payment.declaredAmountAr),
            },
            { label: "Moyen", value: "Espèces" },
          ]}
        />
        {payment.events.length > 0 ? (
          <Timeline
            items={payment.events.map((event) => ({
              id: event.id,
              title: `${labelOf(PAYMENT_EVENT_LABELS, event.kind)}${event.amountAr === null ? "" : `, ${formatAr(event.amountAr)}`}`,
              meta: `${formatDateTime(event.createdAt)}, ${actorName(event.actorKind, event.actorName)}`,
              body: reasonText(event.reasonCode, event.reasonNote),
            }))}
          />
        ) : null}
      </div>
    </Section>
  );
}

function BookingContent({ detail }: { detail: Detail }) {
  const { booking } = detail;
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        action={<BookingActions detail={detail} />}
        description={`Créée le ${formatDateTime(booking.createdAt)}`}
        title={`${detail.places.pickup} → ${detail.places.destination}`}
      />
      <div>
        <StatusBadge kind="booking" status={booking.status} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Section title="Course">
          <Details
            rows={[
              { label: "Départ", value: detail.places.pickup },
              { label: "Destination", value: detail.places.destination },
              {
                label: "Catégorie demandée",
                value: labelOf(CATEGORY_LABELS, booking.requestedCategory),
              },
              {
                label: "Catégorie de la course",
                value: labelOf(CATEGORY_LABELS, detail.category),
              },
              { label: "Passagers", value: booking.passengers },
              {
                label: "Prix convenu",
                value:
                  booking.agreedPriceAr === null
                    ? "Non défini"
                    : formatAr(booking.agreedPriceAr),
              },
              {
                label: "Version de réglages",
                value: `Version ${detail.settingsVersion}`,
              },
              {
                label: "Terminée le",
                value: booking.completedAt
                  ? formatDateTime(booking.completedAt)
                  : "Non",
              },
            ]}
          />
        </Section>
        <Section title="Personnes">
          <Details
            rows={[
              {
                label: "Client",
                value: (
                  <Link
                    className="underline"
                    params={{ clientId: detail.client.id }}
                    to="/admin/clients/$clientId"
                  >
                    {detail.client.name}
                  </Link>
                ),
              },
              { label: "Téléphone du client", value: detail.client.phone },
              {
                label: "Chauffeur",
                value: detail.driver ? (
                  <Link
                    className="underline"
                    params={{ driverId: detail.driver.id as string }}
                    to="/admin/chauffeurs/$driverId"
                  >
                    {detail.driver.name}
                    {detail.driver.isSimulated ? " (simulé)" : ""}
                  </Link>
                ) : (
                  "Aucun"
                ),
              },
              {
                label: "Téléphone du chauffeur",
                value: detail.driver?.phone ?? "Aucun",
              },
              {
                label: "Véhicule",
                value: detail.vehicle
                  ? `${detail.vehicle.make ?? ""} ${detail.vehicle.model}, ${labelOf(CATEGORY_LABELS, detail.vehicle.category ?? "")}`.trim()
                  : "Aucun",
              },
              {
                label: "Immatriculation",
                value: detail.vehicle?.registration ?? "Aucune",
              },
            ]}
          />
        </Section>
        {detail.payment ? <PaymentSection payment={detail.payment} /> : null}
        <Section title="Devis">
          {detail.quotes.length === 0 ? (
            <EmptyState title="Aucun devis" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Limites</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      {labelOf(CATEGORY_LABELS, quote.category)}
                    </TableCell>
                    <TableCell>{formatAr(quote.amountAr)}</TableCell>
                    <TableCell>
                      {formatAr(quote.minAr)} à {formatAr(quote.maxAr)}
                    </TableCell>
                    <TableCell>
                      {quote.distanceM} m (
                      {quote.distanceSource === "route"
                        ? "itinéraire"
                        : "estimation"}
                      )
                    </TableCell>
                    <TableCell>
                      {quote.replacedAt ? "Remplacé" : "Actif"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
        <Section title="Offres">
          {detail.offers.length === 0 ? (
            <EmptyState title="Aucune offre" />
          ) : (
            <Timeline
              items={detail.offers.map((item) => ({
                id: item.id,
                title: `${item.driverName}, ${labelOf(OFFER_STATUS_LABELS, item.status)}`,
                meta: `${formatDateTime(item.createdAt)}, ${labelOf(CATEGORY_LABELS, item.category)}${item.currentPriceAr === null ? "" : `, ${formatAr(item.currentPriceAr)}`}`,
                body:
                  item.proposals.length > 0 ? (
                    <ul className="grid gap-1 text-muted-foreground">
                      {item.proposals.map((proposal) => (
                        <li key={proposal.id}>
                          {formatDateTime(proposal.createdAt)},{" "}
                          {proposal.actorName} :{" "}
                          {labelOf(PROPOSAL_KIND_LABELS, proposal.kind)}
                          {proposal.amountAr === null
                            ? ""
                            : ` ${formatAr(proposal.amountAr)}`}
                          {proposal.reasonCode
                            ? ` (${reasonLabel(proposal.reasonCode)})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null,
              }))}
            />
          )}
        </Section>
        {detail.destinationChanges.length > 0 ? (
          <Section title="Changements de destination">
            <Timeline
              items={detail.destinationChanges.map((change) => ({
                id: change.id,
                title: labelOf(DESTINATION_STATUS_LABELS, change.status),
                meta: formatDateTime(change.createdAt),
                body: `${change.oldNote ?? "Ancien lieu"} → ${change.newNote ?? "Nouveau lieu"}, ${formatAr(change.oldPriceAr)} → ${formatAr(change.newPriceAr)}`,
              }))}
            />
          </Section>
        ) : null}
        <Section title="Chronologie">
          <Timeline
            items={detail.events.map((event) => ({
              id: event.id,
              title: event.toStatus
                ? `${labelOf(BOOKING_EVENT_LABELS, event.type)} : ${labelOf(BOOKING_STATUS_LABELS, event.toStatus)}`
                : labelOf(BOOKING_EVENT_LABELS, event.type),
              meta: `${formatDateTime(event.createdAt)}, ${actorName(event.actorKind, event.actorName)}`,
              body: reasonText(event.reasonCode, event.reasonNote),
            }))}
          />
        </Section>
      </div>
    </div>
  );
}

function BookingPage() {
  const { bookingId } = Route.useParams();
  const trpc = useTRPC();
  const query = useQuery(trpc.admin.bookings.get.queryOptions({ bookingId }));
  return (
    <div className="grid grid-cols-1 gap-4">
      <BackLink label="Réservations" to="/admin/reservations" />
      <QueryState query={query}>
        {(detail) => <BookingContent detail={detail} />}
      </QueryState>
    </div>
  );
}
