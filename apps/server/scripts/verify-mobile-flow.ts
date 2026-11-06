// Plays complete rides through the real tRPC routers, against the local database,
// and checks the rules a phone must not be able to break. Needs `seed:mobile` first.
//   bun run verify:mobile
// biome-ignore-all lint/performance/noAwaitInLoops: the steps of a ride run in order
// biome-ignore-all lint/suspicious/noConsole: this script reports to the terminal

import { runDispatchTick } from "@zay-app/api/domain/dispatch";
import { appRouter } from "@zay-app/api/routers/index";
import type { Session } from "@zay-app/auth";
// biome-ignore lint/performance/noNamespaceImport: this script reads many tables
import * as t from "@zay-app/db/schema/index";
import { and, desc, eq, inArray } from "drizzle-orm";

import { files } from "../src/files";
import { auth, db } from "../src/services";

const BAZAR_BE = { lat: -23.3528, lng: 43.6689, note: "Bazar Be" };
const STADE = { lat: -23.3691, lng: 43.6683, note: "Stade" };
const FAR_AWAY = { lat: -18.9, lng: 47.5 };
const SECOND_MS = 1000;
const PAUSE_S = 3;
const DRIVER_S = 20;
const AFTER_WINDOW_MS = (DRIVER_S + 1) * SECOND_MS;
const MAX_ROUNDS = 4;

