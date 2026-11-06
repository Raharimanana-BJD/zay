// Fills a migrated database with believable data for every back office screen.
//   bun run seed:backoffice                Fills an empty database. Stops if already seeded.
//   bun run seed:backoffice --reset --yes  Erases accounts and activity. Creates nothing.
// Every account ends in @zay.test, and a reset refuses to run if any other account exists.
// biome-ignore-all lint/performance/noAwaitInLoops: each row depends on the one before it
// biome-ignore-all lint/suspicious/noAlert: `prompt` is the Bun way to read the password here

import { parseArgs } from "node:util";

import {
  BOOKING_TRANSITIONS,
  type BookingStatus,
  canTransition,
} from "@zay-app/api/domain/booking-status";
import {
  CANCELLATION_REASONS,
  DISPUTE_REASONS,
  type DRIVER_DOCUMENT_TYPES,
  REPORT_TYPES,
} from "@zay-app/api/domain/codes";
import { computeFare } from "@zay-app/api/domain/fare";
// biome-ignore lint/performance/noNamespaceImport: this script touches every table
import * as t from "@zay-app/db/schema/index";
import { desc, eq, gt, not, sql } from "drizzle-orm";

import { auth, db } from "../src/services";

const TEST_DOMAIN = "@zay.test";
const ADMIN_EMAIL = `admin${TEST_DOMAIN}`;
const MIN_PASSWORD_LENGTH = 8;
const TIME_ZONE = "Indian/Antananarivo";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SEED_WINDOW_DAYS = 30;
const OFFER_WINDOW_MS = 10 * MINUTE_MS;
const TOLIARA = { x: 43.6667, y: -23.35 };
const COORDINATE_STEP = 0.0017;

const PLACES = [
  "Marché de Bazar Be",
  "Port de Toliara",
  "Université de Maninday",
  "Hôpital de Mitsinjo",
  "Gare routière de Tsimenatse",
  "Place de l'Indépendance",
  "Stade de Mahavatse",
  "Aéroport de Toliara",
];

const CLIENTS = [
  "Fara Rasoanaivo",
  "Hery Andrianina",
  "Lalaina Ravelo",
  "Miora Razafy",
  "Tojo Rakoto",
];

const DRIVER_NAMES = [
  "Andry Solofo",
  "Bema Tsiry",
  "Dera Manana",
  "Faly Ranaivo",
  "Haja Rabe",
  "Jean Tovo",
  "Koto Randria",
  "Naivo Rija",
  "Rado Zafy",
];

const VEHICLES = [
  { category: "car", make: "Peugeot", model: "405", capacity: 4 },
  { category: "tuk_tuk", make: "Bajaj", model: "RE", capacity: 3 },
] as const;

const PERSONAL_DOCUMENTS = ["driving_license", "national_id"] as const;
const VEHICLE_DOCUMENTS = ["vehicle_registration", "insurance"] as const;
const SPECIMEN_KEYS: Record<(typeof DRIVER_DOCUMENT_TYPES)[number], string> = {
  driving_license: "seed-permis.png",
  national_id: "seed-piece-identite.png",
  vehicle_registration: "seed-vehicule.png",
  insurance: "seed-vehicule.png",
};

type VerificationStatus = (typeof t.verificationStatus.enumValues)[number];
type PaymentStatus = (typeof t.paymentStatus.enumValues)[number];
interface Actor {
  actorId: string | null;
  actorKind: (typeof t.actorKind.enumValues)[number];
}
interface DriverPlan {
  /** Status of each document, by type. Anything absent is approved. */
  documents?: Partial<
    Record<(typeof DRIVER_DOCUMENT_TYPES)[number], VerificationStatus>
  >;
  expiredDocument?: (typeof DRIVER_DOCUMENT_TYPES)[number];
  online?: boolean;
  simulated?: boolean;
  status: VerificationStatus;
}

