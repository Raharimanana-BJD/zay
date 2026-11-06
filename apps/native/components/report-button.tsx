import { useToast } from "heroui-native";
import { useState } from "react";

import { ReasonSheet } from "@/components/reason-sheet";
import { Action } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useAction } from "@/lib/use-action";
import { trpcClient } from "@/utils/trpc";

const REPORT_TYPES = [
  "client_absent",
  "driver_absent",
  "payment_issue",
  "safety",
  "help",
  "other",
] as const;

export function ReportButton({ bookingId }: { bookingId?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const report = useAction<{
    typeCode: (typeof REPORT_TYPES)[number];
    description?: string;
  }>((input) => trpcClient.me.report.mutate({ ...input, bookingId }));
  return (
    <>
      <Action
        label={t("report.action")}
        onPress={() => setOpen(true)}
        variant="tertiary"
      />
      <ReasonSheet
        confirmLabel={t("report.send")}
        isLoading={report.isPending}
        labelPrefix="report"
        onClose={() => setOpen(false)}
        onConfirm={({ reasonCode, reasonNote }) => {
          report.run({
            typeCode: reasonCode as (typeof REPORT_TYPES)[number],
            description: reasonNote,
          });
          setOpen(false);
          toast.show({ variant: "success", label: t("report.sent") });
        }}
        reasons={REPORT_TYPES}
        title={t("report.action")}
        visible={open}
      />
    </>
  );
}