let passed = 0;
let failed = 0;
const ok = (label: string, value: unknown) => {
  if (value) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}`);
  }
};
const code = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return "NO_ERROR";
  } catch (error) {
    return (error as Error).message;
  }
};
const id = () => crypto.randomUUID();

async function caller(email: string) {
  const [row] = await db.select().from(t.user).where(eq(t.user.email, email));
  if (!row) {
    throw new Error(`Run seed:mobile first: ${email}`);
  }
  const session = {
    user: row,
    session: { userId: row.id },
  } as unknown as Session;
  return {
    id: row.id,
    api: appRouter.createCaller({
      session,
      db,
      auth,
      files,
      headers: new Headers(),
    }),
  };
}

const client = await caller("client.demo@zay.test");
const car = await caller("chauffeur.voiture@zay.test");
const tuk = await caller("chauffeur.tuktuk@zay.test");

async function goOnline(driver: typeof car) {
  await driver.api.driver.setAvailability({
    isOnline: true,
    isAvailable: true,
  });
  await driver.api.driver.updatePosition({
    lat: BAZAR_BE.lat + 0.002,
    lng: BAZAR_BE.lng,
    recordedAt: new Date().toISOString(),
  });
}

// Earlier runs must not change this one: nobody starts with an open request.
const leftovers = await db
  .select({ id: t.booking.id })
  .from(t.booking)
  .where(
    and(
      eq(t.booking.clientId, client.id),
      inArray(t.booking.status, [
        "PENDING",
        "SEARCHING",
        "OFFERED",
        "ACCEPTED",
        "DRIVER_ARRIVING",
        "ARRIVED",
      ])
    )
  );
for (const row of leftovers) {
  await client.api.client.cancel({
    bookingId: row.id,
    clientRequestId: id(),
    reasonCode: "client_changed_mind",
  });
}
await goOnline(car);
await goOnline(tuk);

console.log("Roles");
ok(
  "a client cannot call a driver action",
  (await code(() => client.api.driver.home())) === "ROLE_NOT_ALLOWED"
);
ok(
  "a driver cannot call a client action",
  (await code(() => car.api.client.activeBooking())) === "ROLE_NOT_ALLOWED"
);

console.log("Quote and zones");
const quote = await client.api.client.quote({
  pickup: BAZAR_BE,
  destination: STADE,
  passengers: 2,
});
ok("a quote per category", quote.quotes.length === 2);
ok("a positive distance", quote.distanceM > 0);
console.log(`       distance ${quote.distanceM} m, ${quote.distanceSource}`);
ok(
  "a pickup out of the zone is refused",
  (await code(() =>
    client.api.client.quote({
      pickup: FAR_AWAY,
      destination: STADE,
      passengers: 1,
    })
  )) === "PICKUP_OUT_OF_ZONE"
);
ok(
  "no category fits too many passengers",
  (await code(() =>
    client.api.client.createBooking({
      clientRequestId: id(),
      category: "tuk_tuk",
      passengers: 5,
      pickup: BAZAR_BE,
      destination: STADE,
    })
  )) === "TOO_MANY_PASSENGERS"
);

console.log("Scenario A: car, comparison, one driver");
const requestId = id();
const created = await client.api.client.createBooking({
  clientRequestId: requestId,
  category: "car",
  passengers: 2,
  pickup: BAZAR_BE,
  destination: STADE,
});
const replay = await client.api.client.createBooking({
  clientRequestId: requestId,
  category: "car",
  passengers: 2,
  pickup: BAZAR_BE,
  destination: STADE,
});
ok("a double tap creates one booking", created.id === replay.id);
ok(
  "a second request is refused while one is open",
  (await code(() =>
    client.api.client.createBooking({
      clientRequestId: id(),
      category: "car",
      passengers: 2,
      pickup: BAZAR_BE,
      destination: STADE,
    })
  )) === "ACTIVE_BOOKING_EXISTS"
);
const carHome = await car.api.driver.home();
const tukHome = await tuk.api.driver.home();
ok("the car driver gets the request", carHome.offer?.bookingId === created.id);
ok("the tuk tuk driver does not (scenario B rule)", tukHome.offer === null);
const carOffer = carHome.offer;
if (!carOffer) {
  throw new Error("No offer: stop here");
}

console.log("Scenario D: negotiation within limits");
ok(
  "a price above the limit is refused",
  (await code(() =>
    car.api.driver.answerOffer({
      action: "propose",
      offerId: carOffer.id,
      clientRequestId: id(),
      amountAr: carOffer.maxAr + carOffer.roundingAr,
      reasonCode: "difficult_road",
    })
  )) === "PRICE_OUT_OF_RANGE"
);
ok(
  "a client cannot answer before the driver has priced",
  (await code(() =>
    client.api.client.answerOffer({
      action: "accept",
      offerId: carOffer.id,
      clientRequestId: id(),
    })
  )) === "OFFER_NOT_PRICED"
);
await car.api.driver.answerOffer({
  action: "propose",
  offerId: carOffer.id,
  clientRequestId: id(),
  amountAr: carOffer.maxAr,
  reasonCode: "difficult_road",
});
let view = await client.api.client.booking({ id: created.id });
ok("the client sees the priced offer", view.offers.length === 1);
ok("no phone number before attribution", !("phone" in (view.offers[0] ?? {})));
await client.api.client.answerOffer({
  action: "counter",
  offerId: carOffer.id,
  clientRequestId: id(),
  amountAr: carOffer.minAr,
});
ok(
  "a second counter by the client is refused",
  (await code(() =>
    client.api.client.answerOffer({
      action: "counter",
      offerId: carOffer.id,
      clientRequestId: id(),
      amountAr: carOffer.minAr,
    })
  )) === "OFFER_WAITING_DRIVER"
);
await car.api.driver.answerOffer({
  action: "counter",
  offerId: carOffer.id,
  clientRequestId: id(),
  amountAr: carOffer.quotedAr,
});
ok(
  "a second counter by the driver is refused",
  (await code(() =>
    car.api.driver.answerOffer({
      action: "counter",
      offerId: carOffer.id,
      clientRequestId: id(),
      amountAr: carOffer.quotedAr,
    })
  )) === "OFFER_WAITING_CLIENT"
);
const acceptKey = id();
await client.api.client.answerOffer({
  action: "accept",
  offerId: carOffer.id,
  clientRequestId: acceptKey,
});
await client.api.client.answerOffer({
  action: "accept",
  offerId: carOffer.id,
  clientRequestId: acceptKey,
});
view = await client.api.client.booking({ id: created.id });
ok("the ride is assigned", view.status === "ACCEPTED");
ok("the price is locked", view.agreedPriceAr === carOffer.quotedAr);
ok("the phone appears after attribution", Boolean(view.driver?.phone));

console.log("Status rules");
ok(
  "a ride cannot jump to COMPLETED",
  (await code(() =>
    car.api.driver.advanceRide({
      bookingId: created.id,
      to: "COMPLETED",
      clientRequestId: id(),
    })
  )) === "BOOKING_STATUS_CHANGED"
);
ok(
  "another driver cannot advance it",
  (await code(() =>
    tuk.api.driver.advanceRide({
      bookingId: created.id,
      to: "DRIVER_ARRIVING",
      clientRequestId: id(),
    })
  )) === "FORBIDDEN"
);

console.log("Destination change");
const preview = await client.api.client.previewDestination({
  bookingId: created.id,
  destination: BAZAR_BE,
});
await client.api.client.requestDestination({
  bookingId: created.id,
  destination: BAZAR_BE,
  clientRequestId: id(),
});
view = await client.api.client.booking({ id: created.id });
ok(
  "the price does not move before the driver agrees",
  view.agreedPriceAr === carOffer.quotedAr
);
await car.api.driver.answerDestination({
  bookingId: created.id,
  accept: true,
});
view = await client.api.client.booking({ id: created.id });
ok("both agreed: new price", view.agreedPriceAr === preview.newPriceAr);

console.log("Scenario G: a ride to its end, then the payment");
for (const to of ["DRIVER_ARRIVING", "ARRIVED", "IN_PROGRESS"] as const) {
  await car.api.driver.advanceRide({
    bookingId: created.id,
    to,
    clientRequestId: id(),
  });
}
ok(
  "no cancelling during the ride",
  (await code(() =>
    client.api.client.cancel({
      bookingId: created.id,
      clientRequestId: id(),
      reasonCode: "client_changed_mind",
    })
  )) === "BOOKING_STATUS_CHANGED"
);
await car.api.driver.advanceRide({
  bookingId: created.id,
  to: "COMPLETED",
  clientRequestId: id(),
});
view = await client.api.client.booking({ id: created.id });
ok("the ride ends with a pending payment", view.payment?.status === "pending");
await car.api.driver.declarePayment({
  bookingId: created.id,
  amountAr: 100,
  clientRequestId: id(),
});
view = await client.api.client.booking({ id: created.id });
ok("less than agreed is partial", view.payment?.status === "partial");
await client.api.client.disputePayment({
  bookingId: created.id,
  clientRequestId: id(),
  reasonCode: "payment",
});
view = await client.api.client.booking({ id: created.id });
ok("the client can dispute", view.payment?.status === "disputed");
ok(
  "the driver cannot overwrite a disputed payment",
  (await code(() =>
    car.api.driver.declarePayment({
      bookingId: created.id,
      amountAr: 500,
      clientRequestId: id(),
    })
  )) === "PAYMENT_DISPUTED"
);
const clientHistory = await client.api.client.history({ page: 1 });
const driverHistory = await car.api.driver.history({ page: 1 });
ok("in the client's history", clientHistory[0]?.id === created.id);
ok("in the driver's history", driverHistory[0]?.id === created.id);

console.log("Scenario C: automatic mode, one attribution, others void");
const auto = await client.api.client.createBooking({
  clientRequestId: id(),
  category: "auto",
  passengers: 1,
  pickup: BAZAR_BE,
  destination: STADE,
});
const autoCar = (await car.api.driver.home()).offer;
const autoTuk = (await tuk.api.driver.home()).offer;
ok("both categories are asked", autoCar && autoTuk);
if (!(autoCar && autoTuk)) {
  throw new Error("No auto offers: stop here");
}
await car.api.driver.answerOffer({
  action: "accept",
  offerId: autoCar.id,
  clientRequestId: id(),
});
await tuk.api.driver.answerOffer({
  action: "accept",
  offerId: autoTuk.id,
  clientRequestId: id(),
});
view = await client.api.client.booking({ id: auto.id });
ok(
  "each offer shows its category",
  new Set(view.offers.map((offer) => offer.category)).size === 2
);
// Scenario E: two confirmations at once, a single winner.
const results = await Promise.allSettled([
  client.api.client.answerOffer({
    action: "accept",
    offerId: autoCar.id,
    clientRequestId: id(),
  }),
  client.api.client.answerOffer({
    action: "accept",
    offerId: autoTuk.id,
    clientRequestId: id(),
  }),
]);
ok(
  "two simultaneous confirmations give one winner",
  results.filter((result) => result.status === "fulfilled").length === 1
);
const offers = await db
  .select({ status: t.offer.status })
  .from(t.offer)
  .where(eq(t.offer.bookingId, auto.id));
ok(
  "one accepted, one void",
  offers.filter((o) => o.status === "accepted").length === 1 &&
    offers.filter((o) => o.status === "void").length === 1
);

console.log("Withdrawal: the same booking returns to the search");
const winner = results[0]?.status === "fulfilled" ? car : tuk;
const loser = winner === car ? tuk : car;
await winner.api.driver.withdraw({
  bookingId: auto.id,
  clientRequestId: id(),
  reasonCode: "driver_unavailable",
});
view = await client.api.client.booking({ id: auto.id });
ok("back to searching", view.status === "SEARCHING");
ok("no driver left on it", view.driver === null);
await runDispatchTick(db, new Date(Date.now() + (PAUSE_S + 1) * SECOND_MS));
const reoffered = (await loser.api.driver.home()).offer;
ok("the other driver gets it again", reoffered?.bookingId === auto.id);
ok(
  "the driver who left does not",
  (await winner.api.driver.home()).offer === null
);
await client.api.client.cancel({
  bookingId: auto.id,
  clientRequestId: id(),
  reasonCode: "other",
  reasonNote: "Fin du test",
});
const [cancelEvent] = await db
  .select()
  .from(t.bookingEvent)
  .where(eq(t.bookingEvent.bookingId, auto.id))
  .orderBy(desc(t.bookingEvent.id))
  .limit(1);
ok(
  "a cancellation keeps its author and reason",
  cancelEvent?.actorId === client.id && cancelEvent?.reasonCode === "other"
);

console.log("Timers: refusal, expiry, and no driver found");
await car.api.driver.setAvailability({ isOnline: true, isAvailable: false });
await tuk.api.driver.setAvailability({ isOnline: true, isAvailable: true });
const timed = await client.api.client.createBooking({
  clientRequestId: id(),
  category: "tuk_tuk",
  passengers: 1,
  pickup: BAZAR_BE,
  destination: STADE,
});
const late = (await tuk.api.driver.home()).offer;
if (!late) {
  throw new Error("No offer for the timer test");
}
await tuk.api.driver.answerOffer({
  action: "refuse",
  offerId: late.id,
  clientRequestId: id(),
});
await tuk.api.driver.setAvailability({ isOnline: true, isAvailable: false });
let clock = Date.now();
for (let round = 0; round <= MAX_ROUNDS * 2; round += 1) {
  clock += AFTER_WINDOW_MS;
  await runDispatchTick(db, new Date(clock));
  clock += (PAUSE_S + 1) * SECOND_MS;
  await runDispatchTick(db, new Date(clock));
}
view = await client.api.client.booking({ id: timed.id });
ok("the client learns NO_DRIVER_FOUND", view.status === "NO_DRIVER_FOUND");
const [refused] = await db
  .select({ status: t.offer.status })
  .from(t.offer)
  .where(eq(t.offer.id, late.id));
ok("the refusal stays recorded", refused?.status === "refused");

await tuk.api.driver.setAvailability({ isOnline: true, isAvailable: true });
const expiring = await client.api.client.createBooking({
  clientRequestId: id(),
  category: "tuk_tuk",
  passengers: 1,
  pickup: BAZAR_BE,
  destination: STADE,
});
const expiringOffer = (await tuk.api.driver.home()).offer;
if (!expiringOffer) {
  throw new Error("No offer for the expiry test");
}
await db
  .update(t.offer)
  .set({ expiresAt: new Date(Date.now() - SECOND_MS) })
  .where(eq(t.offer.id, expiringOffer.id));
ok(
  "scenario F: a late answer to an expired offer is refused",
  (await code(() =>
    tuk.api.driver.answerOffer({
      action: "accept",
      offerId: expiringOffer.id,
      clientRequestId: id(),
    })
  )) === "OFFER_EXPIRED"
);
await client.api.client.cancel({
  bookingId: expiring.id,
  clientRequestId: id(),
  reasonCode: "client_changed_mind",
});
await car.api.driver.setAvailability({ isOnline: false, isAvailable: false });
await tuk.api.driver.setAvailability({ isOnline: false, isAvailable: false });

console.log(`\n${passed} ok, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
