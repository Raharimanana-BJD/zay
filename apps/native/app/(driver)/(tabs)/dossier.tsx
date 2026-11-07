import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { Spinner, useToast } from "heroui-native";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Field } from "@/components/auth-fields";
import { Sheet } from "@/components/sheet";
import {
  Action,
  INK,
  Loading,
  Muted,
  Notice,
  Pill,
  Screen,
  SectionLabel,
  Segment,
  Stepper,
  Title,
} from "@/components/ui";
import { type TKey, useI18n } from "@/lib/i18n";
import { uploadFile } from "@/lib/upload";
import { useErrorToast } from "@/lib/use-action";
import { trpc, trpcClient } from "@/utils/trpc";

const IMAGE_QUALITY = 0.6;

type Relation = "owner" | "renter" | "employee";
type Category = "car" | "tuk_tuk";

interface VehicleForm {
  capacity: number;
  category: Category;
  id?: string;
  make: string;
  model: string;
  photoKey?: string;
  registration: string;
}

const EMPTY_VEHICLE: VehicleForm = {
  category: "car",
  make: "",
  model: "",
  registration: "",
  capacity: 4,
};

/** Sends one picture, compressed for a weak network, and returns its storage key. */
async function pickAndUpload(kind: "doc" | "photo"): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: IMAGE_QUALITY,
  };
  const picked = permission.granted
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) {
    return null;
  }
  return await uploadFile(asset.uri, kind);
}

type Verification =
  | "approved"
  | "changes_requested"
  | "pending"
  | "rejected"
  | "suspended";

const PILL_TONE = {
  approved: "success",
  changes_requested: "brand",
  pending: "brand",
  rejected: "danger",
  suspended: "danger",
} as const;

const TEXT_TONE = {
  approved: "text-success",
  changes_requested: "text-brand-ink",
  pending: "text-brand-ink",
  rejected: "text-danger",
  suspended: "text-danger",
} as const;

const verification = (value: string): Verification =>
  value in PILL_TONE ? (value as Verification) : "pending";

function Status({ value }: { value: string }) {
  const { t } = useI18n();
  return <>{t(`verification.${value}` as TKey)}</>;
}