// The driver table of the spec. Driver numbers below are positions in this list.
const DRIVER_PLANS: readonly DriverPlan[] = [
  {
    status: "pending",
    documents: {
      driving_license: "pending",
      national_id: "pending",
      vehicle_registration: "pending",
      insurance: "pending",
    },
  },
  {
    status: "pending",
    documents: { vehicle_registration: "pending", insurance: "pending" },
    expiredDocument: "national_id",
  },
  {
    status: "changes_requested",
    documents: { driving_license: "changes_requested" },
  },
  { status: "approved", online: true },
  { status: "approved", online: true },
  { status: "approved", online: true },
  { status: "approved", simulated: true, online: true },
  { status: "suspended", expiredDocument: "insurance" },
  { status: "approved", online: true },
];

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function say(message: string) {
  process.stdout.write(`${message}\n`);
}

function one<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("expected a row, got none");
  }
  return row;
}

/** Midnight today in the service time zone, whichever zone this machine uses. */
function startOfToday(moment: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(moment);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const elapsed =
    read("hour") * HOUR_MS + read("minute") * MINUTE_MS + read("second") * 1000;
  return new Date(moment.getTime() - elapsed);
}

async function reset(confirmed: boolean) {
  if (!confirmed) {
    fail(
      "--reset efface tout : relance avec --reset --yes. Rien n'a été effacé."
    );
  }
  const outsiders = await db
    .select({ email: t.user.email })
    .from(t.user)
    .where(not(sql`${t.user.email} LIKE ${`%${TEST_DOMAIN}`}`))
    .limit(1);
  if (outsiders.length > 0) {
    fail(`Un compte hors ${TEST_DOMAIN} existe. Rien n'a été effacé.`);
  }

  await db.transaction(async (tx) => {
    // In foreign key order, children first. Places and zones stay.
    await tx.delete(t.subscriptionPeriod);
    await tx.delete(t.subscriptionPayment);
    await tx.delete(t.subscriptionPlan);
    await tx.delete(t.paymentEvent);
    await tx.delete(t.payment);
    await tx.delete(t.reportEvent);
    await tx.delete(t.report);
    await tx.delete(t.auditLog);
    await tx.delete(t.offerProposal);
    await tx.delete(t.offer);
    await tx.delete(t.dispatchGroup);
    await tx.delete(t.destinationChange);
    await tx.delete(t.fareQuote);
    await tx.delete(t.bookingEvent);
    await tx.delete(t.booking);
    await tx.delete(t.verificationDecision);
    await tx.delete(t.driverPosition);
    await tx.delete(t.driverDocument);
    await tx.update(t.driverProfile).set({ activeVehicleId: null });
    await tx.delete(t.vehicle);
    await tx.delete(t.driverProfile);
    await tx.delete(t.categoryFare).where(
      sql`${t.categoryFare.settingsVersionId} IN (
        SELECT ${t.settingsVersion.id} FROM ${t.settingsVersion}
        WHERE ${t.settingsVersion.version} > 1
      )`
    );
    await tx.delete(t.settingsVersion).where(gt(t.settingsVersion.version, 1));
    await tx.delete(t.session);
    await tx.delete(t.account);
    await tx.delete(t.verification);
    await tx.delete(t.user);
  });
  say("Base vidée. Les réglages de version 1 et les lieux sont gardés.");
}

const { values: flags } = parseArgs({
  options: {
    reset: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

if (flags.reset) {
  await reset(flags.yes);
  process.exit(0);
}

const [alreadySeeded] = await db
  .select({ id: t.user.id })
  .from(t.user)
  .where(eq(t.user.email, ADMIN_EMAIL))
  .limit(1);
if (alreadySeeded) {
  say(`${ADMIN_EMAIL} existe déjà : le seed est déjà passé. Rien n'a changé.`);
  process.exit(0);
}

const [firstOutsider] = await db
  .select({ email: t.user.email })
  .from(t.user)
  .where(not(sql`${t.user.email} LIKE ${`%${TEST_DOMAIN}`}`))
  .limit(1);
if (firstOutsider) {
  fail(`Un compte hors ${TEST_DOMAIN} existe. Rien n'a été créé.`);
}

const password =
  prompt("Mot de passe commun à tous les comptes du seed :") ?? "";
if (password.length < MIN_PASSWORD_LENGTH) {
  fail("Mot de passe trop court (8 caractères au moins). Rien n'a été créé.");
}

const now = new Date();
const todayStart = startOfToday(now);
let phoneCounter = 0;

async function createAccount(
  email: string,
  name: string,
  role: string,
  extra: Record<string, unknown> = {}
) {
  phoneCounter += 1;
  const created = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role: role as "admin",
      data: {
        phone: `+2613499${String(phoneCounter).padStart(5, "0")}`,
        locale: "fr",
        ...extra,
      },
    },
  });
  return created.user.id;
}

