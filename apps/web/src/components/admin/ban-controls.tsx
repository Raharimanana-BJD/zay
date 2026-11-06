import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { SUSPENSION_REASON_LABELS } from "@/lib/labels";
import { useTRPC } from "@/utils/trpc";

import ActionDialog from "./action-dialog";

/** Suspends or reactivates an account. Only admins get these buttons. */
export default function BanControls({
  userId,
  name,
  banned,
  suspensionIncomplete,
}: {
  userId: string;
  name: string;
  banned: boolean;
  suspensionIncomplete: boolean;
}) {
  const trpc = useTRPC();
  const ban = useMutation(trpc.admin.accounts.ban.mutationOptions());
  const unban = useMutation(trpc.admin.accounts.unban.mutationOptions());

  if (banned && !suspensionIncomplete) {
    return (
      <ActionDialog
        confirmLabel="Réactiver"
        description={`${name} pourra de nouveau se connecter.`}
        label="Réactiver"
        onConfirm={async () => {
          await unban.mutateAsync({ userId });
        }}
        showNote={false}
        success="Compte réactivé."
        title="Réactiver ce compte ?"
      />
    );
  }
  return (
    <ActionDialog
      confirmLabel={banned ? "Terminer la suspension" : "Suspendre"}
      danger
      description={`${name} perdra tout de suite sa session et ne pourra plus se connecter.`}
      label={banned ? "Terminer la suspension" : "Suspendre"}
      onConfirm={async ({ reasonCode, reasonNote }) => {
        const result = await ban.mutateAsync({
          userId,
          reasonCode: reasonCode as string,
          reasonNote,
        });
        if (result.ok) {
          return;
        }
        return (
          <>
            Ce compte a une course active.{" "}
            <Link
              className="underline"
              params={{ bookingId: result.bookingId }}
              to="/admin/reservations/$bookingId"
            >
              Voir la réservation
            </Link>
          </>
        );
      }}
      reasons={SUSPENSION_REASON_LABELS}
      success="Compte suspendu."
      title="Suspendre ce compte ?"
    />
  );
}
