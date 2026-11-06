import { describe, expect, test } from "bun:test";

import {
  BOOKING_TRANSITIONS,
  type BookingStatus,
  canTransition,
} from "./booking-status";

const STATUSES = Object.keys(BOOKING_TRANSITIONS) as BookingStatus[];

// The table of spec 0001, written again here so a change to the code has to be deliberate.
const ALLOWED = new Set([
  "PENDING>SEARCHING",
  "PENDING>CANCELLED",
  "PENDING>EXPIRED",
  "SEARCHING>OFFERED",
  "SEARCHING>NO_DRIVER_FOUND",
  "SEARCHING>CANCELLED",
  "SEARCHING>EXPIRED",
  "OFFERED>SEARCHING",
  "OFFERED>ACCEPTED",
  "OFFERED>NO_DRIVER_FOUND",
  "OFFERED>CANCELLED",
  "OFFERED>EXPIRED",
  "ACCEPTED>DRIVER_ARRIVING",
  "ACCEPTED>CANCELLED",
  "ACCEPTED>SEARCHING",
  "DRIVER_ARRIVING>ARRIVED",
  "DRIVER_ARRIVING>CANCELLED",
  "DRIVER_ARRIVING>SEARCHING",
  "ARRIVED>IN_PROGRESS",
  "ARRIVED>CANCELLED",
  "ARRIVED>SEARCHING",
  "IN_PROGRESS>COMPLETED",
  "IN_PROGRESS>CANCELLED",
  "COMPLETED>DISPUTED",
  "DISPUTED>COMPLETED",
]);

describe("booking status table", () => {
  test("covers the twelve statuses", () => {
    expect(STATUSES).toHaveLength(12);
  });

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const pair = `${from}>${to}`;
      test(pair, () => {
        expect(canTransition(from, to)).toBe(ALLOWED.has(pair));
      });
    }
  }
});