const adminId = await createAccount(ADMIN_EMAIL, "Aina Admin", "admin");
const supportId = await createAccount(
  `support${TEST_DOMAIN}`,
  "Sitraka Support",
  "support"
);

const clientIds: string[] = [];
for (const [index, name] of CLIENTS.entries()) {
  const isSuspended = index === CLIENTS.length - 1;
  clientIds.push(
    await createAccount(
      `client${index + 1}${TEST_DOMAIN}`,
      name,
      "client",
      // `banUser` needs a session, so a suspended account is created suspended.
      isSuspended ? { banned: true, banReason: "fraud" } : {}
    )
  );
}

// The suspended client has its audit line, so the screens treat the suspension as complete.
await db.insert(t.auditLog).values({
  actorId: adminId,
  action: "account.banned",
  targetType: "user",
  targetId: clientIds.at(-1) as string,
  before: { banned: false, banReason: null },
  after: { banned: true, reasonCode: "fraud", reasonNote: null },
});

const version1 = one(
  await db
    .select()
    .from(t.settingsVersion)
    .where(eq(t.settingsVersion.version, 1))
);
const fares1 = await db
  .select()
  .from(t.categoryFare)
  .where(eq(t.categoryFare.settingsVersionId, version1.id));

// Bookings older than ten days use version 1, the most recent ones version 2.
const VERSION_2_AGE_DAYS = 10;
const version2Date = new Date(now.getTime() - VERSION_2_AGE_DAYS * DAY_MS);
const { id: _id, createdAt: _at, ...version1Fields } = version1;
const version2 = one(
  await db
    .insert(t.settingsVersion)
    .values({
      ...version1Fields,
      version: 2,
      priceVariationPct: 15,
      changeNote: "Marge de négociation resserrée pour la démo",
      createdBy: adminId,
      createdAt: now,
    })
    .returning()
);
await db.insert(t.categoryFare).values(
  fares1.map(
    ({ settingsVersionId: _version, createdAt: _created, ...fare }) => ({
      ...fare,
      settingsVersionId: version2.id,
      createdAt: now,
    })
  )
);

const versionFor = (date: Date) => (date >= version2Date ? version2 : version1);

// ---- Drivers, vehicles, documents and the decisions that explain them

interface SeededDriver {
  category: "car" | "tuk_tuk";
  userId: string;
  vehicleId: string;
}

const drivers: SeededDriver[] = [];
const ONE_YEAR_MS = 365 * DAY_MS;
const DRIVER_AGE_DAYS = 40;

