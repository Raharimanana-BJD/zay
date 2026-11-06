import { booking, bookingEvent } from "@zay-app/db/schema/bookings";
import { offer } from "@zay-app/db/schema/dispatch";
import { driverProfile } from "@zay-app/db/schema/drivers";
import { report } from "@zay-app/db/schema/support";
import { and, eq, gte, inArray, type SQL, sql } from "drizzle-orm";
import z from "zod";

import { router, staffProcedure } from "../../index";
import { TIME_ZONE } from "./common";

const ACTIVE = [
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
] as const;
const DONE = ["COMPLETED", "DISPUTED"] as const;
const DAYS_BEFORE = { today: 0, "7d": 6, "30d": 29 } as const;

const zone = sql.raw(`'${TIME_ZONE}'`);
const countAll = sql<number>`count(*)::int`;

const firstCount = (rows: { value: number }[]) => rows[0]?.value ?? 0;

export const dashboardRouter = router({
  stats: staffProcedure
    .input(
      z.object({
        period: z.enum(["today", "7d", "30d"]),
        includeSimulated: z.boolean(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { period, includeSimulated } = input;
      const days = sql.raw(String(DAYS_BEFORE[period]));
      const localStart = sql`(date_trunc('day', now() AT TIME ZONE ${zone}) - interval '1 day' * ${days})`;
      const start = sql`(${localStart} AT TIME ZONE ${zone})`;
      const onlyReal = (
        column: SQL | typeof driverProfile.isSimulated
      ): SQL | undefined =>
        includeSimulated ? undefined : sql`coalesce(${column}, false) = false`;

      const [
        created,
        completed,
        cancelled,
        noDriver,
        offers,
        active,
        online,
        openReports,
        pendingFiles,
        reasons,
        series,
      ] = await Promise.all([
        db
          .select({ value: countAll })
          .from(booking)
          .where(gte(booking.createdAt, sql`${start}`)),
        db
          .select({ value: countAll })
          .from(booking)
          .leftJoin(driverProfile, eq(driverProfile.userId, booking.driverId))
          .where(
            and(
              inArray(booking.status, [...DONE]),
              gte(booking.completedAt, sql`${start}`),
              onlyReal(driverProfile.isSimulated)
            )
          ),
        db
          .select({ value: countAll })
          .from(bookingEvent)
          .where(
            and(
              eq(bookingEvent.toStatus, "CANCELLED"),
              gte(bookingEvent.createdAt, sql`${start}`)
            )
          ),
        db
          .select({ value: countAll })
          .from(bookingEvent)
          .where(
            and(
              eq(bookingEvent.toStatus, "NO_DRIVER_FOUND"),
              gte(bookingEvent.createdAt, sql`${start}`)
            )
          ),
        db
          .select({ value: countAll })
          .from(offer)
          .innerJoin(driverProfile, eq(driverProfile.userId, offer.driverId))
          .where(
            and(
              gte(offer.createdAt, sql`${start}`),
              onlyReal(driverProfile.isSimulated)
            )
          ),
        db
          .select({ value: countAll })
          .from(booking)
          .leftJoin(driverProfile, eq(driverProfile.userId, booking.driverId))
          .where(
            and(
              inArray(booking.status, [...ACTIVE]),
              onlyReal(driverProfile.isSimulated)
            )
          ),
        db
          .select({ value: countAll })
          .from(driverProfile)
          .where(
            and(
              eq(driverProfile.isOnline, true),
              onlyReal(driverProfile.isSimulated)
            )
          ),
        db
          .select({ value: countAll })
          .from(report)
          .where(inArray(report.status, ["open", "in_progress"])),
        db
          .select({ value: countAll })
          .from(driverProfile)
          .where(
            inArray(driverProfile.verificationStatus, [
              "pending",
              "changes_requested",
            ])
          ),
        db
          .select({ reasonCode: bookingEvent.reasonCode, count: countAll })
          .from(bookingEvent)
          .where(
            and(
              eq(bookingEvent.toStatus, "CANCELLED"),
              gte(bookingEvent.createdAt, sql`${start}`)
            )
          )
          .groupBy(bookingEvent.reasonCode)
          .orderBy(sql`count(*) DESC`),
        (() => {
          const unit = sql.raw(period === "today" ? "'hour'" : "'day'");
          const step = sql.raw(
            period === "today" ? "interval '1 hour'" : "interval '1 day'"
          );
          const last =
            period === "today"
              ? sql`${localStart} + interval '23 hours'`
              : sql`date_trunc('day', now() AT TIME ZONE ${zone})`;
          const simulatedFilter = includeSimulated
            ? sql``
            : sql`AND coalesce((SELECT d.is_simulated FROM driver_profile d WHERE d.user_id = b.driver_id), false) = false`;
          return db.execute(sql`
              SELECT to_char(s.bucket, 'YYYY-MM-DD"T"HH24:00') AS bucket,
                (SELECT count(*)::int FROM booking b
                  WHERE date_trunc(${unit}, b.created_at AT TIME ZONE ${zone}) = s.bucket) AS created,
                (SELECT count(*)::int FROM booking b
                  WHERE b.status IN ('COMPLETED', 'DISPUTED')
                    AND date_trunc(${unit}, b.completed_at AT TIME ZONE ${zone}) = s.bucket
                    ${simulatedFilter}) AS completed
              FROM generate_series(${localStart}, ${last}, ${step}) AS s(bucket)
              ORDER BY s.bucket
            `);
        })(),
      ]);

      return {
        totals: {
          created: firstCount(created),
          completed: firstCount(completed),
          cancelled: firstCount(cancelled),
          noDriver: firstCount(noDriver),
          offers: firstCount(offers),
        },
        now: {
          activeRides: firstCount(active),
          onlineDrivers: firstCount(online),
          openReports: firstCount(openReports),
          pendingFiles: firstCount(pendingFiles),
        },
        series: (
          series as unknown as {
            rows: { bucket: string; created: number; completed: number }[];
          }
        ).rows,
        cancellationsByReason: reasons,
      };
    }),
});
