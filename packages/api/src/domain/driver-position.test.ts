import { expect, test } from "bun:test";

import { isPositionStale, positionAgeS } from "./driver-position";

const NOW = new Date("2026-11-06T10:00:30.900Z");

test("the age counts whole seconds since the server received the position", () => {
  expect(positionAgeS(new Date("2026-11-06T10:00:00.000Z"), NOW)).toBe(30);
});

test("a receive time ahead of the clock gives an age of zero", () => {
  expect(positionAgeS(new Date("2026-11-06T10:01:00.000Z"), NOW)).toBe(0);
});

test("a position stays current up to the limit, then becomes stale", () => {
  expect(isPositionStale(60, 60)).toBe(false);
  expect(isPositionStale(61, 60)).toBe(true);
});