/** One required document: its state, and a button to send or replace it. */
function DocumentRow({
  label,
  status,
  isSending,
  onSend,
}: {
  label: string;
  status?: string;
  isSending: boolean;
  onSend: () => void;
}) {
  const { t } = useI18n();
  const tone = status ? TEXT_TONE[verification(status)] : "text-brand-ink";
  return (
    <View className="min-h-20 flex-row items-center gap-4 rounded-3xl bg-surface p-4 shadow-black/5 shadow-sm">
      <View className="size-12 items-center justify-center rounded-2xl bg-surface-tertiary">
        <Ionicons color={INK} name="document-text-outline" size={20} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-bold text-base text-foreground" numberOfLines={2}>
          {label}
        </Text>
        <Text className={`font-bold text-sm ${tone}`}>
          {status ? <Status value={status} /> : t("dossier.missing")}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={`${status ? t("dossier.replace") : t("dossier.send")}, ${label}`}
        accessibilityRole="button"
        accessibilityState={{ busy: isSending, disabled: isSending }}
        className={`min-h-11 min-w-24 items-center justify-center rounded-xl px-4 active:opacity-80 ${
          status ? "border border-border bg-surface" : "bg-foreground"
        }`}
        disabled={isSending}
        onPress={onSend}
      >
        {isSending ? (
          <Spinner color={status ? INK : "#ffffff"} size="sm" />
        ) : (
          <Text
            className={`font-bold text-sm ${status ? "text-foreground" : "text-white"}`}
          >
            {status ? t("dossier.replace") : t("dossier.send")}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export default function DossierScreen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const showError = useErrorToast();
  const dossier = useQuery(trpc.driver.dossier.queryOptions());
  const { refetch } = dossier;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const setRelation = useMutation({
    mutationFn: (employmentRelation: Relation) =>
      trpcClient.driver.setRelation.mutate({ employmentRelation }),
    onError: showError,
    onSettled: () => refetch(),
  });
  const saveVehicle = useMutation({
    mutationFn: ({ make, registration, ...vehicle }: VehicleForm) =>
      trpcClient.driver.saveVehicle.mutate({
        ...vehicle,
        make: make.trim() || undefined,
        registration: registration.trim() || undefined,
      }),
    onSuccess: () => {
      setForm(null);
      toast.show({ variant: "success", label: t("dossier.saved") });
    },
    onError: showError,
    onSettled: () => refetch(),
  });
  const setActive = useMutation({
    mutationFn: (vehicleId: string) =>
      trpcClient.driver.setActiveVehicle.mutate({ vehicleId }),
    onError: showError,
    onSettled: () => refetch(),
  });

  const uploadDocument = async (typeCode: string) => {
    setUploading(typeCode);
    try {
      const key = await pickAndUpload("doc");
      if (key) {
        await trpcClient.driver.attachDocument.mutate({
          typeCode: typeCode as never,
          storageKey: key,
        });
        toast.show({ variant: "success", label: t("dossier.sent") });
        await refetch();
      }
    } catch (error) {
      showError(error);
    } finally {
      setUploading(null);
    }
  };

  const uploadPhoto = async () => {
    setUploading("photo");
    try {
      const key = await pickAndUpload("photo");
      if (key) {
        setForm((current) =>
          current ? { ...current, photoKey: key } : current
        );
      }
    } catch (error) {
      showError(error);
    } finally {
      setUploading(null);
    }
  };

  const data = dossier.data;
  if (!data) {
    return <Loading />;
  }
  const limit = form ? data.capacityLimits[form.category] : 1;

  const overall = verification(data.verificationStatus);

  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-3">
        <Title>{t("nav.vehicle")}</Title>
        <Pill
          label={t(`verificationShort.${overall}` as TKey)}
          tone={PILL_TONE[overall]}
        />
      </View>
      {data.verificationStatus === "changes_requested" ? (
        <Notice tone="warning">{t("dossier.changesRequested")}</Notice>
      ) : null}
      {data.lastDecision?.reasonNote ? (
        <Notice>{data.lastDecision.reasonNote}</Notice>
      ) : null}

      <SectionLabel>{t("relation.title")}</SectionLabel>
      <Segment<Relation>
        onChange={(value) => setRelation.mutate(value)}
        options={[
          { value: "owner", label: t("relation.owner") },
          { value: "renter", label: t("relation.renter") },
          { value: "employee", label: t("relation.employee") },
        ]}
        value={data.employmentRelation}
      />

      <SectionLabel>{t("dossier.vehicles")}</SectionLabel>
      <View className="gap-4 rounded-3xl bg-surface p-5 shadow-black/5 shadow-sm">
        {data.vehicles.length === 0 ? (
          <Muted>{t("dossier.noVehicle")}</Muted>
        ) : null}
        {data.vehicles.map((vehicle) => {
          const isActive = data.activeVehicleId === vehicle.id;
          const state = verification(vehicle.verificationStatus);
          return (
            <View
              className={`gap-3 rounded-2xl border p-4 ${isActive ? "border-foreground" : "border-border"}`}
              key={vehicle.id}
            >
              <View className="flex-row items-start gap-3">
                <View className="size-11 items-center justify-center rounded-full bg-brand">
                  <Ionicons
                    color={INK}
                    name={vehicle.category === "car" ? "car" : "bicycle"}
                    size={20}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-base text-foreground">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                  </Text>
                  <Muted>
                    {[
                      t(`category.${vehicle.category}` as TKey),
                      vehicle.registration,
                      t("offer.seats", { n: vehicle.capacity }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Muted>
                </View>
                <Pill
                  label={t(`verificationShort.${state}` as TKey)}
                  tone={PILL_TONE[state]}
                />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  {isActive ? (
                    <View className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-surface-tertiary">
                      <Ionicons color={INK} name="checkmark-circle" size={18} />
                      <Text className="font-bold text-foreground">
                        {t("dossier.inUse")}
                      </Text>
                    </View>
                  ) : (
                    <Action
                      label={t("dossier.useVehicle")}
                      onPress={() => setActive.mutate(vehicle.id)}
                    />
                  )}
                </View>
                <Action
                  label={t("common.edit")}
                  onPress={() =>
                    setForm({
                      id: vehicle.id,
                      category: vehicle.category,
                      make: vehicle.make ?? "",
                      model: vehicle.model,
                      registration: vehicle.registration ?? "",
                      capacity: vehicle.capacity,
                      photoKey: vehicle.photoKey?.startsWith("up-photo-")
                        ? vehicle.photoKey
                        : undefined,
                    })
                  }
                  variant="secondary"
                />
              </View>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border border-dashed active:bg-surface-tertiary"
          onPress={() => setForm(EMPTY_VEHICLE)}
        >
          <Ionicons color={INK} name="add" size={20} />
          <Text className="font-bold text-base text-foreground">
            {t("dossier.addVehicle")}
          </Text>
        </Pressable>
      </View>

      <SectionLabel>{t("dossier.documents")}</SectionLabel>
      <Muted>{t("dossier.documentsHint")}</Muted>
      <View className="gap-3">
        {data.requiredDocuments.map((typeCode) => {
          const document = data.documents.find((d) => d.typeCode === typeCode);
          return (
            <DocumentRow
              isSending={uploading === typeCode}
              key={typeCode}
              label={t(`document.${typeCode}` as TKey)}
              onSend={() => uploadDocument(typeCode)}
              status={document?.verificationStatus}
            />
          );
        })}
      </View>
      <Sheet
        onClose={() => setForm(null)}
        title={form?.id ? t("common.edit") : t("dossier.addVehicle")}
        visible={form !== null}
      >
        {form ? (
          <View className="gap-3">
            <Segment<Category>
              onChange={(category) =>
                setForm({
                  ...form,
                  category,
                  capacity: Math.min(
                    form.capacity,
                    data.capacityLimits[category]
                  ),
                })
              }
              options={[
                { value: "car", label: t("category.car") },
                { value: "tuk_tuk", label: t("category.tuk_tuk") },
              ]}
              value={form.category}
            />
            <Field
              label={t("dossier.make")}
              onChangeText={(make) => setForm({ ...form, make })}
              value={form.make}
            />
            <Field
              label={t("dossier.model")}
              onChangeText={(model) => setForm({ ...form, model })}
              value={form.model}
            />
            <Field
              autoCapitalize="characters"
              label={t("dossier.registration")}
              onChangeText={(registration) =>
                setForm({ ...form, registration })
              }
              value={form.registration}
            />
            <Stepper
              label={String(form.capacity)}
              max={limit}
              min={1}
              onChange={(capacity) => setForm({ ...form, capacity })}
              title={t("dossier.capacity")}
              value={form.capacity}
            />
            <Action
              isLoading={uploading === "photo"}
              label={
                form.photoKey ? t("dossier.photoDone") : t("dossier.photo")
              }
              onPress={uploadPhoto}
              variant="secondary"
            />
            {form.id ? <Muted>{t("dossier.recheckHint")}</Muted> : null}
            <Action
              isDisabled={!form.model.trim()}
              isLoading={saveVehicle.isPending}
              label={t("common.save")}
              onPress={() => saveVehicle.mutate(form)}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
