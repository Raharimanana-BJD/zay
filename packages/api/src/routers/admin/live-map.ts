import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import {
  driverPosition,
  driverProfile,
  vehicle,
} from "@zay-app/db/schema/drivers";
import { settingsVersion } from "@zay-app/db/schema/settings";
import { and, desc, eq, inArray } from "drizzle-orm";

import { isPositionStale, positionAgeS } from "../../domain/driver-position";
import { router, staffProcedure } from "../../index";
import { notFound } from "./common";
import { ACTIVE } from "./dashboard";

export const liveMapRouter = router({
  /** Online drivers only: the team has no reason to follow a driver off duty. */
  drivers: staffProcedure.query(async ({ ctx }) => {
    const [settings] = await ctx.db
      .select({ gpsMaxAgeS: settingsVersion.gpsMaxAgeS })
      .from(settingsVersion)
      .orderBy(desc(settingsVersion.version))
      .limit(1);
    if (!settings) {
      throw notFound();
    }
    const rows = await ctx.db
      .select({
        driverId: driverPosition.driverId,
        name: user.name,
        phone: user.phone,
        isAvailable: driverProfile.isAvailable,
        isSimulated: driverProfile.isSimulated,
        point: driverPosition.point,
        accuracyM: driverPosition.accuracyM,
        receivedAt: driverPosition.receivedAt,
        category: vehicle.category,
        make: vehicle.make,
        model: vehicle.model,
        registration: vehicle.registration,
        bookingId: booking.id,
        bookingStatus: booking.status,
      })
      .from(driverPosition)
      .innerJoin(
        driverProfile,
        eq(driverProfile.userId, driverPosition.driverId)
      )
      .innerJoin(user, eq(user.id, driverPosition.driverId))
      .leftJoin(vehicle, eq(vehicle.id, driverProfile.activeVehicleId))
      // At most one row: `booking_driver_active_uq` allows one active booking per driver.
      .leftJoin(
        booking,
        and(
          eq(booking.driverId, driverPosition.driverId),
          inArray(booking.status, [...ACTIVE])
        )
      )
      .where(eq(driverProfile.isOnline, true))
      .orderBy(user.name, driverPosition.driverId);
    const now = new Date();
    return {
      items: rows.map(({ point, receivedAt, ...row }) => {
        const ageS = positionAgeS(receivedAt, now);
        return {
          ...row,
          longitude: point.x,
          latitude: point.y,
          ageS,
          isStale: isPositionStale(ageS, settings.gpsMaxAgeS),
        };
      }),
    };
  }),
});
