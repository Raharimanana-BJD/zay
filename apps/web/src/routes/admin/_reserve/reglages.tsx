import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@zay-app/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zay-app/ui/components/dialog";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
import { Textarea } from "@zay-app/ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { Section, Timeline } from "@/components/admin/detail";
import { Pagination } from "@/components/admin/list-controls";
import PageHeader from "@/components/admin/page-header";
import { QueryState } from "@/components/admin/query-state";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, errorLabel } from "@/lib/labels";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Version = RouterOutputs["admin"]["settings"]["current"];
type Field = { key: string; label: string; hint: string };
type Values = Record<string, string>;

const BLOCKS: { title: string; fields: Field[] }[] = [
  {
    title: "Distribution",
    fields: [
      {
        key: "groupMinDrivers",
        label: "Chauffeurs par groupe, minimum",
        hint: "De 1 au maximum",
      },
      {
        key: "groupMaxDrivers",
        label: "Chauffeurs par groupe, maximum",
        hint: "De 1 à 10",
      },
      { key: "maxGroups", label: "Nombre de groupes", hint: "De 1 à 10" },
      {
        key: "driverResponseS",
        label: "Réponse du chauffeur (s)",
        hint: "De 5 à 300",
      },
      {
        key: "groupPauseS",
        label: "Pause entre les groupes (s)",
        hint: "De 0 à 60",
      },
    ],
  },
  {
    title: "Négociation",
    fields: [
      {
        key: "priceVariationPct",
        label: "Variation du prix (%)",
        hint: "De 0 à 100",
      },
      {
        key: "clientResponseS",
        label: "Réponse du client (s)",
        hint: "De 5 à 300",
      },
      {
        key: "driverCounterResponseS",
        label: "Réponse à une contre proposition (s)",
        hint: "De 5 à 300",
      },
    ],
  },
  {
    title: "GPS",
    fields: [
      {
        key: "gpsMaxAgeS",
        label: "Âge maximum d'une position (s)",
        hint: "De 10 à 3600",
      },
    ],
  },
];

const FARE_FIELDS: Field[] = [
  { key: "baseFareAr", label: "Prix de base (Ar)", hint: "De 0 à 1 000 000" },
  { key: "perKmAr", label: "Prix par km (Ar)", hint: "De 0 à 1 000 000" },
  { key: "includedM", label: "Distance incluse (m)", hint: "De 0 à 100 000" },
  { key: "roundingAr", label: "Arrondi (Ar)", hint: "De 1 à 1 000" },
  { key: "maxCapacity", label: "Capacité maximale", hint: "De 1 à 20" },
];

const CATEGORIES = ["car", "tuk_tuk"] as const;

const ALL_FIELDS: Field[] = [
  ...BLOCKS.flatMap((block) => block.fields),
  ...CATEGORIES.flatMap((category) =>
    FARE_FIELDS.map((field) => ({
      ...field,
      key: `fares.${category}.${field.key}`,
      label: `${CATEGORY_LABELS[category]} : ${field.label}`,
    }))
  ),
];

function flatValues(version: Version): Record<string, number> {
  const values: Record<string, number> = {};
  for (const block of BLOCKS) {
    for (const { key } of block.fields) {
      values[key] = version[key as keyof Version] as number;
    }
  }
  for (const category of CATEGORIES) {
    for (const { key } of FARE_FIELDS) {
      values[`fares.${category}.${key}`] =
        version.fares[category][key as keyof Version["fares"]["car"]];
    }
  }
  return values;
}

const changesBetween = (
  older: Record<string, number>,
  newer: Record<string, number>
) =>
  ALL_FIELDS.filter(({ key }) => older[key] !== newer[key]).map(
    ({ key, label }) => ({
      key,
      label,
      before: older[key],
      after: newer[key],
    })
  );

const searchSchema = z.object({ page: z.number().int().min(1).catch(1) });

export const Route = createFileRoute("/admin/_reserve/reglages")({
  validateSearch: searchSchema,
  component: SettingsPage,
});

function NumberField({
  field,
  value,
  error,
  onChange,
}: {
  field: Field;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        aria-describedby={`${field.key}-hint`}
        aria-invalid={Boolean(error)}
        id={field.key}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
      <p
        className={
          error ? "text-destructive text-sm" : "text-muted-foreground text-sm"
        }
        id={`${field.key}-hint`}
      >
        {error ?? field.hint}
      </p>
    </div>
  );
}

