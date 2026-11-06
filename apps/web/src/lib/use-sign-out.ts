import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await authClient.signOut();
    await navigate({ to: "/login" });
  };
}