for (const [index, plan] of DRIVER_PLANS.entries()) {
  const userId = await createAccount(
    `chauffeur${index + 1}${TEST_DOMAIN}`,
    DRIVER_NAMES[index] ?? `Chauffeur ${index + 1}`,
    "driver"
  );
  const created = new Date(now.getTime() - (DRIVER_AGE_DAYS - index) * DAY_MS);
  const vehiclePlan = VEHICLES[index % VEHICLES.length] ?? VEHICLES[0];
  const isApprovedDriver =
    plan.status === "approved" || plan.status === "suspended";

  await db.insert(t.driverProfile).values({
    userId,
    employmentRelation: index % 2 === 0 ? "owner" : "renter",
    verificationStatus: plan.status,
    isSimulated: plan.simulated ?? false,
    createdAt: created,
  });
  const vehicle = one(
    await db
      .insert(t.vehicle)
      .values({
        driverId: userId,
        category: vehiclePlan.category,
        make: vehiclePlan.make,
        model: vehiclePlan.model,
        registration: `${1000 + index} TBA`,
        capacity: vehiclePlan.capacity,
        photoKey: "seed-vehicule.png",
        verificationStatus: isApprovedDriver ? "approved" : "pending",
        createdAt: created,
      })
      .returning()
  );
  await db
    .update(t.driverProfile)
    .set({ activeVehicleId: vehicle.id })
    .where(eq(t.driverProfile.userId, userId));

  const documentTypes = [...PERSONAL_DOCUMENTS, ...VEHICLE_DOCUMENTS];
  for (const typeCode of documentTypes) {
    const status = plan.documents?.[typeCode] ?? "approved";
    const isVehicleDocument = (VEHICLE_DOCUMENTS as readonly string[]).includes(
      typeCode
    );
    const document = one(
      await db
        .insert(t.driverDocument)
        .values({
          driverId: userId,
          vehicleId: isVehicleDocument ? vehicle.id : null,
          typeCode,
          storageKey: SPECIMEN_KEYS[typeCode],
          expiresAt:
            plan.expiredDocument === typeCode
              ? new Date(now.getTime() - 3 * DAY_MS)
              : new Date(now.getTime() + ONE_YEAR_MS),
          verificationStatus: status,
          createdAt: created,
        })
        .returning()
    );
    if (status !== "pending") {
      await db.insert(t.verificationDecision).values({
        subject: "document",
        subjectId: document.id,
        status,
        reasonCode: status === "approved" ? null : "document_unreadable",
        reasonNote: status === "approved" ? null : "Photo floue, à reprendre.",
        decidedBy: adminId,
        createdAt: new Date(created.getTime() + HOUR_MS),
      });
    }
  }

  if (isApprovedDriver) {
    await db.insert(t.verificationDecision).values([
      {
        subject: "vehicle",
        subjectId: vehicle.id,
        status: "approved",
        decidedBy: adminId,
        createdAt: new Date(created.getTime() + 2 * HOUR_MS),
      },
      {
        subject: "driver",
        subjectId: userId,
        status: "approved",
        decidedBy: adminId,
        createdAt: new Date(created.getTime() + 3 * HOUR_MS),
      },
    ]);
  }
  if (plan.status === "suspended") {
    await db.insert(t.verificationDecision).values({
      subject: "driver",
      subjectId: userId,
      status: "suspended",
      reasonCode: "behavior",
      reasonNote: "Plaintes répétées, en attente d'un entretien.",
      decidedBy: adminId,
      createdAt: new Date(now.getTime() - 5 * DAY_MS),
    });
  }
  if (plan.status === "changes_requested") {
    await db.insert(t.verificationDecision).values({
      subject: "driver",
      subjectId: userId,
      status: "changes_requested",
      reasonCode: "document_unreadable",
      decidedBy: adminId,
      createdAt: new Date(created.getTime() + HOUR_MS),
    });
  }

  await db.insert(t.driverPosition).values({
    driverId: userId,
    point: {
      x: TOLIARA.x + index * COORDINATE_STEP,
      y: TOLIARA.y - index * COORDINATE_STEP,
    },
    accuracyM: 12,
    recordedAt: now,
    receivedAt: now,
  });

  drivers.push({
    userId,
    vehicleId: vehicle.id,
    category: vehiclePlan.category,
  });
}

/** Driver numbers count from 1, as in the spec's table. */
function driver(number: number): SeededDriver {
  const found = drivers[number - 1];
  if (!found) {
    throw new Error(`no driver ${number}`);
  }
  return found;
}

// ---- Bookings

interface BookingPlan {
  at: Date;
  cancellationReason?: (typeof CANCELLATION_REASONS)[number];
  driverNumber?: number;
  paymentStatus?: PaymentStatus;
  status: BookingStatus;
}

const SYSTEM: Actor = { actorKind: "system", actorId: null };

/** The path a booking took to reach its status. Checked against the real table below. */
const PATHS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["PENDING"],
  SEARCHING: ["PENDING", "SEARCHING"],
  OFFERED: ["PENDING", "SEARCHING", "OFFERED"],
  ACCEPTED: ["PENDING", "SEARCHING", "OFFERED", "ACCEPTED"],
  DRIVER_ARRIVING: [
    "PENDING",
    "SEARCHING",
    "OFFERED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
  ],
  ARRIVED: [
    "PENDING",
    "SEARCHING",
    "OFFERED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
  ],
  IN_PROGRESS: [
    "PENDING",
    "SEARCHING",
    "OFFERED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_PROGRESS",
  ],
  COMPLETED: [
    "PENDING",
    "SEARCHING",
    "OFFERED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_PROGRESS",
    "COMPLETED",
  ],
  DISPUTED: [
    "PENDING",
    "SEARCHING",
    "OFFERED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_PROGRESS",
    "COMPLETED",
    "DISPUTED",
  ],
  CANCELLED: ["PENDING", "SEARCHING", "CANCELLED"],
  EXPIRED: ["PENDING", "SEARCHING", "EXPIRED"],
  NO_DRIVER_FOUND: ["PENDING", "SEARCHING", "NO_DRIVER_FOUND"],
};

