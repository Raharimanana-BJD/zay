import { useQueryClient } from "@tanstack/react-query";
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
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";

import { errorLabel } from "@/lib/labels";

import { LabeledSelect } from "./list-controls";

const MAX_NOTE_LENGTH = 500;
const MAX_AMOUNT_AR = 10_000_000;

export interface ActionValues {
  amount?: number;
  /** One per opening of the window, so a double click only acts once. */
  clientRequestId: string;
  /** A day as AAAA-MM-JJ, only when the window asks for one. Empty is undefined. */
  date?: string;
  reasonCode?: string;
  reasonNote?: string;
}

interface ActionDialogProps {
  amountLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  /** An optional day field, like an expiry date. `dateMin` is the first day allowed. */
  dateHint?: string;
  dateLabel?: string;
  dateMin?: string;
  description?: ReactNode;
  disabled?: boolean;
  label: string;
  noteLabel?: string;
  noteRequired?: boolean;
  /** Return a message or a link to keep the window open and show it. */
  onConfirm: (values: ActionValues) => Promise<ReactNode | void>;
  reasons?: Record<string, string>;
  showNote?: boolean;
  success: string;
  title: string;
  triggerVariant?: "default" | "secondary" | "destructive" | "outline";
}

/** Empty is allowed. The ISO day strings compare in calendar order. */
const isDayAllowed = (day: string, min: string | undefined) =>
  day === "" || min === undefined || day >= min;

function DateField({
  hint,
  isValid,
  label,
  min,
  onChange,
  value,
}: {
  hint?: string;
  isValid: boolean;
  label: string;
  min?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label} (facultative)</Label>
      <Input
        aria-describedby={hint ? hintId : undefined}
        aria-invalid={!isValid}
        id={id}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
      {hint ? (
        <p className="text-muted-foreground text-sm" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The window behind every sensitive action: reason, note, amount, then confirmation. */
export default function ActionDialog({
  amountLabel,
  confirmLabel,
  danger = false,
  dateHint,
  dateLabel,
  dateMin,
  description,
  disabled = false,
  label,
  noteLabel = "Note",
  noteRequired = false,
  onConfirm,
  reasons,
  showNote = true,
  success,
  title,
  triggerVariant = "secondary",
}: ActionDialogProps) {
  const queryClient = useQueryClient();
  const noteId = useId();
  const amountId = useId();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [reasonCode, setReasonCode] = useState<string>();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [problem, setProblem] = useState<ReactNode>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openWindow = () => {
    setRequestId(crypto.randomUUID());
    setReasonCode(undefined);
    setNote("");
    setAmount("");
    setDate("");
    setProblem(null);
    setOpen(true);
  };

  const trimmed = note.trim();
  const needsNote = noteRequired || reasonCode === "other";
  const amountValue = Number(amount);
  const amountValid =
    amountLabel === undefined ||
    (amount !== "" &&
      Number.isInteger(amountValue) &&
      amountValue >= 0 &&
      amountValue <= MAX_AMOUNT_AR);
  const dateValid = isDayAllowed(date, dateMin);
  const canSubmit =
    (reasons === undefined || reasonCode !== undefined) &&
    (!needsNote || trimmed.length > 0) &&
    amountValid &&
    dateValid;

  const submit = async () => {
    setIsSaving(true);
    setProblem(null);
    try {
      const shown = await onConfirm({
        clientRequestId: requestId,
        reasonCode,
        reasonNote: trimmed || undefined,
        amount: amountLabel === undefined ? undefined : amountValue,
        date: date || undefined,
      });
      if (shown) {
        setProblem(shown);
      } else {
        setOpen(false);
        toast.success(success);
      }
    } catch (error) {
      // A conflict means the screen is about to change, and this window may go with it.
      if (
        (error as { data?: { code?: string } | null }).data?.code === "CONFLICT"
      ) {
        setOpen(false);
        toast.error(errorLabel(error));
      } else {
        setProblem(errorLabel(error));
      }
    } finally {
      setIsSaving(false);
      // A refusal often means the data changed, so the screen reloads the real state.
      await queryClient.invalidateQueries();
    }
  };

  return (
    <>
      <Button
        disabled={disabled}
        onClick={openWindow}
        variant={danger ? "destructive" : triggerVariant}
      >
        {label}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="grid gap-4">
            {reasons ? (
              <LabeledSelect
                label="Motif"
                onChange={setReasonCode}
                options={reasons}
                value={reasonCode}
              />
            ) : null}
            {amountLabel ? (
              <div className="grid gap-2">
                <Label htmlFor={amountId}>{amountLabel}</Label>
                <Input
                  id={amountId}
                  inputMode="numeric"
                  max={MAX_AMOUNT_AR}
                  min={0}
                  onChange={(event) => setAmount(event.target.value)}
                  type="number"
                  value={amount}
                />
              </div>
            ) : null}
            {dateLabel ? (
              <DateField
                hint={dateHint}
                isValid={dateValid}
                label={dateLabel}
                min={dateMin}
                onChange={setDate}
                value={date}
              />
            ) : null}
            {showNote ? (
              <div className="grid gap-2">
                <Label htmlFor={noteId}>
                  {noteLabel}
                  {needsNote ? "" : " (facultative)"}
                </Label>
                <Textarea
                  id={noteId}
                  maxLength={MAX_NOTE_LENGTH}
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </div>
            ) : null}
            {problem ? (
              <div
                className="rounded-2xl bg-destructive/10 p-3 text-destructive text-sm"
                role="alert"
              >
                {problem}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="secondary">
              Fermer
            </Button>
            <Button
              disabled={!canSubmit || isSaving}
              onClick={submit}
              variant={danger ? "destructive" : "default"}
            >
              {isSaving ? "Enregistrement..." : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
