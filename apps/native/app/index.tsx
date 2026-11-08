import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { Loading } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useOnboarded } from "@/lib/onboarding";
import { usePendingVerification } from "@/lib/pending-verification";
import { trpc } from "@/utils/trpc";

/** Each role has its own space. The guards in the root layout close the other ones. */
export default function Index() {
  const { data: session, isPending } = authClient.useSession();
  const onboarded = useOnboarded();
  const me = useQuery({
    ...trpc.me.get.queryOptions(),
    enabled: Boolean(session),
  });
  const pending = usePendingVerification();
  if (
    isPending ||
    (!session && (onboarded === null || pending === undefined))
  ) {
    return <Loading />;
  }
  // Android closed the app while the person read their code: back to the code.
  if (!session && pending?.kind === "reset-password") {
    return (
      <Redirect
        href={{ pathname: "/mot-de-passe", params: { email: pending.email } }}
      />
    );
  }
  if (!session && pending) {
    return (
      <Redirect
        href={{
          pathname: "/verifier",
          params: pending.relation
            ? { email: pending.email, relation: pending.relation }
            : { email: pending.email },
        }}
      />
    );
  }
  if (!session) {
    return <Redirect href={onboarded ? "/connexion" : "/bienvenue"} />;
  }
  const role = me.data?.role ?? session.user.role;
  if (role === "driver") {
    return <Redirect href="/accueil" />;
  }
  return role === "client" ? <Redirect href="/reserver" /> : <Loading />;
}