for (const path of Object.values(PATHS)) {
  for (const [index, from] of path.slice(0, -1).entries()) {
    const to = path[index + 1];
    if (!(to && canTransition(from, to))) {
      throw new Error(`seed path breaks the status table: ${from} to ${to}`);
    }
  }
}
if (Object.keys(BOOKING_TRANSITIONS).length !== Object.keys(PATHS).length) {
  throw new Error("seed paths do not cover every booking status");
}

const STATUS_WITH_DRIVER = new Set<BookingStatus>([
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "DISPUTED",
]);

const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);
/** A date earlier today, never before midnight, even just after midnight. */
const todayAt = (fraction: number) =>
  new Date(
    todayStart.getTime() + (now.getTime() - todayStart.getTime()) * fraction
  );
/** Between yesterday and the start of the window, spread evenly by position. */
const pastDay = (position: number, count: number) =>
  new Date(
    todayStart.getTime() -
      HOUR_MS * 3 -
      ((position + 1) / (count + 1)) * (SEED_WINDOW_DAYS - 1) * DAY_MS
  );

const ACTIVE_RECENT_HOURS = 0.2;
const COMPLETED_COUNT = 18;
const COMPLETED_TODAY = 3;
const COMPLETED_PAYMENTS: readonly PaymentStatus[] = [
  ...new Array<PaymentStatus>(12).fill("paid"),
  ...new Array<PaymentStatus>(3).fill("partial"),
  ...new Array<PaymentStatus>(2).fill("pending"),
  "disputed",
];
const CANCELLED_COUNT = 10;
const CANCELLED_TODAY = 2;
const COMPLETED_DRIVERS = [
  7, 7, 7, 7, 4, 5, 6, 9, 4, 5, 6, 9, 4, 5, 6, 9, 4, 5,
];
const NO_DRIVER_TODAY = 1;

const plans: BookingPlan[] = [
  { status: "PENDING", at: hoursAgo(ACTIVE_RECENT_HOURS / 2) },
  { status: "SEARCHING", at: hoursAgo(ACTIVE_RECENT_HOURS) },
  { status: "OFFERED", at: hoursAgo(ACTIVE_RECENT_HOURS), driverNumber: 9 },
  { status: "ACCEPTED", at: hoursAgo(ACTIVE_RECENT_HOURS), driverNumber: 4 },
  {
    status: "DRIVER_ARRIVING",
    at: hoursAgo(ACTIVE_RECENT_HOURS),
    driverNumber: 5,
  },
  { status: "ARRIVED", at: hoursAgo(ACTIVE_RECENT_HOURS), driverNumber: 6 },
  { status: "IN_PROGRESS", at: hoursAgo(ACTIVE_RECENT_HOURS), driverNumber: 7 },
];
for (let index = 0; index < COMPLETED_COUNT; index += 1) {
  plans.push({
    status: "COMPLETED",
    at:
      index < COMPLETED_TODAY
        ? todayAt((index + 1) / (COMPLETED_TODAY + 2))
        : pastDay(index - COMPLETED_TODAY, COMPLETED_COUNT - COMPLETED_TODAY),
    driverNumber: COMPLETED_DRIVERS[index],
    paymentStatus: COMPLETED_PAYMENTS[index],
  });
}
plans.push({
  status: "DISPUTED",
  at: pastDay(4, 9),
  driverNumber: 4,
  paymentStatus: "paid",
});
for (let index = 0; index < CANCELLED_COUNT; index += 1) {
  plans.push({
    status: "CANCELLED",
    at:
      index < CANCELLED_TODAY
        ? todayAt((index + 1) / (CANCELLED_TODAY + 3))
        : pastDay(index - CANCELLED_TODAY, CANCELLED_COUNT - CANCELLED_TODAY),
    cancellationReason:
      CANCELLATION_REASONS[index % CANCELLATION_REASONS.length],
  });
}
plans.push(
  { status: "EXPIRED", at: pastDay(1, 4) },
  { status: "EXPIRED", at: pastDay(2, 4) }
);
for (let index = 0; index < 3; index += 1) {
  plans.push({
    status: "NO_DRIVER_FOUND",
    at: index < NO_DRIVER_TODAY ? todayAt(0.5) : pastDay(index, 3),
  });
}

