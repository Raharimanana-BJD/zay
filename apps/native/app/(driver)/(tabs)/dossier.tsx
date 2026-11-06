import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { Input, Label, TextField, useToast } from "heroui-native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { Sheet } from "@/components/sheet";
import {
  Action,
  Card,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Screen,
  Segment,
  Stepper,
  Title,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { type TKey, useI18n } from "@/lib/i18n";
import { useErrorToast } from "@/lib/use-action";
import { trpc, trpcClient } from "@/utils/trpc";

import { ENV } from "../../../src/env";

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
  const file = await fetch(asset.uri);
  const cookie = await authClient.getCookie();
  const response = await fetch(`${ENV.EXPO_PUBLIC_SERVER_URL}/files/${kind}`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/octet-stream",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: await file.blob(),
  });
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    key?: string;
  };
  if (!(response.ok && body.key)) {
    throw new Error(body.code ?? "UPLOAD_FAILED");
  }
  return body.key;
}

function Status({ value }: { value: string }) {
  const { t } = useI18n();
  return <>{t(`verification.${value}` as TKey)}</>;
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

  return (
    <Screen>
      <Title>{t("nav.vehicle")}</Title>
      <Card>
        <Row
          label={t("dossier.status")}
          strong
          value={<Status value={data.verificationStatus} />}
        />
        {data.lastDecision?.reasonNote ? (
          <Muted>{data.lastDecision.reasonNote}</Muted>
        ) : null}
      </Card>
      {data.verificationStatus === "changes_requested" ? (
        <Notice tone="warning">{t("dossier.changesRequested")}</Notice>
      ) : null}
      <Heading>{t("relation.title")}</Heading>
      <Segment<Relation>
        onChange={(value) => setRelation.mutate(value)}
        options={[
          { value: "owner", label: t("relation.owner") },
          { value: "renter", label: t("relation.renter") },
          { value: "employee", label: t("relation.employee") },
        ]}
        value={data.employmentRelation}
      />
      <Heading>{t("dossier.vehicles")}</Heading>
      {data.vehicles.length === 0 ? (
        <Muted>{t("dossier.noVehicle")}</Muted>
      ) : null}
      {data.vehicles.map((vehicle) => (
        <Card key={vehicle.id}>
          <Text className="font-bold text-foreground text-lg">
            {t(`category.${vehicle.category}` as TKey)} ·{" "}
            {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
          </Text>
          {vehicle.registration ? <Muted>{vehicle.registration}</Muted> : null}
          <Row
            label={t("dossier.capacity")}
            value={t("offer.seats", { n: vehicle.capacity })}
          />
          <Row
            label={t("dossier.status")}
            value={<Status value={vehicle.verificationStatus} />}
          />
          {data.activeVehicleId === vehicle.id ? (
            <Text className="font-medium text-foreground">
              {t("dossier.inUse")}
            </Text>
          ) : (
            <Action
              label={t("dossier.useVehicle")}
              onPress={() => setActive.mutate(vehicle.id)}
              variant="secondary"
            />
          )}
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
            variant="tertiary"
          />
        </Card>
      ))}
      <Action
        label={t("dossier.addVehicle")}
        onPress={() => setForm(EMPTY_VEHICLE)}
        variant="secondary"
      />
      <Heading>{t("dossier.documents")}</Heading>
      <Muted>{t("dossier.documentsHint")}</Muted>
      {data.requiredDocuments.map((typeCode) => {
        const document = data.documents.find((d) => d.typeCode === typeCode);
        return (
          <Card key={typeCode}>
            <Row
              label={t(`document.${typeCode}` as TKey)}
              value={
                document ? (
                  <Status value={document.verificationStatus} />
                ) : (
                  t("dossier.missing")
                )
              }
            />
            <Action
              isLoading={uploading === typeCode}
              label={document ? t("dossier.replace") : t("dossier.send")}
              onPress={() => uploadDocument(typeCode)}
              variant="secondary"
            />
          </Card>
        );
      })}
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
            <TextField>
              <Label>{t("dossier.make")}</Label>
              <Input
                onChangeText={(make) => setForm({ ...form, make })}
                value={form.make}
              />
            </TextField>
            <TextField>
              <Label>{t("dossier.model")}</Label>
              <Input
                onChangeText={(model) => setForm({ ...form, model })}
                value={form.model}
              />
            </TextField>
            <TextField>
              <Label>{t("dossier.registration")}</Label>
              <Input
                autoCapitalize="characters"
                onChangeText={(registration) =>
                  setForm({ ...form, registration })
                }
                value={form.registration}
              />
            </TextField>
            <Muted>{t("dossier.capacity")}</Muted>
            <Stepper
              label={t("offer.seats", { n: form.capacity })}
              max={limit}
              min={1}
              onChange={(capacity) => setForm({ ...form, capacity })}
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
