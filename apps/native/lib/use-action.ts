import { useMutation } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useRef } from "react";

import { newRequestId } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const isNetworkFailure = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof Error && error.message === "Network request failed");

export function useErrorToast() {
  const { t, has } = useI18n();
  const { toast } = useToast();
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const key = `errors.${message}`;
    let label = t("errors.generic");
    if (isNetworkFailure(error)) {
      label = t("errors.network");
    } else if (has(key)) {
      label = t(key);
    }
    toast.show({ variant: "danger", label });
  };
}

/**
 * Sends a sensitive action with a request id. After a network failure the id stays,
 * so pressing again replays the same action instead of doing it twice (scenario F).
 */
export function useAction<Input>(
  send: (input: Input & { clientRequestId: string }) => Promise<unknown>,
  onDone?: () => void
) {
  const requestId = useRef(newRequestId());
  const showError = useErrorToast();
  const mutation = useMutation({
    mutationFn: (input: Input) =>
      send({ ...input, clientRequestId: requestId.current }),
    onSuccess: () => {
      requestId.current = newRequestId();
      onDone?.();
    },
    onError: (error) => {
      if (!isNetworkFailure(error)) {
        requestId.current = newRequestId();
      }
      showError(error);
      onDone?.();
    },
  });
  return { run: mutation.mutate, isPending: mutation.isPending };
}