const STEP_MS = 3 * MINUTE_MS;
const RIDE_BASE_M = 1500;
const RIDE_STEP_M = 450;
const FREE_CLIENTS = clientIds.length - 1;

const seededBookings: {
  id: string;
  status: BookingStatus;
  clientId: string;
  driverId?: string;
}[] = [];

for (const [index, plan] of plans.entries()) {
  // The suspended client keeps only older bookings, so no active ride belongs to them.
  const clientPool = plan.at < todayStart ? clientIds.length : FREE_CLIENTS;
  const clientId = clientIds[index % clientPool] as string;
  const seededDriver = plan.driverNumber
    ? driver(plan.driverNumber)
    : undefined;
  const settings = versionFor(plan.at);
  const category =
    seededDriver?.category ?? (index % 2 === 0 ? "car" : "tuk_tuk");
  const fareRule = fares1.find((row) => row.category === category);
  if (!fareRule) {
    throw new Error(`no fare for ${category}`);
  }
  const distanceM = RIDE_BASE_M + (index % 8) * RIDE_STEP_M;
  const fare = computeFare(fareRule, distanceM, settings.priceVariationPct);
  const path = PATHS[plan.status];
  // Steps shrink for very recent bookings, so nothing is dated in the future.
  const stepMs = Math.min(
    STEP_MS,
    (now.getTime() - plan.at.getTime()) / path.length
  );
  const lastStatusAt = new Date(plan.at.getTime() + (path.length - 1) * stepMs);
  const isAssigned = STATUS_WITH_DRIVER.has(plan.status);
  const pickup = PLACES[index % PLACES.length];
  const destination = PLACES[(index + 3) % PLACES.length];

  const booking = one(
    await db
      .insert(t.booking)
      .values({
        clientId,
        clientRequestId: crypto.randomUUID(),
        requestedCategory: index % 5 === 0 ? "auto" : category,
        passengers: 1 + (index % 3),
        status: plan.status,
        settingsVersionId: settings.id,
        driverId: isAssigned ? seededDriver?.userId : null,
        vehicleId: isAssigned ? seededDriver?.vehicleId : null,
        agreedPriceAr: isAssigned ? fare.amountAr : null,
        pickupPoint: {
          x: TOLIARA.x + (index % 7) * COORDINATE_STEP,
          y: TOLIARA.y + (index % 5) * COORDINATE_STEP,
        },
        pickupNote: pickup,
        destinationPoint: {
          x: TOLIARA.x - (index % 6) * COORDINATE_STEP,
          y: TOLIARA.y - (index % 4) * COORDINATE_STEP,
        },
        destinationNote: destination,
        statusChangedAt: lastStatusAt,
        completedAt:
          plan.status === "COMPLETED" || plan.status === "DISPUTED"
            ? new Date(
                lastStatusAt.getTime() -
                  (plan.status === "DISPUTED" ? stepMs : 0)
              )
            : null,
        createdAt: plan.at,
      })
      .returning()
  );
  seededBookings.push({
    id: booking.id,
    status: plan.status,
    clientId,
    driverId: isAssigned ? seededDriver?.userId : undefined,
  });

  const quote = one(
    await db
      .insert(t.fareQuote)
      .values({
        bookingId: booking.id,
        category,
        settingsVersionId: settings.id,
        distanceM,
        distanceSource: index % 4 === 0 ? "fallback" : "route",
        amountAr: fare.amountAr,
        minAr: fare.minAr,
        maxAr: fare.maxAr,
        createdAt: plan.at,
      })
      .returning()
  );

  // Status events, each one a real step of the table.
  for (const [step, to] of path.entries()) {
    if (step === 0) {
      continue;
    }
    const isLast = step === path.length - 1;
    const isCancellation = isLast && plan.status === "CANCELLED";
    const isDispute = isLast && plan.status === "DISPUTED";
    let actor: Actor = SYSTEM;
    if (isCancellation) {
      actor =
        plan.cancellationReason === "support_intervention"
          ? { actorKind: "support", actorId: supportId }
          : { actorKind: "client", actorId: clientId };
    } else if (isDispute) {
      actor = { actorKind: "support", actorId: supportId };
    } else if (STATUS_WITH_DRIVER.has(to) && seededDriver) {
      actor = { actorKind: "driver", actorId: seededDriver.userId };
    }
    let reasonCode: string | null = null;
    if (isCancellation) {
      reasonCode = plan.cancellationReason ?? null;
    } else if (isDispute) {
      reasonCode = DISPUTE_REASONS[0];
    }
    await db.insert(t.bookingEvent).values({
      bookingId: booking.id,
      type: isDispute ? "dispute_opened" : "status_changed",
      fromStatus: path[step - 1],
      toStatus: to,
      ...actor,
      reasonCode,
      reasonNote:
        isCancellation && plan.cancellationReason === "other"
          ? "Le client a trouvé un autre moyen de transport."
          : null,
      clientRequestId: actor.actorId ? crypto.randomUUID() : null,
      createdAt: new Date(plan.at.getTime() + step * stepMs),
    });
  }

  // Search groups and offers, for everything that got past `PENDING`.
  if (plan.status === "PENDING") {
    continue;
  }
  const searchStart = new Date(plan.at.getTime() + stepMs);
  const isSearching = plan.status === "SEARCHING" || plan.status === "OFFERED";
  const closedStatus =
    plan.status === "NO_DRIVER_FOUND" ? "exhausted" : "closed";
  const groupStatus = isSearching ? "active" : closedStatus;
  const group = one(
    await db
      .insert(t.dispatchGroup)
      .values({
        bookingId: booking.id,
        sequence: 1,
        status: groupStatus,
        startedAt: searchStart,
        expiresAt: new Date(now.getTime() + OFFER_WINDOW_MS),
        endedAt: isSearching ? null : lastStatusAt,
        createdAt: searchStart,
      })
      .returning()
  );

  if (!seededDriver) {
    continue;
  }
  const isOpenOffer = plan.status === "OFFERED";
  const offer = one(
    await db
      .insert(t.offer)
      .values({
        bookingId: booking.id,
        groupId: group.id,
        driverId: seededDriver.userId,
        vehicleId: seededDriver.vehicleId,
        fareQuoteId: quote.id,
        category,
        status: isOpenOffer ? "sent" : "accepted",
        currentPriceAr: isOpenOffer ? null : fare.amountAr,
        expiresAt: isOpenOffer
          ? new Date(now.getTime() + OFFER_WINDOW_MS)
          : lastStatusAt,
        createdAt: searchStart,
      })
      .returning()
  );
  if (!isOpenOffer) {
    await db.insert(t.offerProposal).values([
      {
        offerId: offer.id,
        actorKind: "driver",
        actorId: seededDriver.userId,
        kind: "accept",
        amountAr: fare.amountAr,
        clientRequestId: crypto.randomUUID(),
        createdAt: searchStart,
      },
      {
        offerId: offer.id,
        actorKind: "client",
        actorId: clientId,
        kind: "accept",
        amountAr: fare.amountAr,
        clientRequestId: crypto.randomUUID(),
        createdAt: lastStatusAt,
      },
    ]);
  }

  if (!plan.paymentStatus) {
    continue;
  }
  const declaredAmounts: Record<PaymentStatus, number | null> = {
    paid: fare.amountAr,
    partial: Math.floor(fare.amountAr / 2),
    pending: null,
    disputed: fare.amountAr,
  };
  const payment = one(
    await db
      .insert(t.payment)
      .values({
        bookingId: booking.id,
        agreedAmountAr: fare.amountAr,
        declaredAmountAr: declaredAmounts[plan.paymentStatus],
        status: plan.paymentStatus,
        createdAt: lastStatusAt,
      })
      .returning()
  );
  if (plan.paymentStatus !== "pending") {
    await db.insert(t.paymentEvent).values({
      paymentId: payment.id,
      kind: "declared",
      amountAr: declaredAmounts[plan.paymentStatus],
      actorKind: "driver",
      actorId: seededDriver.userId,
      clientRequestId: crypto.randomUUID(),
      createdAt: lastStatusAt,
    });
  }
  if (plan.paymentStatus === "disputed") {
    await db.insert(t.paymentEvent).values({
      paymentId: payment.id,
      kind: "disputed",
      actorKind: "client",
      actorId: clientId,
      reasonCode: DISPUTE_REASONS[0],
      reasonNote: "Le client dit avoir payé moins que le montant déclaré.",
      clientRequestId: crypto.randomUUID(),
      createdAt: lastStatusAt,
    });
  }
}

