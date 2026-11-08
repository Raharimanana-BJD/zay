import Ionicons from "@expo/vector-icons/Ionicons";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zay-app/api/routers/index";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useToast } from "heroui-native";
import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";

import { AuthImage } from "@/components/auth-image";
import { Sheet } from "@/components/sheet";
import {
  Action,
  Group,
  GroupRow,
  INK,
  Muted,
  Pill,
  SectionLabel,
} from "@/components/ui";
import { daysUntil, formatDay } from "@/lib/format";
import { type TKey, useI18n } from "@/lib/i18n";
import { uploadFile } from "@/lib/upload";
import { useErrorLabel } from "@/lib/use-action";
import { trpcClient } from "@/utils/trpc";

type Dossier = inferRouterOutputs<AppRouter>["driver"]["dossier"];
type SentDocument = Dossier["documents"][number];
type TypeCode = Dossier["requiredDocuments"][number];
type Source = "camera" | "library" | "pdf";

const IMAGE_QUALITY = 0.6;
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

/** Opens the camera, the gallery or the file picker. Null when cancelled. */
async function pickFile(
  source: Source
): Promise<Omit<Prepared, "status"> | null> {
  if (source === "pdf") {
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
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: IMAGE_QUALITY,
  };
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error("CAMERA_DENIED");
    }
  }
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) {
    return null;
  }
  return { uri: asset.uri, kind: "image", name: asset.fileName ?? "" };
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

/** The picture at the left of a row: the chosen file, the sent file, or an icon. */
function Preview({
  label,
  prepared,
  sent,
  onOpen,
}: {
  label: string;
  prepared?: Prepared;
  sent?: SentDocument;
  onOpen: (uri: string) => void;
}) {
  const { t } = useI18n();
  const box = "size-14 rounded-2xl bg-surface-tertiary";
  if (prepared?.kind === "image") {
    return <Image className={box} source={{ uri: prepared.uri }} />;
  }
  if (!prepared && sent?.fileKind === "image" && sent.fileUrl) {
    const { fileUrl } = sent;
    return (
      <Pressable
        accessibilityLabel={t("dossier.openDocument", { name: label })}
        accessibilityRole="imagebutton"
        onPress={() => onOpen(fileUrl)}
      >
        <AuthImage className={box} label={label} uri={fileUrl} />
      </Pressable>
    );
  }
  const isPdf =
    prepared?.kind === "pdf" || (!prepared && sent?.fileKind === "pdf");
  return (
    <View className={`${box} items-center justify-center`}>
      <Ionicons
        color={INK}
        name={isPdf ? "document-text" : "document-text-outline"}
        size={22}
      />
      {isPdf ? (
        <Text className="font-black text-[10px] text-foreground">PDF</Text>
      ) : null}
    </View>
  );
}

function DocumentRow({
  label,
  prepared,
  sent,
  onChoose,
  onOpen,
}: {
  label: string;
  prepared?: Prepared;
  sent?: SentDocument;
  onChoose: () => void;
  onOpen: (uri: string) => void;
}) {
  const { t, has, locale } = useI18n();
  const state = sent ? verification(sent.verificationStatus) : null;
  let status = <Pill label={t("dossier.missing")} tone="neutral" />;
  if (prepared) {
    status = (
      <Pill
        label={
          prepared.status === "sending"
            ? t("dossier.sending")
            : t("dossier.ready")
        }
        tone="neutral"
      />
    );
  } else if (state) {
    status = (
      <Pill
        label={t(`verificationShort.${state}` as TKey)}
        tone={PILL_TONE[state]}
      />
    );
  }
  const showsReason =
    !prepared &&
    (state === "rejected" || state === "changes_requested") &&
    (sent?.reasonNote || sent?.reasonCode);
  const reasonKey = `docReason.${sent?.reasonCode ?? ""}`;
  const reason = sent?.reasonNote ?? (has(reasonKey) ? t(reasonKey) : null);

  return (
    <View className="gap-3 rounded-3xl bg-surface p-4 shadow-black/5 shadow-sm">
      <View className="flex-row items-center gap-4">
        <Preview
          label={label}
          onOpen={onOpen}
          prepared={prepared}
          sent={sent}
        />
        <Pressable
          accessibilityLabel={t("dossier.change", { name: label })}
          accessibilityRole="button"
          accessibilityState={{ disabled: prepared?.status === "sending" }}
          className="min-h-14 flex-1 flex-row items-center gap-3 active:opacity-70"
          disabled={prepared?.status === "sending"}
          onPress={onChoose}
        >
          <View className="flex-1 gap-1.5">
            <Text
              className="font-bold text-base text-foreground"
              numberOfLines={2}
            >
              {label}
            </Text>
            {status}
          </View>
          <Ionicons color="#b8b4ab" name="chevron-forward" size={18} />
        </Pressable>
      </View>
      {prepared?.kind === "pdf" && prepared.name ? (
        <Muted>{prepared.name}</Muted>
      ) : null}
      {!prepared && sent?.fileKind === "pdf" ? (
        <Muted>
          {t("dossier.pdfSentOn", { date: formatDay(sent.sentAt, locale) })}
        </Muted>
      ) : null}
      {!prepared && sent?.expiresAt ? (
        <Expiry expiresAt={sent.expiresAt} />
      ) : null}
      {showsReason && reason ? (
        <Text className="font-medium text-danger text-sm">{reason}</Text>
      ) : null}
      {prepared?.error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-medium text-danger text-sm"
        >
          {prepared.error}
        </Text>
      ) : null}
    </View>
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
  const sentCount = requiredDocuments.filter((code) => sentOf(code)).length;
  const total = requiredDocuments.length;
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

  return (
    <>
      <SectionLabel>{t("dossier.documents")}</SectionLabel>
      <View className="gap-2 rounded-3xl bg-surface p-4 shadow-black/5 shadow-sm">
        <Text className="font-bold text-base text-foreground">
          {t("dossier.progress", { n: sentCount, total })}
        </Text>
        <View
          accessibilityLabel={t("dossier.progressLabel")}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: sentCount }}
          className="h-2 overflow-hidden rounded-full bg-surface-tertiary"
        >
          <View
            className="h-2 rounded-full bg-brand"
            style={{ width: `${(sentCount / Math.max(total, 1)) * 100}%` }}
          />
        </View>
        <Muted>{t("dossier.documentsHint")}</Muted>
      </View>
      <View className="gap-3">
        {requiredDocuments.map((typeCode) => (
          <DocumentRow
            key={typeCode}
            label={t(`document.${typeCode}` as TKey)}
            onChoose={() => setChoosing(typeCode)}
            onOpen={setOpenUri}
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
        <Group>
          <GroupRow
            isFirst
            label={t("dossier.takePhoto")}
            onPress={() => choose("camera")}
          />
          <GroupRow
            label={t("dossier.pickImage")}
            onPress={() => choose("library")}
          />
          <GroupRow
            label={t("dossier.pickPdf")}
            onPress={() => choose("pdf")}
          />
        </Group>
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
