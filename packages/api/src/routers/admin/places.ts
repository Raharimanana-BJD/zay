import { booking } from "@zay-app/db/schema/bookings";
import { district, landmark } from "@zay-app/db/schema/places";
import { eq, type SQL, sql } from "drizzle-orm";
import { alias, type PgSelect } from "drizzle-orm/pg-core";

const FALLBACK = "Point sur la carte";

/** The label rule from spec 0001: landmark, then district, then the note. */
export function placeLabels() {
  const pickupLandmark = alias(landmark, "pickup_landmark");
  const pickupDistrict = alias(district, "pickup_district");
  const destinationLandmark = alias(landmark, "destination_landmark");
  const destinationDistrict = alias(district, "destination_district");
  return {
    pickup:
      sql<string>`coalesce(${pickupLandmark.name}, ${pickupDistrict.name}, ${booking.pickupNote}, ${FALLBACK})` as SQL<string>,
    destination:
      sql<string>`coalesce(${destinationLandmark.name}, ${destinationDistrict.name}, ${booking.destinationNote}, ${FALLBACK})` as SQL<string>,
    joins<T extends PgSelect>(query: T) {
      return query
        .leftJoin(
          pickupLandmark,
          eq(pickupLandmark.id, booking.pickupLandmarkId)
        )
        .leftJoin(
          pickupDistrict,
          eq(pickupDistrict.id, booking.pickupDistrictId)
        )
        .leftJoin(
          destinationLandmark,
          eq(destinationLandmark.id, booking.destinationLandmarkId)
        )
        .leftJoin(
          destinationDistrict,
          eq(destinationDistrict.id, booking.destinationDistrictId)
        );
    },
  };
}
