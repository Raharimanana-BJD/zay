// Checks spec 0001 against a real database: a full ride, then every refusal the
// database must make. It works in a throwaway database, so dev data stays untouched.
// Run with `bun run db:verify`, with local PostgreSQL started.

import { computeFare } from "@zay-app/api/domain/fare";
import { createAuth } from "@zay-app/auth";
import { createDb } from "@zay-app/db";
// biome-ignore lint/performance/noNamespaceImport: this script touches every table
import * as t from "@zay-app/db/schema/index";
import { eq, isNull, type SQL, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { ENV } from "../src/env.server";

const SCRATCH_DB = "zay_verify";
const MIGRATIONS_FOLDER = `${import.meta.dir}/../../../packages/db/src/migrations`;
const EXPECTED_NEW_TABLES = 25;
const CENTER = { x: 43.6667, y: -23.35 };
const NEARBY = { x: 43.6667, y: -23.34 };
// One hundredth of a degree of latitude, along the meridian at this latitude.
const NEARBY_DISTANCE_M = 1107.5;
const DISTANCE_TOLERANCE_M = 5;

function one<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("expected a row, got none");
  }
  return row;
}

const scratchUrl = new URL(ENV.DATABASE_URL);
scratchUrl.pathname = `/${SCRATCH_DB}`;

