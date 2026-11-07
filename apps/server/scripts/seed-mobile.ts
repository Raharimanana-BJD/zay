// Adds what the mobile app needs on a migrated database, and can run again safely:
// Toliara's places and service zones, then ready to use test accounts.
//   SEED_PASSWORD=motdepasse bun run seed:mobile
// biome-ignore-all lint/performance/noAwaitInLoops: each row depends on the one before it

// biome-ignore lint/performance/noNamespaceImport: this script touches many tables
import * as t from "@zay-app/db/schema/index";
import { eq, inArray, sql } from "drizzle-orm";

import { auth, db } from "../src/services";

const MIN_PASSWORD_LENGTH = 8;
const FILE_LIFETIME_DAYS = 365;
const DAY_MS = 86_400_000;

// Test values, to replace after the field study (scope, Deferred).
const DISTRICTS = [
  ["Besakoa", -23.3545, 43.6705],
  ["Tsimenatse", -23.3478, 43.6682],
  ["Mahavatse", -23.3682, 43.6661],
  ["Mitsinjo Betanimena", -23.3355, 43.6783],
  ["Ankiembe", -23.3395, 43.6642],
  ["Sanfil", -23.3602, 43.6742],
  ["Betania", -23.3735, 43.6702],
  ["Andaboly", -23.3532, 43.6802],
] as const;
const LANDMARKS = [
  ["Bazar Be", -23.3528, 43.6689, "Besakoa"],
  ["Port de Toliara", -23.3615, 43.6612, "Mahavatse"],
  ["Université de Maninday", -23.3345, 43.6881, "Mitsinjo Betanimena"],
  ["Hôpital de Mitsinjo", -23.3381, 43.6771, "Mitsinjo Betanimena"],
  ["Gare routière", -23.3482, 43.6721, "Tsimenatse"],
  ["Place de l'Indépendance", -23.3562, 43.6672, "Besakoa"],
  ["Stade de Mahavatse", -23.3691, 43.6683, "Mahavatse"],
  ["Aéroport de Toliara", -23.3834, 43.7285, "Andaboly"],
] as const;
const TOLIARA_AREA =
  "MULTIPOLYGON(((43.60 -23.45, 43.80 -23.45, 43.80 -23.28, 43.60 -23.28, 43.60 -23.45)))";

const DRIVERS = [
  {
    email: "chauffeur.voiture@zay.test",
    name: "Hery Rakoto",
    phone: "+261340000101",
    relation: "owner",
    vehicle: {
      category: "car",
      make: "Renault",
      model: "Kangoo",
      registration: "1234 TBA",
      capacity: 4,
    },
  },
  {
    email: "chauffeur.tuktuk@zay.test",
    name: "Tahina Be",
    phone: "+261340000102",
    relation: "renter",
    vehicle: {
      category: "tuk_tuk",
      make: "Bajaj",
      model: "RE",
      registration: "5678 TBA",
      capacity: 3,
    },
  },
] as const;

const password = process.env.SEED_PASSWORD ?? "";
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error("Donne SEED_PASSWORD, 8 caractères au moins.");
  process.exit(1);
}

const pointOf = (lat: number, lng: number) => ({ x: lng, y: lat });

async function seedPlaces() {
  const known = await db.select({ name: t.district.name }).from(t.district);
  const names = new Set(known.map((row) => row.name));
  for (const [name, lat, lng] of DISTRICTS) {
    if (!names.has(name)) {
      await db.insert(t.district).values({ name, point: pointOf(lat, lng) });
    }
  }
  const districts = await db
    .select({ id: t.district.id, name: t.district.name })
    .from(t.district);
  const districtId = new Map(districts.map((row) => [row.name, row.id]));
  const knownLandmarks = await db
    .select({ name: t.landmark.name })
    .from(t.landmark);
  const landmarkNames = new Set(knownLandmarks.map((row) => row.name));
  for (const [name, lat, lng, parent] of LANDMARKS) {
    if (!landmarkNames.has(name)) {
      await db.insert(t.landmark).values({
        name,
        point: pointOf(lat, lng),
        districtId: districtId.get(parent),
      });
    }
  }
  const [zones] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(t.serviceZone);
  if (!zones?.total) {
    await db.insert(t.serviceZone).values(
      (["pickup", "destination"] as const).map((kind) => ({
        kind,
        name: `Toliara (${kind})`,
        area: sql`ST_GeomFromText(${TOLIARA_AREA}, 4326)` as unknown as string,
      }))
    );
  }
}

async function accountId(
  email: string,
  name: string,
  phone: string,
  role: "client" | "driver"
) {
  const [existing] = await db
    .select({ id: t.user.id })
    .from(t.user)
    .where(eq(t.user.email, email));
  if (existing) {
    return existing.id;
  }
  const created = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role: role as "admin",
      data: { phone, locale: "fr", emailVerified: true },
    },
  });
  return created.user.id;
}

async function seedDriver(plan: (typeof DRIVERS)[number], adminId: string) {
  const id = await accountId(plan.email, plan.name, plan.phone, "driver");
  const [profile] = await db
    .select({ userId: t.driverProfile.userId })
    .from(t.driverProfile)
    .where(eq(t.driverProfile.userId, id));
  if (profile) {
    return;
  }
  await db.transaction(async (tx) => {
    await tx.insert(t.driverProfile).values({
      userId: id,
      employmentRelation: plan.relation,
      verificationStatus: "approved",
    });
    const [vehicle] = await tx
      .insert(t.vehicle)
      .values({
        ...plan.vehicle,
        driverId: id,
        photoKey: "seed-vehicule.png",
        verificationStatus: "approved",
      })
      .returning({ id: t.vehicle.id });
    await tx
      .update(t.driverProfile)
      .set({ activeVehicleId: vehicle?.id })
      .where(eq(t.driverProfile.userId, id));
    await tx.insert(t.driverDocument).values(
      (["driving_license", "national_id"] as const).map((typeCode) => ({
        driverId: id,
        typeCode,
        storageKey:
          typeCode === "driving_license"
            ? "seed-permis.png"
            : "seed-piece-identite.png",
        expiresAt: new Date(Date.now() + FILE_LIFETIME_DAYS * DAY_MS),
        verificationStatus: "approved" as const,
      }))
    );
    if (adminId) {
      await tx.insert(t.verificationDecision).values({
        subject: "driver",
        subjectId: id,
        status: "approved",
        decidedBy: adminId,
      });
    }
  });
}

await seedPlaces();
const [staff] = await db
  .select({ id: t.user.id })
  .from(t.user)
  .where(inArray(t.user.role, ["admin"]))
  .limit(1);
await accountId(
  "client.demo@zay.test",
  "Voahirana Client",
  "+261340000100",
  "client"
);
for (const plan of DRIVERS) {
  await seedDriver(plan, staff?.id ?? "");
}
console.log(
  "Prêt : client.demo@zay.test, chauffeur.voiture@zay.test, chauffeur.tuktuk@zay.test"
);
process.exit(0);
