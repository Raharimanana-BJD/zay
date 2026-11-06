import { Button } from "@zay-app/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@zay-app/ui/components/empty";
import type { ReactNode } from "react";

import Loader from "@/components/loader";
import { errorLabel } from "@/lib/labels";

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl bg-muted px-6 py-12 text-center"
      role="alert"
    >
      <p>{errorLabel(error)}</p>
      <Button onClick={onRetry} variant="secondary">
        Réessayer
      </Button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Empty className="rounded-2xl bg-muted py-12">
      <EmptyHeader>
        <EmptyTitle className="font-bold text-base">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="text-sm">{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  );
}

/** The three states of a query: loading, error with a retry, then its content. */
export function QueryState<T>({
  query,
  children,
}: {
  query: {
    data: T | undefined;
    error: unknown;
    isPending: boolean;
    refetch: () => unknown;
  };
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) {
    return <>{children(query.data)}</>;
  }
  if (query.isPending) {
    return <Loader />;
  }
  return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
}
