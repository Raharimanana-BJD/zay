import Ionicons from "@expo/vector-icons/Ionicons";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zay-app/api/routers/index";
import * as DocumentPicker from "expo-document-picker";
import { useToast } from "heroui-native";
import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";

import { AuthImage } from "@/components/auth-image";
import { Sheet } from "@/components/sheet";
import { SourceChoice } from "@/components/source-choice";
import { Action, INK, MUTED_INK, Muted, Pill } from "@/components/ui";
import { daysUntil, formatDay } from "@/lib/format";
import { type TKey, useI18n } from "@/lib/i18n";
import { type ImageSource, pickImage } from "@/lib/pick-image";
import { uploadFile } from "@/lib/upload";
import { useErrorLabel } from "@/lib/use-action";
import { trpcClient } from "@/utils/trpc";

type Dossier = inferRouterOutputs<AppRouter>["driver"]["dossier"];
type SentDocument = Dossier["documents"][number];
type TypeCode = Dossier["requiredDocuments"][number];
type Source = ImageSource | "pdf";

/** The server's limit for a document (spec 0005, AC-14). */
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const EXPIRES_SOON_DAYS = 30;

/** A file chosen on the phone, kept on this screen until it is sent. */
interface Prepared {
  error?: string;
  kind: "image" | "pdf";
  name: string;
  status: "ready" | "sending";
  uri: string;
}

const PILL_TONE = {
  approved: "success",
  changes_requested: "brand",
  pending: "brand",
  rejected: "danger",
  suspended: "danger",
} as const;
type Verification = keyof typeof PILL_TONE;
const verification = (value: string): Verification =>
  value in PILL_TONE ? (value as Verification) : "pending";

/** Opens the PDF picker. Null when cancelled. */
async function pickPdf(): Promise<Omit<Prepared, "status"> | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) {
    return null;
  }
  if ((asset.size ?? 0) > MAX_DOC_BYTES) {
    throw new Error("PDF_TOO_LARGE");
  }
  return { uri: asset.uri, kind: "pdf", name: asset.name };
}

/** Opens the camera, the gallery or the PDF picker. Null when cancelled. */
async function pickFile(
  source: Source
): Promise<Omit<Prepared, "status"> | null> {
  if (source === "pdf") {
    return await pickPdf();
  }
  const image = await pickImage(source);
  return image ? { ...image, kind: "image" } : null;
}

function Expiry({ expiresAt }: { expiresAt: string | Date }) {
  const { t, locale } = useI18n();
  const days = daysUntil(expiresAt);
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Muted>
        {t("dossier.expiresOn", { date: formatDay(expiresAt, locale) })}
      </Muted>
      {days < 0 ? <Pill label={t("dossier.expired")} tone="danger" /> : null}
      {days >= 0 && days <= EXPIRES_SOON_DAYS ? (
        <Pill label={t("dossier.expiresSoon")} tone="brand" />
      ) : null}
    </View>
  );
}

/** The top of a tile: the chosen file, the sent file, or an empty slot. */
function Thumbnail({
  label,
  prepared,
  sent,
}: {
  label: string;
  prepared?: Prepared;
  sent?: SentDocument;
}) {
  const box = "h-28 w-full rounded-2xl";
  if (prepared?.kind === "image") {
    return <Image className={box} source={{ uri: prepared.uri }} />;
  }
  if (!prepared && sent?.fileKind === "image" && sent.fileUrl) {
    return <AuthImage className={box} label={label} uri={sent.fileUrl} />;
  }
  const isPdf =
    prepared?.kind === "pdf" || (!prepared && sent?.fileKind === "pdf");
  if (isPdf) {
    return (
      <View
        className={`${box} items-center justify-center bg-surface-tertiary`}
      >
        <Ionicons color={INK} name="document-text" size={26} />
        <Text className="font-black text-[10px] text-foreground">PDF</Text>
      </View>
    );
  }
  return (
    <View
      className={`${box} items-center justify-center border border-border border-dashed bg-surface-tertiary`}
    >
      <Ionicons color={MUTED_INK} name="add" size={28} />
    </View>
  );
}

