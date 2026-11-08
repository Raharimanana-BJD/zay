import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zay-app/api/routers/index";
import { useFocusEffect } from "expo-router";
import { Spinner, useToast } from "heroui-native";
import { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Field } from "@/components/auth-fields";
import { AuthImage } from "@/components/auth-image";
import { DocumentsBlock } from "@/components/documents-block";
import { Sheet } from "@/components/sheet";
import { SourceChoice } from "@/components/source-choice";
import {
  Action,
  INK,
  Loading,
  MUTED_INK,
  Muted,
  Notice,
  Pill,
  Screen,
  Segment,
  Stepper,
  Title,
} from "@/components/ui";
import { type TKey, useI18n } from "@/lib/i18n";
import { type ImageSource, pickImage } from "@/lib/pick-image";
import { uploadFile } from "@/lib/upload";
import { useErrorLabel, useErrorToast } from "@/lib/use-action";
import { trpc, trpcClient } from "@/utils/trpc";

type Dossier = inferRouterOutputs<AppRouter>["driver"]["dossier"];
type Vehicle = Dossier["vehicles"][number];
type Relation = "owner" | "renter" | "employee";
type Category = "car" | "tuk_tuk";

interface VehicleForm {
  capacity: number;
  category: Category;
  id?: string;
  /** The picture just taken or chosen, shown before the server has it. */
  localPhoto?: string;
  make: string;
  model: string;
  /** A new key from `/files/photo`. Absent keeps the vehicle's current photo. */
  photoKey?: string;
  /** The photo the server already holds, for an edit. */
  photoUrl?: string;
  registration: string;
}

const EMPTY_VEHICLE: VehicleForm = {
  category: "car",
  make: "",
  model: "",
  registration: "",
  capacity: 4,
};

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

const verification = (value: string): Verification =>
  value in PILL_TONE ? (value as Verification) : "pending";

const vehicleName = (vehicle: { make: string | null; model: string }) =>
  [vehicle.make, vehicle.model].filter(Boolean).join(" ");

/** The numbered title of a step, with a check once it is done. */
function StepHeader({
  index,
  title,
  isDone,
}: {
  index: number;
  title: string;
  isDone: boolean;
}) {
  return (
    <View
      accessibilityRole="header"
      className="mt-3 flex-row items-center gap-3"
    >
      <View
        className={`size-8 items-center justify-center rounded-full ${isDone ? "bg-success" : "bg-foreground"}`}
      >
        {isDone ? (
          <Ionicons color="#ffffff" name="checkmark" size={18} />
        ) : (
          <Text className="font-bold text-sm text-white">{index}</Text>
        )}
      </View>
      <Text className="flex-1 font-bold text-foreground text-lg">{title}</Text>
    </View>
  );
}

/** How far the dossier is: one step per section and per paper. */
function ProgressCard({
  done,
  total,
  isWaiting,
}: {
  done: number;
  total: number;
  isWaiting: boolean;
}) {
  const { t } = useI18n();
  const left = total - done;
  return (
    <View className="gap-3 rounded-3xl bg-foreground p-5">
      <View className="flex-row items-end justify-between gap-3">
        <Text className="font-black text-4xl text-white">
          {done}
          <Text className="font-bold text-lg text-white/60"> / {total}</Text>
        </Text>
        <Text className="pb-1 text-sm text-white/70">
          {t("dossier.stepsCount", { n: done, total })}
        </Text>
      </View>
      <View
        accessibilityLabel={t("dossier.stepsCount", { n: done, total })}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
        className="h-2 overflow-hidden rounded-full bg-white/15"
      >
        <View
          className="h-2 rounded-full bg-brand"
          style={{ width: `${(done / Math.max(total, 1)) * 100}%` }}
        />
      </View>
      <Text className="font-semibold text-base text-white">
        {left > 0 ? t("dossier.stepsLeft", { n: left }) : t("dossier.complete")}
      </Text>
      {left === 0 && isWaiting ? (
        <Text className="text-sm text-white/70">
          {t("dossier.completeHint")}
        </Text>
      ) : null}
    </View>
  );
}

