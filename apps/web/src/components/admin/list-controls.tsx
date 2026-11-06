import { Button } from "@zay-app/ui/components/button";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zay-app/ui/components/select";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";

const PAGE_SIZE = 25;
const ALL = "__all";

export function Pagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between gap-2"
    >
      <p className="text-muted-foreground text-sm">
        {total} résultat{total > 1 ? "s" : ""}, page {page} sur {pages}
      </p>
      <div className="flex gap-2">
        <Button
          aria-label="Page précédente"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="icon-sm"
          variant="secondary"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Page suivante"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          size="icon-sm"
          variant="secondary"
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

export function SearchField({
  value,
  placeholder,
  onSearch,
}: {
  value: string | undefined;
  placeholder: string;
  onSearch: (q: string | undefined) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(draft.trim() || undefined);
  };
  return (
    <form className="grid gap-2" onSubmit={submit} role="search">
      <Label htmlFor={id}>Recherche</Label>
      <div className="flex gap-2">
        <Input
          className="w-64 max-w-full"
          id={id}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          value={draft}
        />
        <Button
          aria-label="Rechercher"
          size="icon"
          type="submit"
          variant="secondary"
        >
          <SearchIcon aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

/** A labelled select. With `allLabel`, an extra first choice clears the value. */
export function LabeledSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
  placeholder = "Choisir",
}: {
  label: string;
  value: string | undefined;
  options: Record<string, string>;
  onChange: (value: string | undefined) => void;
  allLabel?: string;
  placeholder?: string;
}) {
  const id = useId();
  const items = [
    ...(allLabel ? [{ value: ALL, label: allLabel }] : []),
    ...Object.entries(options).map(([code, text]) => ({
      value: code,
      label: text,
    })),
  ];
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        onValueChange={(next) =>
          onChange(next === ALL || next === null ? undefined : (next as string))
        }
        value={value ?? (allLabel ? ALL : null)}
      >
        <SelectTrigger className="h-10 w-full min-w-44" id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