function StatusPill({
  prepared,
  sent,
}: {
  prepared?: Prepared;
  sent?: SentDocument;
}) {
  const { t } = useI18n();
  if (prepared) {
    return (
      <Pill
        label={
          prepared.status === "sending"
            ? t("dossier.sending")
            : t("dossier.ready")
        }
        tone="neutral"
      />
    );
  }
  if (!sent) {
    return <Pill label={t("dossier.missing")} tone="neutral" />;
  }
  const state = verification(sent.verificationStatus);
  return (
    <Pill
      label={t(`verificationShort.${state}` as TKey)}
      tone={PILL_TONE[state]}
    />
  );
}

/** One paper, as a tile of the grid. A press opens the choice of source. */
function DocumentTile({
  label,
  prepared,
  sent,
  onPress,
}: {
  label: string;
  prepared?: Prepared;
  sent?: SentDocument;
  onPress: () => void;
}) {
  const { t, has, locale } = useI18n();
  const state = sent ? verification(sent.verificationStatus) : null;
  const isSending = prepared?.status === "sending";
  const showsReason =
    !prepared &&
    (state === "rejected" || state === "changes_requested") &&
    (sent?.reasonNote || sent?.reasonCode);
  const reasonKey = `docReason.${sent?.reasonCode ?? ""}`;
  const reason = sent?.reasonNote ?? (has(reasonKey) ? t(reasonKey) : null);

  return (
    <Pressable
      accessibilityLabel={t("dossier.change", { name: label })}
      accessibilityRole="button"
      accessibilityState={{ disabled: isSending }}
      className="gap-2 rounded-3xl bg-surface p-3 shadow-black/5 shadow-sm active:opacity-80"
      disabled={isSending}
      onPress={onPress}
      style={{ width: "48%" }}
    >
      <Thumbnail label={label} prepared={prepared} sent={sent} />
      <Text
        className="min-h-10 font-bold text-foreground text-sm"
        numberOfLines={2}
      >
        {label}
      </Text>
      <StatusPill prepared={prepared} sent={sent} />
      {prepared?.kind === "pdf" && prepared.name ? (
        <Text className="text-muted text-xs" numberOfLines={1}>
          {prepared.name}
        </Text>
      ) : null}
      {!prepared && sent?.fileKind === "pdf" ? (
        <Text className="text-muted text-xs">
          {t("dossier.pdfSentOn", { date: formatDay(sent.sentAt, locale) })}
        </Text>
      ) : null}
      {!prepared && sent?.expiresAt ? (
        <Expiry expiresAt={sent.expiresAt} />
      ) : null}
      {showsReason && reason ? (
        <Text className="font-medium text-danger text-xs">{reason}</Text>
      ) : null}
      {prepared?.error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-medium text-danger text-xs"
        >
          {prepared.error}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * The driver's papers: choose each file, then send them all at once. Each file
 * leaves alone, so one failure keeps only that one ready (spec 0005, AC-12 to AC-15).
 */
export function DocumentsBlock({
  dossier,
  onSent,
}: {
  dossier: Dossier;
  onSent: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const errorLabel = useErrorLabel();
  const [prepared, setPrepared] = useState<Partial<Record<TypeCode, Prepared>>>(
    {}
  );
  const [choosing, setChoosing] = useState<TypeCode | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [openUri, setOpenUri] = useState<string | null>(null);

  const { requiredDocuments, documents } = dossier;
  const sentOf = (typeCode: TypeCode) =>
    documents.find((doc) => doc.typeCode === typeCode);
  const readyCodes = requiredDocuments.filter((code) => prepared[code]);

  const update = (typeCode: TypeCode, next: Prepared | undefined) =>
    setPrepared((current) => ({ ...current, [typeCode]: next }));

  const choose = async (source: Source) => {
    const typeCode = choosing;
    setChoosing(null);
    if (!typeCode) {
      return;
    }
    try {
      const file = await pickFile(source);
      if (file) {
        update(typeCode, { ...file, status: "ready" });
      }
    } catch (error) {
      const label =
        error instanceof Error && error.message === "PDF_TOO_LARGE"
          ? t("dossier.pdfTooLarge")
          : errorLabel(error);
      toast.show({ variant: "danger", label });
    }
  };

  const sendAll = async () => {
    setIsSending(true);
    let sent = 0;
    // One by one: a weak network carries one file better than four at once.
    for (const typeCode of readyCodes) {
      const file = prepared[typeCode];
      if (!file) {
        continue;
      }
      update(typeCode, { ...file, status: "sending", error: undefined });
      try {
        // biome-ignore lint/performance/noAwaitInLoops: one file at a time, on purpose
        const storageKey = await uploadFile(file.uri, "doc");
        await trpcClient.driver.attachDocument.mutate({ typeCode, storageKey });
        sent += 1;
        // Read the new row first, or the row shows "À envoyer" until the loop ends.
        // A failed refresh does not undo a piece the server already holds.
        await onSent().catch(() => undefined);
        update(typeCode, undefined);
      } catch (error) {
        update(typeCode, {
          ...file,
          status: "ready",
          error: errorLabel(error),
        });
      }
    }
    setIsSending(false);
    if (sent > 0) {
      toast.show({
        variant: "success",
        label: t("dossier.sentCount", { n: sent }),
      });
    }
    if (sent < readyCodes.length) {
      toast.show({ variant: "danger", label: t("dossier.sentFailed") });
    }
  };

  const choosingSent = choosing ? sentOf(choosing) : undefined;
  const viewableUrl =
    choosingSent?.fileKind === "image" ? choosingSent.fileUrl : null;

  return (
    <>
      <Muted>{t("dossier.documentsHint")}</Muted>
      <Muted>{t("dossier.vehiclePapersHint")}</Muted>
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {requiredDocuments.map((typeCode) => (
          <DocumentTile
            key={typeCode}
            label={t(`document.${typeCode}` as TKey)}
            onPress={() => setChoosing(typeCode)}
            prepared={prepared[typeCode]}
            sent={sentOf(typeCode)}
          />
        ))}
      </View>
      <Action
        icon="cloud-upload-outline"
        isDisabled={readyCodes.length === 0}
        isLoading={isSending}
        label={t("dossier.sendAll", { n: readyCodes.length })}
        onPress={sendAll}
      />

      <Sheet
        onClose={() => setChoosing(null)}
        title={choosing ? t(`document.${choosing}` as TKey) : ""}
        visible={choosing !== null}
      >
        <SourceChoice onPick={choose} />
        <Pressable
          accessibilityRole="button"
          className="min-h-12 flex-row items-center justify-center gap-2 active:opacity-70"
          onPress={() => choose("pdf")}
        >
          <Ionicons color={INK} name="document-text-outline" size={18} />
          <Text className="font-semibold text-base text-foreground underline">
            {t("source.pdf")}
          </Text>
        </Pressable>
        {viewableUrl ? (
          <Pressable
            accessibilityRole="button"
            className="min-h-12 flex-row items-center justify-center gap-2 active:opacity-70"
            onPress={() => {
              setChoosing(null);
              setOpenUri(viewableUrl);
            }}
          >
            <Ionicons color={INK} name="eye-outline" size={18} />
            <Text className="font-semibold text-base text-foreground underline">
              {t("source.view")}
            </Text>
          </Pressable>
        ) : null}
      </Sheet>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpenUri(null)}
        transparent
        visible={openUri !== null}
      >
        <View className="flex-1 justify-center gap-4 bg-black/90 px-4">
          {openUri ? (
            <AuthImage
              className="h-[75%] w-full"
              fit="contain"
              label={t("dossier.documents")}
              uri={openUri}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            className="min-h-12 items-center justify-center"
            onPress={() => setOpenUri(null)}
          >
            <Text className="font-bold text-base text-white">
              {t("common.close")}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