function VehicleCard({
  vehicle,
  isActive,
  onUse,
  onEdit,
}: {
  vehicle: Vehicle;
  isActive: boolean;
  onUse: () => void;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const state = verification(vehicle.verificationStatus);
  const name = vehicleName(vehicle);
  return (
    <View
      className={`overflow-hidden rounded-3xl bg-surface shadow-black/5 shadow-sm ${isActive ? "border-2 border-foreground" : ""}`}
    >
      {vehicle.photoUrl ? (
        <AuthImage
          className="h-40 w-full bg-surface-tertiary"
          label={t("dossier.photoOf", { name })}
          uri={vehicle.photoUrl}
        />
      ) : (
        <View className="h-28 w-full items-center justify-center gap-1 bg-surface-tertiary">
          <Ionicons
            color={MUTED_INK}
            name={
              vehicle.category === "car" ? "car-outline" : "bicycle-outline"
            }
            size={30}
          />
          <Text className="text-muted text-xs">{t("dossier.noPhoto")}</Text>
        </View>
      )}
      <View className="gap-3 p-4">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="font-bold text-base text-foreground">{name}</Text>
            <Muted>
              {[
                t(`category.${vehicle.category}` as TKey),
                vehicle.registration,
                t("offer.seats", { n: vehicle.capacity }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Muted>
            {isActive ? (
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <Ionicons color={INK} name="checkmark-circle" size={16} />
                <Text className="font-semibold text-foreground text-sm">
                  {t("dossier.inUse")}
                </Text>
              </View>
            ) : null}
          </View>
          <Pill
            label={t(`verificationShort.${state}` as TKey)}
            tone={PILL_TONE[state]}
          />
        </View>
        <View className="flex-row gap-2">
          {isActive ? null : (
            <View className="flex-1">
              <Action label={t("dossier.useVehicle")} onPress={onUse} />
            </View>
          )}
          <View className={isActive ? "flex-1" : ""}>
            <Action
              icon="create-outline"
              label={t("common.edit")}
              onPress={onEdit}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** The vehicle photo in the form: what it looks like now, and the two sources. */
function PhotoField({
  form,
  isSending,
  error,
  onPick,
}: {
  form: VehicleForm;
  isSending: boolean;
  error: string | null;
  onPick: (source: ImageSource) => void;
}) {
  const { t } = useI18n();
  const box = "h-44 w-full rounded-2xl bg-surface-tertiary";
  let preview = (
    <View
      className={`${box} items-center justify-center gap-2 border border-border border-dashed`}
    >
      <Ionicons
        color={MUTED_INK}
        name={form.category === "car" ? "car-outline" : "bicycle-outline"}
        size={34}
      />
      <Text className="px-6 text-center text-muted text-sm">
        {t("dossier.photoHint")}
      </Text>
    </View>
  );
  if (form.localPhoto) {
    preview = <Image className={box} source={{ uri: form.localPhoto }} />;
  } else if (form.photoUrl) {
    preview = (
      <AuthImage
        className={box}
        label={t("dossier.photoTitle")}
        uri={form.photoUrl}
      />
    );
  }
  return (
    <View className="gap-3">
      <Text className="font-bold text-muted text-xs uppercase tracking-wider">
        {t("dossier.photoTitle")}
      </Text>
      <View>
        {preview}
        {isSending ? (
          <View className="absolute inset-0 items-center justify-center gap-2 rounded-2xl bg-black/50">
            <Spinner color="#ffffff" />
            <Text className="font-semibold text-sm text-white">
              {t("dossier.photoSending")}
            </Text>
          </View>
        ) : null}
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-medium text-danger text-sm"
        >
          {error}
        </Text>
      ) : null}
      <SourceChoice isDisabled={isSending} onPick={onPick} />
    </View>
  );
}

export default function DossierScreen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const showError = useErrorToast();
  const errorLabel = useErrorLabel();
  const dossier = useQuery(trpc.driver.dossier.queryOptions());
  const { refetch } = dossier;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [isPhotoSending, setIsPhotoSending] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const setRelation = useMutation({
    mutationFn: (employmentRelation: Relation) =>
      trpcClient.driver.setRelation.mutate({ employmentRelation }),
    onError: showError,
    onSettled: () => refetch(),
  });
  const saveVehicle = useMutation({
    mutationFn: ({
      make,
      registration,
      localPhoto: _localPhoto,
      photoUrl: _photoUrl,
      ...vehicle
    }: VehicleForm) =>
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

  const openForm = (next: VehicleForm) => {
    setPhotoError(null);
    setForm(next);
  };

  /** Shows the picture at once, then sends it; saving only needs its key. */
  const choosePhoto = async (source: ImageSource) => {
    setPhotoError(null);
    let picked: Awaited<ReturnType<typeof pickImage>>;
    try {
      picked = await pickImage(source);
    } catch (error) {
      setPhotoError(errorLabel(error));
      return;
    }
    if (!picked) {
      return;
    }
    const { uri } = picked;
    setForm((current) => (current ? { ...current, localPhoto: uri } : current));
    setIsPhotoSending(true);
    try {
      const key = await uploadFile(uri, "photo");
      setForm((current) => (current ? { ...current, photoKey: key } : current));
    } catch (error) {
      // The server does not have it, so the form goes back to the photo it had.
      setForm((current) =>
        current
          ? { ...current, localPhoto: undefined, photoKey: undefined }
          : current
      );
      setPhotoError(errorLabel(error));
    } finally {
      setIsPhotoSending(false);
    }
  };

  const data = dossier.data;
  if (!data) {
    return <Loading />;
  }
  const limit = form ? data.capacityLimits[form.category] : 1;
  const overall = verification(data.verificationStatus);

  const activeVehicle = data.vehicles.find(
    (vehicle) => vehicle.id === data.activeVehicleId
  );
  const isRelationDone = Boolean(data.employmentRelation);
  const isVehicleDone = Boolean(activeVehicle?.photoKey);
  const sentDocuments = data.requiredDocuments.filter((code) =>
    data.documents.some((doc) => doc.typeCode === code)
  ).length;
  const isDocumentsDone = sentDocuments === data.requiredDocuments.length;
  const total = 2 + data.requiredDocuments.length;
  const done = Number(isRelationDone) + Number(isVehicleDone) + sentDocuments;

  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-3">
        <Title>{t("nav.vehicle")}</Title>
        <Pill
          label={t(`verificationShort.${overall}` as TKey)}
          tone={PILL_TONE[overall]}
        />
      </View>
      <ProgressCard
        done={done}
        isWaiting={overall === "pending"}
        total={total}
      />
      {data.verificationStatus === "changes_requested" ? (
        <Notice tone="warning">{t("dossier.changesRequested")}</Notice>
      ) : null}
      {data.lastDecision?.reasonNote ? (
        <Notice>{data.lastDecision.reasonNote}</Notice>
      ) : null}

      <StepHeader
        index={1}
        isDone={isRelationDone}
        title={t("relation.title")}
      />
      <Segment<Relation>
        onChange={(value) => setRelation.mutate(value)}
        options={[
          { value: "owner", label: t("relation.owner") },
          { value: "renter", label: t("relation.renter") },
          { value: "employee", label: t("relation.employee") },
        ]}
        value={data.employmentRelation}
      />

      <StepHeader
        index={2}
        isDone={isVehicleDone}
        title={t("dossier.vehicles")}
      />
      {isVehicleDone ? null : <Muted>{t("dossier.vehicleHint")}</Muted>}
      {data.vehicles.map((vehicle) => (
        <VehicleCard
          isActive={data.activeVehicleId === vehicle.id}
          key={vehicle.id}
          onEdit={() =>
            openForm({
              id: vehicle.id,
              category: vehicle.category,
              make: vehicle.make ?? "",
              model: vehicle.model,
              registration: vehicle.registration ?? "",
              capacity: vehicle.capacity,
              photoUrl: vehicle.photoUrl ?? undefined,
            })
          }
          onUse={() => setActive.mutate(vehicle.id)}
          vehicle={vehicle}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-border border-dashed bg-surface active:bg-surface-tertiary"
        onPress={() => openForm(EMPTY_VEHICLE)}
      >
        <Ionicons color={INK} name="add" size={20} />
        <Text className="font-bold text-base text-foreground">
          {t("dossier.addVehicle")}
        </Text>
      </Pressable>

      <StepHeader
        index={3}
        isDone={isDocumentsDone}
        title={t("dossier.documents")}
      />
      <DocumentsBlock dossier={data} onSent={refetch} />

      <Sheet
        onClose={() => setForm(null)}
        title={form?.id ? t("common.edit") : t("dossier.addVehicle")}
        visible={form !== null}
      >
        {form ? (
          <View className="gap-3">
            <PhotoField
              error={photoError}
              form={form}
              isSending={isPhotoSending}
              onPick={choosePhoto}
            />
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
            {form.id ? <Muted>{t("dossier.recheckHint")}</Muted> : null}
            <Action
              isDisabled={!form.model.trim() || isPhotoSending}
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