// ---- Drivers 4 to 7 and 9 are online. Those with an active ride are not available.

for (const [index, plan] of DRIVER_PLANS.entries()) {
  if (!plan.online) {
    continue;
  }
  const number = index + 1;
  await db
    .update(t.driverProfile)
    .set({ isOnline: true, isAvailable: number === 9 })
    .where(eq(t.driverProfile.userId, driver(number).userId));
}

// ---- Reports: one per status on a booking, and one with no booking

const REPORT_BOOKINGS = seededBookings.filter(
  (row) => row.status === "COMPLETED"
);
const REPORT_PLANS = [
  {
    status: "open",
    type: "payment_issue",
    text: "Le chauffeur demande plus que le prix convenu.",
  },
  {
    status: "in_progress",
    type: "safety",
    text: "Conduite dangereuse sur la route du port.",
  },
  {
    status: "resolved",
    type: "driver_absent",
    text: "Le chauffeur n'est jamais arrivé.",
  },
  {
    status: "closed",
    type: "client_absent",
    text: "Le client n'était pas au point de départ.",
  },
] as const;

const TEAM_ACTOR_NOTES = {
  in_progress: "Pris en charge, j'appelle le chauffeur.",
  resolved: "Le chauffeur a été rappelé à l'ordre.",
  closed: "Dossier clos.",
};
const REPORT_PATH: Record<
  (typeof REPORT_PLANS)[number]["status"],
  readonly ("open" | "in_progress" | "resolved" | "closed")[]