function SettingsForm({ current }: { current: Version }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const create = useMutation(trpc.admin.settings.create.mutationOptions());
  const original = flatValues(current);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(
      Object.entries(original).map(([key, value]) => [key, String(value)])
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isOutdated, setIsOutdated] = useState(false);

  const numbers = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Number(value)])
  );
  const changes = changesBetween(original, numbers);

  const review = () => {
    const invalid: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim() === "" || !Number.isInteger(Number(value))) {
        invalid[key] = "Saisissez un nombre entier.";
      }
    }
    setErrors(invalid);
    setProblem(null);
    if (Object.keys(invalid).length === 0) {
      setReviewing(true);
    }
  };

  const save = async () => {
    setNoteError(null);
    setProblem(null);
    const fareOf = (category: (typeof CATEGORIES)[number]) => ({
      baseFareAr: numbers[`fares.${category}.baseFareAr`] as number,
      perKmAr: numbers[`fares.${category}.perKmAr`] as number,
      includedM: numbers[`fares.${category}.includedM`] as number,
      roundingAr: numbers[`fares.${category}.roundingAr`] as number,
      maxCapacity: numbers[`fares.${category}.maxCapacity`] as number,
    });
    try {
      const result = await create.mutateAsync({
        baseVersion: current.version,
        priceVariationPct: numbers.priceVariationPct as number,
        groupMinDrivers: numbers.groupMinDrivers as number,
        groupMaxDrivers: numbers.groupMaxDrivers as number,
        driverResponseS: numbers.driverResponseS as number,
        groupPauseS: numbers.groupPauseS as number,
        maxGroups: numbers.maxGroups as number,
        clientResponseS: numbers.clientResponseS as number,
        driverCounterResponseS: numbers.driverCounterResponseS as number,
        gpsMaxAgeS: numbers.gpsMaxAgeS as number,
        fares: { car: fareOf("car"), tuk_tuk: fareOf("tuk_tuk") },
        changeNote: note,
      });
      if (result.ok) {
        toast.success(`Version ${result.version} enregistrée.`);
        setReviewing(false);
        await queryClient.invalidateQueries();
        return;
      }
      if ("code" in result) {
        setProblem("Aucune valeur n'a changé : rien n'a été enregistré.");
        return;
      }
      const { changeNote, ...fieldErrors } = result.fieldErrors;
      setNoteError(changeNote ?? null);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length > 0) {
        setReviewing(false);
      }
    } catch (error) {
      const message = errorLabel(error);
      if ((error as { message?: string }).message === "SETTINGS_CHANGED") {
        setIsOutdated(true);
        setReviewing(false);
      }
      setProblem(message);
    }
  };

  const setValue = (key: string) => (value: string) =>
    setValues({ ...values, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-6">
      {isOutdated ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive text-sm"
          role="alert"
        >
          <p>{problem}</p>
          <Button
            onClick={() => queryClient.invalidateQueries()}
            variant="secondary"
          >
            Recharger
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {BLOCKS.map((block) => (
          <Section key={block.title} title={block.title}>
            <div className="grid gap-4 sm:grid-cols-2">
              {block.fields.map((field) => (
                <NumberField
                  error={errors[field.key]}
                  field={field}
                  key={field.key}
                  onChange={setValue(field.key)}
                  value={values[field.key] ?? ""}
                />
              ))}
            </div>
          </Section>
        ))}
        {CATEGORIES.map((category) => (
          <Section key={category} title={CATEGORY_LABELS[category] as string}>
            <div className="grid gap-4 sm:grid-cols-2">
              {FARE_FIELDS.map((field) => {
                const key = `fares.${category}.${field.key}`;
                return (
                  <NumberField
                    error={errors[key]}
                    field={{ ...field, key }}
                    key={key}
                    onChange={setValue(key)}
                    value={values[key] ?? ""}
                  />
                );
              })}
            </div>
          </Section>
        ))}
      </div>
      <div>
        <Button onClick={review} size="lg">
          Enregistrer
        </Button>
      </div>
      <Dialog onOpenChange={setReviewing} open={reviewing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Vérifier les changements</DialogTitle>
            <DialogDescription>
              Ils s'appliquent aux nouvelles demandes. Les réservations
              existantes gardent leur version.
            </DialogDescription>
          </DialogHeader>
          {changes.length === 0 ? (
            <p>Aucune valeur n'a changé.</p>
          ) : (
            <ul className="grid gap-1">
              {changes.map((change) => (
                <li key={change.key}>
                  {change.label} :{" "}
                  <s className="text-muted-foreground">{change.before}</s> →{" "}
                  <strong>{change.after}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2">
            <Label htmlFor="changeNote">Note</Label>
            <Textarea
              aria-invalid={Boolean(noteError)}
              id="changeNote"
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
            {noteError ? (
              <p className="text-destructive text-sm">{noteError}</p>
            ) : null}
          </div>
          {problem && !isOutdated ? (
            <p
              className="rounded-2xl bg-destructive/10 p-3 text-destructive text-sm"
              role="alert"
            >
              {problem}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setReviewing(false)} variant="secondary">
              Fermer
            </Button>
            <Button disabled={create.isPending} onClick={save}>
              {create.isPending
                ? "Enregistrement..."
                : "Créer la nouvelle version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function History() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.settings.history.queryOptions(search, {
      placeholderData: keepPreviousData,
    })
  );
  return (
    <Section title="Historique">
      <QueryState query={query}>
        {({ items, previous, total }) => (
          <div>
            <Timeline
              items={items.map((item, index) => {
                const older = items[index + 1] ?? previous;
                const changes = older
                  ? changesBetween(flatValues(older), flatValues(item))
                  : [];
                return {
                  id: item.id,
                  title: `Version ${item.version}`,
                  meta: `${formatDateTime(item.createdAt)}, ${item.authorName ?? "Système"}`,
                  body: (
                    <div className="grid gap-1">
                      {item.changeNote ? <p>{item.changeNote}</p> : null}
                      {changes.length > 0 ? (
                        <ul className="text-muted-foreground">
                          {changes.map((change) => (
                            <li key={change.key}>
                              {change.label} : {change.before} → {change.after}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ),
                };
              })}
            />
            <Pagination
              onPageChange={(page) => navigate({ search: { page } })}
              page={search.page}
              total={total}
            />
          </div>
        )}
      </QueryState>
    </Section>
  );
}

function SettingsPage() {
  const trpc = useTRPC();
  const query = useQuery(trpc.admin.settings.current.queryOptions());
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Tarifs et paramètres de distribution."
        title="Réglages"
      />
      <QueryState query={query}>
        {(current) => (
          <div className="grid grid-cols-1 gap-6">
            <p className="text-muted-foreground">
              Version {current.version} en cours, enregistrée le{" "}
              {formatDateTime(current.createdAt)} par{" "}
              {current.authorName ?? "Système"}.
            </p>
            <SettingsForm current={current} key={current.version} />
          </div>
        )}
      </QueryState>
      <History />
    </div>
  );
}
