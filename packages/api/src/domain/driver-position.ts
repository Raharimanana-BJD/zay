const MS_PER_S = 1000;

/** Whole seconds since the server received a position, never below zero. */
export const positionAgeS = (receivedAt: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - receivedAt.getTime()) / MS_PER_S));

/** A position older than the limit is the last known one, not a current one. */
export const isPositionStale = (ageS: number, maxAgeS: number) =>
  ageS > maxAgeS;