const maintenance = createDb(ENV);
await maintenance.execute(
  sql.raw(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`)
);
await maintenance.execute(sql.raw(`CREATE DATABASE ${SCRATCH_DB}`));

const db = createDb({ ...ENV, DATABASE_URL: scratchUrl.toString() });
await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
const auth = createAuth(ENV, db);

const settings = one(
  await db
    .select()
    .from(t.settingsVersion)
    .where(eq(t.settingsVersion.version, 1))
);

let failures = 0;
let passes = 0;

async function check(label: string, run: () => Promise<void> | void) {
  try {
    await run();
    passes += 1;
    process.stdout.write(`  ok    ${label}\n`);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`  FAIL  ${label}\n        ${message}\n`);
  }
}

function section(title: string) {
  process.stdout.write(`\n${title}\n`);
}

function equal(actual: unknown, expected: unknown, what = "value") {
  const [a, b] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== b) {
    throw new Error(`${what}: expected ${b}, got ${a}`);
  }
}

function assertTrue(condition: boolean, what: string) {
  if (!condition) {
    throw new Error(what);
  }
}

function databaseError(
  error: unknown
): { code?: string; constraint?: string } | undefined {
  let current = error as
    | { code?: string; constraint?: string; cause?: unknown }
    | undefined;
  while (current) {
    if (current.code) {
      return current;
    }
    current = current.cause as typeof current;
  }
}

/** Passes only when the database refuses the write because of this exact constraint. */
async function refusedBy(constraint: string, write: () => Promise<unknown>) {
  let thrown: unknown;
  try {
    await write();
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) {
    throw new Error(
      `expected ${constraint} to refuse this write, but it succeeded`
    );
  }
  equal(databaseError(thrown)?.constraint, constraint, "refused by");
}

const requestId = () => crypto.randomUUID();

async function queryRows(query: SQL) {
  const result = (await db.execute(query)) as unknown as {
    rows: Record<string, unknown>[];
  };
  return result.rows;
}

let accountCount = 0;

function authRequest(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${ENV.BETTER_AUTH_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ENV.CORS_ORIGIN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

function nextIdentity() {
  accountCount += 1;
  return {
    name: `Compte ${accountCount}`,
    email: `compte${accountCount}@zay.test`,
    password: "motdepasse-de-test",
    phone: `+2613400${String(accountCount).padStart(5, "0")}`,
  };
}

const signUp = (fields: Record<string, unknown>) =>
  authRequest("/sign-up/email", fields);

async function newClient() {
  const response = await signUp(nextIdentity());
  const body = (await response.json()) as { user?: { id: string } };
  if (!(response.ok && body.user)) {
    throw new Error(`sign up failed: ${JSON.stringify(body)}`);
  }
  return body.user.id;
}

async function newDriver() {
  const userId = await newClient();
  await db.update(t.user).set({ role: "driver" }).where(eq(t.user.id, userId));
  await db
    .insert(t.driverProfile)
    .values({ userId, employmentRelation: "owner" });
  const [vehicle] = await db
    .insert(t.vehicle)
    .values({
      driverId: userId,
      category: "car",
      model: "Peugeot 405",
      capacity: 4,
    })
    .returning();
  if (!vehicle) {
    throw new Error("vehicle was not created");
  }
  return { userId, vehicleId: vehicle.id };
}

type Driver = Awaited<ReturnType<typeof newDriver>>;

async function newBooking(
  clientId: string,
  requested: "car" | "tuk_tuk" | "auto" = "car"
) {
  const [booking] = await db
    .insert(t.booking)
    .values({
      clientId,
      clientRequestId: requestId(),
      requestedCategory: requested,
      passengers: 2,
      settingsVersionId: settings.id,
      pickupPoint: CENTER,
      destinationPoint: NEARBY,
      statusChangedAt: new Date(),
    })
    .returning();
  if (!booking) {
    throw new Error("booking was not created");
  }
  return booking;
}

async function newQuote(
  bookingId: string,
  category: "car" | "tuk_tuk" = "car",
  amountAr = 3300
) {
  const [quote] = await db
    .insert(t.fareQuote)
    .values({
      bookingId,
      category,
      settingsVersionId: settings.id,
      distanceM: 1200,
      distanceSource: "fallback",
      amountAr,
      minAr: 2700,
      maxAr: 3900,
    })
    .returning();
  if (!quote) {
    throw new Error("quote was not created");
  }
  return quote;
}

async function newGroup(bookingId: string, sequence = 1) {
  const [group] = await db
    .insert(t.dispatchGroup)
    .values({
      bookingId,
      sequence,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
  if (!group) {
    throw new Error("group was not created");
  }
  return group;
}

interface OfferContext {
  bookingId: string;
  fareQuoteId: string;
  groupId: string;
}

async function newOffer(
  context: OfferContext,
  driver: Driver,
  status: "sent" | "priced" | "negotiating" | "accepted" = "sent"
) {
  const [offer] = await db
    .insert(t.offer)
    .values({
      ...context,
      driverId: driver.userId,
      vehicleId: driver.vehicleId,
      category: "car",
      status,
      currentPriceAr: status === "sent" ? null : 3300,
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
  if (!offer) {
    throw new Error("offer was not created");
  }
  return offer;
}

async function moveBooking(
  bookingId: string,
  from: (typeof t.bookingStatus.enumValues)[number],
  to: (typeof t.bookingStatus.enumValues)[number],
  fields: Partial<typeof t.booking.$inferInsert> = {}
) {
  await db.transaction(async (tx) => {
    await tx
      .update(t.booking)
      .set({ status: to, statusChangedAt: new Date(), ...fields })
      .where(eq(t.booking.id, bookingId));
    await tx.insert(t.bookingEvent).values({
      bookingId,
      type: "status_changed",
      fromStatus: from,
      toStatus: to,
      actorKind: "system",
    });
  });
}

async function verifyMigrations() {
  section("AC-1 : migrations sur une base vide");
  await check("PostGIS est installé", async () => {
    const rows = await queryRows(
      sql`SELECT extname FROM pg_extension WHERE extname = 'postgis'`
    );
    equal(rows.length, 1, "extension");
  });
  await check(
    `les ${EXPECTED_NEW_TABLES} nouvelles tables existent`,
    async () => {
      const rows = await queryRows(sql`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('spatial_ref_sys', 'user', 'session', 'account', 'verification')
    `);
      equal(rows[0]?.count, EXPECTED_NEW_TABLES, "tables");
    }
  );
  await check(
    "la version 1 des réglages porte les valeurs de test",
    async () => {
      equal(settings.priceVariationPct, 20, "price_variation_pct");
      equal(settings.groupMinDrivers, 1, "group_min_drivers");
      equal(settings.createdBy, null, "created_by");
      const fares = await db
        .select()
        .from(t.categoryFare)
        .where(eq(t.categoryFare.settingsVersionId, settings.id))
        .orderBy(t.categoryFare.category);
      equal(
        fares.map((fare) => [
          fare.category,
          fare.baseFareAr,
          fare.perKmAr,
          fare.maxCapacity,
        ]),
        [
          ["car", 3000, 1000, 4],
          ["tuk_tuk", 1500, 600, 3],
        ],
        "category_fare"
      );
    }
  );
}

async function verifySignUp() {
  section("AC-2 : inscription");
  const countUsersByEmail = async (email: string) =>
    (await db.select().from(t.user).where(eq(t.user.email, email))).length;

  await check("un téléphone manquant est refusé", async () => {
    const { phone: _phone, ...identity } = nextIdentity();
    equal((await signUp(identity)).status, 400, "status");
    equal(await countUsersByEmail(identity.email), 0, "accounts");
  });
  await check("un téléphone hors format international est refusé", async () => {
    const identity = { ...nextIdentity(), phone: "0340000000" };
    equal((await signUp(identity)).status, 400, "status");
    equal(await countUsersByEmail(identity.email), 0, "accounts");
  });
  await check("une langue inconnue est refusée", async () => {
    equal(
      (await signUp({ ...nextIdentity(), locale: "en" })).status,
      400,
      "status"
    );
  });
  for (const role of ["admin", "driver", ""]) {
    // biome-ignore lint/performance/noAwaitInLoops: checks run and print in order
    await check(
      `un champ role valant "${role}" est refusé sans créer de compte`,
      async () => {
        const identity = { ...nextIdentity(), role };
        equal((await signUp(identity)).status, 400, "status");
        equal(await countUsersByEmail(identity.email), 0, "accounts");
      }
    );
  }

  const owner = nextIdentity();
  const ownerResponse = await signUp(owner);
  const cookie = (ownerResponse.headers.getSetCookie() ?? [])
    .map((value) => value.split(";")[0])
    .join("; ");

  await check(
    "sans champ role, le compte est client, en français par défaut",
    async () => {
      const [row] = await db
        .select()
        .from(t.user)
        .where(eq(t.user.email, owner.email));
      equal(ownerResponse.status, 200, "status");
      equal(row?.role, "client", "role");
      equal(row?.locale, "fr", "locale");
      equal(row?.phone, owner.phone, "phone");
    }
  );
  await check(
    "un téléphone déjà utilisé est refusé avec un message clair",
    async () => {
      const response = await signUp({ ...nextIdentity(), phone: owner.phone });
      const body = (await response.json()) as { code?: string };
      equal(response.status, 400, "status");
      equal(body.code, "PHONE_NUMBER_ALREADY_USED", "code");
    }
  );
  await check(
    "deux inscriptions simultanées donnent un seul compte, même message",
    async () => {
      const phone = "+261340099999";
      const responses = await Promise.all([
        signUp({ ...nextIdentity(), phone }),
        signUp({ ...nextIdentity(), phone }),
      ]);
      const created = responses.filter((response) => response.ok);
      const refused = one(responses.filter((response) => !response.ok));
      equal(created.length, 1, "accounts created");
      // Better Auth keeps the 422 of its own failure, while the hook replaces the message.
      equal(
        ((await refused.json()) as { code?: string }).code,
        "PHONE_NUMBER_ALREADY_USED",
        "code"
      );
      const rows = await db
        .select()
        .from(t.user)
        .where(eq(t.user.phone, phone));
      equal(rows.length, 1, "rows");
    }
  );
  await check(
    "modifier son profil avec le téléphone d'un autre est refusé",
    async () => {
      const other = nextIdentity();
      await signUp(other);
      const response = await authRequest(
        "/update-user",
        { phone: other.phone },
        cookie
      );
      equal(response.status, 400, "status");
      equal(
        ((await response.json()) as { code?: string }).code,
        "PHONE_NUMBER_ALREADY_USED",
        "code"
      );
    }
  );
  await check("garder son propre téléphone reste permis", async () => {
    equal(
      (await authRequest("/update-user", { phone: owner.phone }, cookie))
        .status,
      200,
      "status"
    );
  });
  await check("le format est aussi contrôlé à la modification", async () => {
    equal(
      (await authRequest("/update-user", { phone: "abc" }, cookie)).status,
      400,
      "status"
    );
  });
  await check("le rôle ne peut pas se changer par /update-user", async () => {
    equal(
      (await authRequest("/update-user", { role: "admin" }, cookie)).status,
      400,
      "status"
    );
  });
  await check("/admin/remove-user est désactivée", async () => {
    equal(
      (await authRequest("/admin/remove-user", { userId: "x" }, cookie)).status,
      404,
      "status"
    );
  });
}

async function verifyFullRide() {
  section("AC-3, AC-9 : une course complète entre deux comptes réels");
  const clientId = await newClient();
  const driver = await newDriver();
  const booking = await newBooking(clientId);

  await check("la course va de PENDING à COMPLETED", async () => {
    await moveBooking(booking.id, "PENDING", "SEARCHING");
    const quote = await newQuote(booking.id);
    const group = await newGroup(booking.id);
    const offer = await newOffer(
      { bookingId: booking.id, groupId: group.id, fareQuoteId: quote.id },
      driver
    );
    await moveBooking(booking.id, "SEARCHING", "OFFERED");
    await db.insert(t.offerProposal).values({
      offerId: offer.id,
      actorKind: "driver",
      actorId: driver.userId,
      kind: "accept",
    });
    await db
      .update(t.offer)
      .set({ status: "accepted", currentPriceAr: 3300 })
      .where(eq(t.offer.id, offer.id));
    await moveBooking(booking.id, "OFFERED", "ACCEPTED", {
      driverId: driver.userId,
      vehicleId: driver.vehicleId,
      agreedPriceAr: 3300,
    });
    await moveBooking(booking.id, "ACCEPTED", "DRIVER_ARRIVING");
    await moveBooking(booking.id, "DRIVER_ARRIVING", "ARRIVED");
    await moveBooking(booking.id, "ARRIVED", "IN_PROGRESS");
    await db.transaction(async (tx) => {
      await tx
        .update(t.booking)
        .set({
          status: "COMPLETED",
          statusChangedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(t.booking.id, booking.id));
      await tx.insert(t.bookingEvent).values({
        bookingId: booking.id,
        type: "status_changed",
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        actorKind: "driver",
        actorId: driver.userId,
      });
      await tx
        .insert(t.payment)
        .values({ bookingId: booking.id, agreedAmountAr: 3300 });
    });

    const stored = await db.query.booking.findFirst({
      where: { id: booking.id },
      with: {
        client: true,
        events: true,
        fareQuotes: true,
        offers: true,
        payment: true,
      },
    });
    equal(stored?.status, "COMPLETED", "status");
    equal(stored?.client.id, clientId, "client");
    equal(stored?.events.length, 7, "events");
    equal(stored?.fareQuotes.length, 1, "quotes");
    equal(stored?.offers.length, 1, "offers");
    equal(stored?.payment?.status, "pending", "payment status");
  });

  await check(
    "les événements se relisent dans l'ordre de leur identifiant",
    async () => {
      const events = await db
        .select()
        .from(t.bookingEvent)
        .where(eq(t.bookingEvent.bookingId, booking.id))
        .orderBy(t.bookingEvent.id);
      equal(events[0]?.toStatus, "SEARCHING", "first");
      equal(events.at(-1)?.toStatus, "COMPLETED", "last");
    }
  );

  await check(
    "prix convenu, montant déclaré et statut restent distincts",
    async () => {
      const [before] = await db
        .select()
        .from(t.payment)
        .where(eq(t.payment.bookingId, booking.id));
      equal(before?.declaredAmountAr, null, "declared before");
      await db
        .update(t.payment)
        .set({ declaredAmountAr: 3000, status: "partial" })
        .where(eq(t.payment.bookingId, booking.id));
      const [after] = await db
        .select()
        .from(t.payment)
        .where(eq(t.payment.bookingId, booking.id));
      equal(
        [after?.agreedAmountAr, after?.declaredAmountAr, after?.status],
        [3300, 3000, "partial"]
      );
    }
  );
  await check("un montant déclaré négatif est refusé", async () => {
    await refusedBy("payment_declared_not_negative", () =>
      db
        .update(t.payment)
        .set({ declaredAmountAr: -1 })
        .where(eq(t.payment.bookingId, booking.id))
    );
  });
  await check("une réservation n'a qu'un seul paiement", async () => {
    await refusedBy("payment_booking_id_key", () =>
      db
        .insert(t.payment)
        .values({ bookingId: booking.id, agreedAmountAr: 3300 })
    );
  });
  await check(
    "une réservation active exige chauffeur, véhicule et prix",
    async () => {
      const other = await newBooking(clientId);
      await refusedBy("booking_assigned_has_driver_vehicle_price", () =>
        db
          .update(t.booking)
          .set({ status: "ACCEPTED" })
          .where(eq(t.booking.id, other.id))
      );
    }
  );
}

async function verifyAssignment() {
  section("AC-4 : attribution unique");
  const clientId = await newClient();
  const [first, second] = [await newDriver(), await newDriver()];
  const booking = await newBooking(clientId);
  const quote = await newQuote(booking.id);
  const group = await newGroup(booking.id);
  const context = {
    bookingId: booking.id,
    groupId: group.id,
    fareQuoteId: quote.id,
  };
  const offers = [
    await newOffer(context, first, "priced"),
    await newOffer(context, second, "priced"),
  ];

  await check(
    "deux confirmations simultanées donnent une seule offre acceptée",
    async () => {
      const confirmations = offers.map((offer) =>
        db.transaction(async (tx) => {
          await tx
            .update(t.offer)
            .set({ status: "accepted" })
            .where(eq(t.offer.id, offer.id));
          await tx
            .update(t.booking)
            .set({
              status: "ACCEPTED",
              statusChangedAt: new Date(),
              driverId: offer.driverId,
              vehicleId: offer.vehicleId,
              agreedPriceAr: 3300,
            })
            .where(eq(t.booking.id, booking.id));
        })
      );
      const results = await Promise.allSettled(confirmations);
      equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
        "winners"
      );
      const accepted = await db
        .select()
        .from(t.offer)
        .where(eq(t.offer.status, "accepted"));
      equal(
        accepted.filter((offer) => offer.bookingId === booking.id).length,
        1,
        "accepted offers"
      );
    }
  );

  await check(
    "un chauffeur ne peut pas être sur deux réservations actives",
    async () => {
      const [assigned] = await db
        .select()
        .from(t.booking)
        .where(eq(t.booking.id, booking.id));
      const driverId = assigned?.driverId ?? "";
      const other = await newBooking(clientId);
      await refusedBy("booking_driver_active_uq", () =>
        db
          .update(t.booking)
          .set({
            status: "ACCEPTED",
            driverId,
            vehicleId: assigned?.vehicleId,
            agreedPriceAr: 3300,
          })
          .where(eq(t.booking.id, other.id))
      );
    }
  );
}

async function verifyOfferRules() {
  section("AC-5 : offres");
  const clientId = await newClient();
  const driver = await newDriver();
  const booking = await newBooking(clientId);
  const quote = await newQuote(booking.id);
  const group = await newGroup(booking.id);
  const context = {
    bookingId: booking.id,
    groupId: group.id,
    fareQuoteId: quote.id,
  };
  const offer = await newOffer(context, driver);

  await check("un chauffeur n'a qu'une seule offre ouverte", async () => {
    const other = await newBooking(clientId);
    const otherQuote = await newQuote(other.id);
    const otherGroup = await newGroup(other.id);
    await refusedBy("offer_driver_open_uq", () =>
      newOffer(
        {
          bookingId: other.id,
          groupId: otherGroup.id,
          fareQuoteId: otherQuote.id,
        },
        driver
      )
    );
  });
  await check(
    "un chauffeur qui a refusé n'est pas sollicité de nouveau",
    async () => {
      await db
        .update(t.offer)
        .set({ status: "refused" })
        .where(eq(t.offer.id, offer.id));
      await refusedBy("offer_booking_driver_uq", () =>
        newOffer(context, driver)
      );
    }
  );
  await check(
    "un chauffeur dont l'offre est void peut être sollicité de nouveau",
    async () => {
      await db
        .update(t.offer)
        .set({ status: "void" })
        .where(eq(t.offer.id, offer.id));
      await newOffer(context, driver);
    }
  );
  await check(
    "une réservation n'a qu'une seule négociation en cours",
    async () => {
      await newOffer(context, await newDriver(), "negotiating");
      const late = await newDriver();
      await refusedBy("offer_booking_negotiating_uq", () =>
        newOffer(context, late, "negotiating")
      );
    }
  );
}

async function verifyIdempotency() {
  section("AC-6 : renvoi d'une action");
  const clientId = await newClient();
  const driver = await newDriver();
  const booking = await newBooking(clientId);
  const quote = await newQuote(booking.id);
  const group = await newGroup(booking.id);
  const offer = await newOffer(
    { bookingId: booking.id, groupId: group.id, fareQuoteId: quote.id },
    driver
  );
  const payment = one(
    await db
      .insert(t.payment)
      .values({ bookingId: booking.id, agreedAmountAr: 3300 })
      .returning()
  );
  const key = requestId();

  await check("booking : même demande, même réservation", async () => {
    const replay = await db
      .insert(t.booking)
      .values({ ...booking, id: undefined })
      .onConflictDoNothing()
      .returning();
    equal(replay.length, 0, "new rows");
    const [original] = await db
      .select()
      .from(t.booking)
      .where(eq(t.booking.clientRequestId, booking.clientRequestId));
    equal(original?.id, booking.id, "original id");
  });
  await check("offer_proposal : pas de seconde ligne", async () => {
    const values = {
      offerId: offer.id,
      actorKind: "driver",
      actorId: driver.userId,
      kind: "propose",
      amountAr: 3300,
      clientRequestId: key,
    } as const;
    await db.insert(t.offerProposal).values(values);
    equal(
      (
        await db
          .insert(t.offerProposal)
          .values(values)
          .onConflictDoNothing()
          .returning()
      ).length,
      0
    );
  });
  await check("booking_event : pas de seconde ligne", async () => {
    const values = {
      bookingId: booking.id,
      type: "destination_requested",
      actorKind: "client",
      actorId: clientId,
      clientRequestId: key,
    } as const;
    await db.insert(t.bookingEvent).values(values);
    equal(
      (
        await db
          .insert(t.bookingEvent)
          .values(values)
          .onConflictDoNothing()
          .returning()
      ).length,
      0
    );
  });
  await check("payment_event : pas de seconde ligne", async () => {
    const values = {
      paymentId: payment.id,
      kind: "declared",
      amountAr: 3300,
      actorKind: "driver",
      actorId: driver.userId,
      clientRequestId: key,
    } as const;
    await db.insert(t.paymentEvent).values(values);
    equal(
      (
        await db
          .insert(t.paymentEvent)
          .values(values)
          .onConflictDoNothing()
          .returning()
      ).length,
      0
    );
  });
  await check("report : pas de seconde ligne", async () => {
    const values = {
      authorId: clientId,
      typeCode: "help",
      clientRequestId: key,
    };
    await db.insert(t.report).values(values);
    equal(
      (
        await db
          .insert(t.report)
          .values(values)
          .onConflictDoNothing()
          .returning()
      ).length,
      0
    );
  });
  await check(
    "le même identifiant reste libre pour un autre auteur",
    async () => {
      await db.insert(t.report).values({
        authorId: driver.userId,
        typeCode: "help",
        clientRequestId: key,
      });
    }
  );
}

async function verifySettingsVersions() {
  section("AC-7 : versions des réglages");
  const clientId = await newClient();
  const booking = await newBooking(clientId);
  const quote = await newQuote(booking.id);

  await check(
    "une nouvelle version garde son auteur et ne change rien d'existant",
    async () => {
      const { id: _id, createdAt: _createdAt, ...values } = settings;
      const [next] = await db
        .insert(t.settingsVersion)
        .values({
          ...values,
          version: 2,
          priceVariationPct: 35,
          createdBy: clientId,
        })
        .returning();
      equal(next?.createdBy, clientId, "author");
      const [storedBooking] = await db
        .select()
        .from(t.booking)
        .where(eq(t.booking.id, booking.id));
      const [storedQuote] = await db
        .select()
        .from(t.fareQuote)
        .where(eq(t.fareQuote.id, quote.id));
      equal(storedBooking?.settingsVersionId, settings.id, "booking version");
      equal(storedQuote?.amountAr, quote.amountAr, "quote amount");
      equal(storedQuote?.settingsVersionId, settings.id, "quote version");
      const [old] = await db
        .select()
        .from(t.settingsVersion)
        .where(eq(t.settingsVersion.version, 1));
      equal(old?.priceVariationPct, 20, "old value");
    }
  );
  await check(
    "une version de réglages ne peut pas être dupliquée",
    async () => {
      const { id: _id, createdAt: _createdAt, ...values } = settings;
      await refusedBy("settings_version_version_key", () =>
        db.insert(t.settingsVersion).values(values)
      );
    }
  );
  await check(
    "group_min_drivers ne dépasse pas group_max_drivers",
    async () => {
      const { id: _id, createdAt: _createdAt, ...values } = settings;
      await refusedBy("settings_version_group_range", () =>
        db
          .insert(t.settingsVersion)
          .values({ ...values, version: 3, groupMinDrivers: 9 })
      );
    }
  );
}

async function verifyDestinationChange() {
  section("AC-8 : devis actif et changement de destination");
  const clientId = await newClient();
  const driver = await newDriver();
  const booking = await newBooking(clientId, "auto");
  const carQuote = await newQuote(booking.id, "car");
  await newQuote(booking.id, "tuk_tuk", 1800);
  await moveBooking(booking.id, "PENDING", "ACCEPTED", {
    driverId: driver.userId,
    vehicleId: driver.vehicleId,
    agreedPriceAr: 3300,
  });

  const newPoint = { x: 43.68, y: -23.36 };
  const requestChange = () =>
    db
      .insert(t.destinationChange)
      .values({
        bookingId: booking.id,
        oldPoint: NEARBY,
        newPoint,
        newDistanceM: 2500,
        newDistanceSource: "fallback",
        settingsVersionId: settings.id,
        oldPriceAr: 3300,
        newPriceAr: 5500,
        requestedBy: clientId,
        expiresAt: new Date(Date.now() + 30_000),
      })
      .returning();
  const readBooking = async () =>
    (await db.select().from(t.booking).where(eq(t.booking.id, booking.id)))[0];

  await check("un seul devis actif par catégorie", async () => {
    await refusedBy("fare_quote_active_uq", () => newQuote(booking.id, "car"));
  });
  await check(
    "une demande ne change ni le lieu, ni le prix, ni le devis actif",
    async () => {
      await requestChange();
      const stored = await readBooking();
      equal(stored?.destinationPoint, NEARBY, "destination");
      equal(stored?.agreedPriceAr, 3300, "price");
      const active = await db
        .select()
        .from(t.fareQuote)
        .where(
          sql`${t.fareQuote.bookingId} = ${booking.id} AND ${t.fareQuote.replacedAt} IS NULL`
        );
      equal(active.length, 2, "active quotes");
    }
  );
  await check("une seule demande en attente par réservation", async () => {
    await refusedBy("destination_change_pending_uq", requestChange);
  });
  await check("un refus ou une expiration ne change rien", async () => {
    await db
      .update(t.destinationChange)
      .set({ status: "refused" })
      .where(eq(t.destinationChange.bookingId, booking.id));
    const stored = await readBooking();
    equal(stored?.destinationPoint, NEARBY, "destination");
    equal(stored?.agreedPriceAr, 3300, "price");
  });
  await check(
    "les deux accords appliquent le changement et gardent l'historique",
    async () => {
      const change = one(await requestChange());
      await db.transaction(async (tx) => {
        await tx
          .update(t.fareQuote)
          .set({ replacedAt: new Date() })
          .where(
            sql`${t.fareQuote.bookingId} = ${booking.id} AND ${t.fareQuote.replacedAt} IS NULL`
          );
        const [replacement] = await tx
          .insert(t.fareQuote)
          .values({
            bookingId: booking.id,
            category: "car",
            settingsVersionId: settings.id,
            distanceM: 2500,
            distanceSource: "fallback",
            amountAr: 5500,
            minAr: 4400,
            maxAr: 6600,
          })
          .returning();
        await tx
          .update(t.destinationChange)
          .set({
            status: "applied",
            clientAcceptedAt: new Date(),
            driverAcceptedAt: new Date(),
            fareQuoteId: replacement?.id,
          })
          .where(eq(t.destinationChange.id, change.id));
        await tx
          .update(t.booking)
          .set({ destinationPoint: newPoint, agreedPriceAr: 5500 })
          .where(eq(t.booking.id, booking.id));
        await tx.insert(t.bookingEvent).values({
          bookingId: booking.id,
          type: "destination_applied",
          actorKind: "system",
        });
      });
      const stored = await readBooking();
      equal(stored?.destinationPoint, newPoint, "destination");
      equal(stored?.agreedPriceAr, 5500, "price");
      const [old] = await db
        .select()
        .from(t.fareQuote)
        .where(eq(t.fareQuote.id, carQuote.id));
      assertTrue(
        old?.replacedAt instanceof Date,
        "the old quote keeps its row, marked as replaced"
      );
      const [applied] = await db
        .select()
        .from(t.destinationChange)
        .where(eq(t.destinationChange.id, change.id));
      equal(applied?.oldPoint, NEARBY, "old place");
      equal(applied?.newPoint, newPoint, "new place");
      assertTrue(
        applied?.clientAcceptedAt instanceof Date &&
          applied.driverAcceptedAt instanceof Date,
        "both agreements are recorded"
      );
    }
  );
}

async function verifyDeletions() {
  section("AC-10 : suppressions et immatriculation");
  const clientId = await newClient();
  const driver = await newDriver();
  const booking = await newBooking(clientId);
  await moveBooking(booking.id, "PENDING", "ACCEPTED", {
    driverId: driver.userId,
    vehicleId: driver.vehicleId,
    agreedPriceAr: 3300,
  });

  await check("supprimer le compte d'une course est refusé", async () => {
    await refusedBy("booking_client_id_user_id_fkey", () =>
      db.delete(t.user).where(eq(t.user.id, clientId))
    );
  });
  await check("supprimer le véhicule d'une course est refusé", async () => {
    await refusedBy("booking_vehicle_id_vehicle_id_fkey", () =>
      db.delete(t.vehicle).where(eq(t.vehicle.id, driver.vehicleId))
    );
  });
  await check("supprimer un réglage lié à une course est refusé", async () => {
    await assertDeleteRefused(() =>
      db.delete(t.settingsVersion).where(eq(t.settingsVersion.id, settings.id))
    );
  });

  const registration = "1234 TBA";
  const addVehicle = (driverId: string) =>
    db
      .insert(t.vehicle)
      .values({
        driverId,
        category: "tuk_tuk",
        model: "Bajaj",
        capacity: 3,
        registration,
      })
      .returning();

  await check(
    "une immatriculation active ne peut pas être réutilisée",
    async () => {
      await addVehicle(driver.userId);
      await refusedBy("vehicle_registration_active_uq", () =>
        addVehicle(driver.userId)
      );
    }
  );
  await check(
    "elle peut l'être une fois l'ancien véhicule archivé",
    async () => {
      await db
        .update(t.vehicle)
        .set({ archivedAt: new Date() })
        .where(eq(t.vehicle.registration, registration));
      await addVehicle(driver.userId);
    }
  );
  await check(
    "deux véhicules sans immatriculation restent permis",
    async () => {
      const rows = await db
        .select()
        .from(t.vehicle)
        .where(isNull(t.vehicle.registration));
      assertTrue(rows.length >= 2, "several vehicles have no registration");
    }
  );
  await check("is_available implique is_online", async () => {
    await refusedBy("driver_profile_available_requires_online", () =>
      db
        .update(t.driverProfile)
        .set({ isAvailable: true })
        .where(eq(t.driverProfile.userId, driver.userId))
    );
  });
}

async function assertDeleteRefused(write: () => Promise<unknown>) {
  let thrown: unknown;
  try {
    await write();
  } catch (error) {
    thrown = error;
  }
  assertTrue(thrown !== undefined, "the delete should be refused");
  assertTrue(
    databaseError(thrown)?.constraint !== undefined,
    "refused by a foreign key"
  );
}

async function verifyGeography() {
  section("AC-11 : géographie");
  const driver = await newDriver();
  const zone = one(
    await db
      .insert(t.serviceZone)
      .values({
        kind: "pickup",
        name: "Toliara centre",
        area: "MULTIPOLYGON(((43.65 -23.37, 43.69 -23.37, 43.69 -23.33, 43.65 -23.33, 43.65 -23.37)))",
      })
      .returning()
  );

  await check(
    "un point écrit par Drizzle garde le SRID 4326 et se relit x, y",
    async () => {
      await db.insert(t.driverPosition).values({
        driverId: driver.userId,
        point: CENTER,
        recordedAt: new Date(),
        receivedAt: new Date(),
      });
      const rows = await queryRows(
        sql`SELECT ST_SRID(point) AS srid FROM driver_position WHERE driver_id = ${driver.userId}`
      );
      equal(rows[0]?.srid, 4326, "srid");
      const [stored] = await db
        .select()
        .from(t.driverPosition)
        .where(eq(t.driverPosition.driverId, driver.userId));
      equal(stored?.point, CENTER, "point");
    }
  );
  await check(
    "un point dans la zone et un point dehors sont distingués",
    async () => {
      const contains = async (x: number, y: number) => {
        const rows = await queryRows(sql`
        SELECT ST_Contains(area, ST_SetSRID(ST_MakePoint(${x}, ${y}), 4326)) AS inside
        FROM service_zone WHERE id = ${zone.id}
      `);
        return rows[0]?.inside;
      };
      equal(await contains(CENTER.x, CENTER.y), true, "inside");
      equal(await contains(44.5, -22), false, "outside");
    }
  );
  await check(
    "une distance connue est juste à quelques mètres près",
    async () => {
      const rows = await queryRows(sql`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(${CENTER.x}, ${CENTER.y}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${NEARBY.x}, ${NEARBY.y}), 4326)::geography
      ) AS meters
    `);
      const gap = Math.abs(Number(rows[0]?.meters) - NEARBY_DISTANCE_M);
      assertTrue(gap < DISTANCE_TOLERANCE_M, `off by ${gap} m`);
    }
  );
}

async function verifySubscriptions() {
  section("AC-12 : abonnement");
  const driver = await newDriver();
  const plan = one(
    await db
      .insert(t.subscriptionPlan)
      .values({ name: "Mensuel", priceAr: 20_000, durationDays: 30 })
      .returning()
  );
  const pay = (providerReference: string) =>
    db
      .insert(t.subscriptionPayment)
      .values({
        driverId: driver.userId,
        planId: plan.id,
        amountAr: 20_000,
        provider: "mvola",
        providerReference,
        clientRequestId: requestId(),
      })
      .returning();
  const payment = one(await pay("REF-1"));
  const addPeriod = () =>
    db.insert(t.subscriptionPeriod).values({
      driverId: driver.userId,
      paymentId: payment.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86_400_000),
    });

  await check("une référence de prestataire connue est refusée", async () => {
    await refusedBy("subscription_payment_provider_reference_uq", () =>
      pay("REF-1")
    );
  });
  await check("un paiement ne donne qu'une seule période", async () => {
    await addPeriod();
    await refusedBy("subscription_period_payment_id_key", addPeriod);
  });
  await check("le prix d'une formule est positif", async () => {
    await refusedBy("subscription_plan_price_positive", () =>
      db
        .insert(t.subscriptionPlan)
        .values({ name: "Gratuit", priceAr: 0, durationDays: 30 })
    );
  });
}

async function verifyReplacement() {
  section("AC-13 : remplacement d'un chauffeur");
  const clientId = await newClient();
  const [withdrawn, voided, refused] = [
    await newDriver(),
    await newDriver(),
    await newDriver(),
  ];
  const booking = await newBooking(clientId);
  const quote = await newQuote(booking.id);
  const group = await newGroup(booking.id);
  const context = {
    bookingId: booking.id,
    groupId: group.id,
    fareQuoteId: quote.id,
  };
  const accepted = await newOffer(context, withdrawn, "accepted");
  const voidOffer = await newOffer(context, voided, "priced");
  const refusedOffer = await newOffer(context, refused, "priced");
  await db
    .update(t.offer)
    .set({ status: "void" })
    .where(eq(t.offer.id, voidOffer.id));
  await db
    .update(t.offer)
    .set({ status: "refused" })
    .where(eq(t.offer.id, refusedOffer.id));
  await moveBooking(booking.id, "OFFERED", "ACCEPTED", {
    driverId: withdrawn.userId,
    vehicleId: withdrawn.vehicleId,
    agreedPriceAr: 3300,
  });

  const nextGroup = await newGroup(booking.id, 2);
  const nextContext = { ...context, groupId: nextGroup.id };

  await check(
    "la même réservation revient à SEARCHING et garde la trace du chauffeur",
    async () => {
      await db.transaction(async (tx) => {
        await tx
          .update(t.booking)
          .set({
            status: "SEARCHING",
            statusChangedAt: new Date(),
            driverId: null,
            vehicleId: null,
            agreedPriceAr: null,
          })
          .where(eq(t.booking.id, booking.id));
        await tx
          .update(t.offer)
          .set({ status: "withdrawn" })
          .where(eq(t.offer.id, accepted.id));
        await tx.insert(t.bookingEvent).values({
          bookingId: booking.id,
          type: "driver_replaced",
          fromStatus: "ACCEPTED",
          toStatus: "SEARCHING",
          actorKind: "driver",
          actorId: withdrawn.userId,
          data: {
            previous_driver_id: withdrawn.userId,
            previous_vehicle_id: withdrawn.vehicleId,
            previous_price_ar: 3300,
          },
        });
      });
      const [stored] = await db
        .select()
        .from(t.booking)
        .where(eq(t.booking.id, booking.id));
      equal(
        [stored?.status, stored?.driverId, stored?.agreedPriceAr],
        ["SEARCHING", null, null]
      );
    }
  );
  await check(
    "celui qui s'est retiré ne peut pas être sollicité de nouveau",
    async () => {
      await refusedBy("offer_booking_driver_uq", () =>
        newOffer(nextContext, withdrawn)
      );
    }
  );
  await check("celui qui a refusé non plus", async () => {
    await refusedBy("offer_booking_driver_uq", () =>
      newOffer(nextContext, refused)
    );
  });
  await check("un chauffeur écarté à l'attribution peut l'être", async () => {
    await newOffer(nextContext, voided);
  });
  await check(
    "le chauffeur retiré est de nouveau libre pour une autre réservation",
    async () => {
      const other = await newBooking(clientId);
      await moveBooking(other.id, "PENDING", "ACCEPTED", {
        driverId: withdrawn.userId,
        vehicleId: withdrawn.vehicleId,
        agreedPriceAr: 3300,
      });
    }
  );
}

async function verifyRounding() {
  section("AC-14 : arrondis");
  const rule = { baseFareAr: 3300, perKmAr: 0, includedM: 0, roundingAr: 100 };

  await check("3300 Ar, 20 %, arrondi 100 : 2700 et 3900", () => {
    const { amountAr, minAr, maxAr } = computeFare(rule, 0, 20);
    equal([amountAr, minAr, maxAr], [3300, 2700, 3900]);
  });
  await check("la formule du devis suit la distance et la part incluse", () => {
    const fare = {
      baseFareAr: 3000,
      perKmAr: 1000,
      includedM: 500,
      roundingAr: 100,
    };
    equal(
      computeFare(fare, 200, 20).amountAr,
      3000,
      "inside the included part"
    );
    equal(computeFare(fare, 2000, 20).amountAr, 4500, "beyond it");
  });
  await check(
    "les bornes restent dans la limite, pour tout tarif, limite et arrondi",
    () => {
      for (const roundingAr of [50, 100, 500]) {
        for (let amount = 500; amount <= 60_000; amount += 50) {
          for (const pct of [0, 5, 10, 20, 33, 50]) {
            const fare = {
              baseFareAr: amount,
              perKmAr: 0,
              includedM: 0,
              roundingAr,
            };
            const { amountAr, minAr, maxAr } = computeFare(fare, 0, pct);
            assertTrue(
              minAr * 100 >= amountAr * (100 - pct),
              `min ${minAr} for ${amountAr} at ${pct}`
            );
            assertTrue(
              maxAr * 100 <= amountAr * (100 + pct),
              `max ${maxAr} for ${amountAr} at ${pct}`
            );
            assertTrue(
              minAr % roundingAr === 0 && maxAr % roundingAr === 0,
              "multiple of rounding"
            );
          }
        }
      }
    }
  );
}

async function verifyActors() {
  section("AC-15 : auteur des journaux");
  const clientId = await newClient();
  const booking = await newBooking(clientId);
  const payment = one(
    await db
      .insert(t.payment)
      .values({ bookingId: booking.id, agreedAmountAr: 3300 })
      .returning()
  );

  await check("un événement client sans auteur est refusé", async () => {
    await refusedBy("booking_event_actor_required", () =>
      db.insert(t.bookingEvent).values({
        bookingId: booking.id,
        type: "status_changed",
        actorKind: "client",
      })
    );
  });
  await check("un événement système sans auteur est permis", async () => {
    await db.insert(t.bookingEvent).values({
      bookingId: booking.id,
      type: "status_changed",
      actorKind: "system",
    });
  });
  await check("un événement de paiement sans auteur est refusé", async () => {
    await refusedBy("payment_event_actor_required", () =>
      db.insert(t.paymentEvent).values({
        paymentId: payment.id,
        kind: "declared",
        actorKind: "driver",
      })
    );
  });
}

try {
  await verifyMigrations();
  await verifySignUp();
  await verifyFullRide();
  await verifyAssignment();
  await verifyOfferRules();
  await verifyIdempotency();
  await verifySettingsVersions();
  await verifyDestinationChange();
  await verifyDeletions();
  await verifyGeography();
  await verifySubscriptions();
  await verifyReplacement();
  await verifyRounding();
  await verifyActors();
} finally {
  await db.$client.end();
  await maintenance.execute(
    sql.raw(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`)
  );
  await maintenance.$client.end();
}

process.stdout.write(`\n${passes} checks passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