> = {
  open: ["open"],
  in_progress: ["open", "in_progress"],
  resolved: ["open", "in_progress", "resolved"],
  closed: ["open", "in_progress", "resolved", "closed"],
};

for (const [index, plan] of REPORT_PLANS.entries()) {
  const reported = REPORT_BOOKINGS[index];
  if (!reported) {
    throw new Error("not enough completed bookings for the reports");
  }
  const createdAt = hoursAgo(24 * (index + 1));
  const report = one(
    await db
      .insert(t.report)
      .values({
        bookingId: reported.id,
        authorId: reported.clientId,
        typeCode: plan.type,
        description: plan.text,
        status: plan.status,
        assigneeId: plan.status === "open" ? null : supportId,
        clientRequestId: crypto.randomUUID(),
        createdAt,
      })
      .returning()
  );
  const path = REPORT_PATH[plan.status];
  for (const [step, to] of path.entries()) {
    if (step === 0) {
      continue;
    }
    await db.insert(t.reportEvent).values({
      reportId: report.id,
      actorId: supportId,
      fromStatus: path[step - 1],
      toStatus: to,
      note: TEAM_ACTOR_NOTES[to as keyof typeof TEAM_ACTOR_NOTES],
      createdAt: new Date(createdAt.getTime() + step * HOUR_MS),
    });
  }
}
await db.insert(t.report).values({
  authorId: driver(4).userId,
  typeCode: REPORT_TYPES[4],
  description: "Comment changer le véhicule actif de mon compte ?",
  clientRequestId: crypto.randomUUID(),
  createdAt: hoursAgo(2),
});

const [latest] = await db
  .select({ version: t.settingsVersion.version })
  .from(t.settingsVersion)
  .orderBy(desc(t.settingsVersion.version))
  .limit(1);
say(
  `Seed terminé : ${clientIds.length + drivers.length + 2} comptes, ${plans.length} réservations, réglages en version ${latest?.version}.`
);
say(
  `Connexion : ${ADMIN_EMAIL} ou support${TEST_DOMAIN}, avec le mot de passe saisi.`
);
process.exit(0);
