import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@zay-app/ui/components/card";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Details({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-muted-foreground text-sm">{label}</dt>
          <dd className="break-words font-medium text-sm">
            {value ?? "Non renseigné"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      to={to}
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

/** A vertical history, oldest first or newest first, as the caller ordered it. */
export function Timeline({
  items,
}: {
  items: { id: string; title: ReactNode; meta: string; body?: ReactNode }[];
}) {
  return (
    <ol className="grid gap-4 border-l pl-4">
      {items.map((item) => (
        <li key={item.id}>
          <p className="font-medium text-sm">{item.title}</p>
          <p className="text-muted-foreground text-sm">{item.meta}</p>
          {item.body ? <div className="mt-1 text-sm">{item.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}
