import { user } from "@zay-app/db/schema/auth";
import { categoryFare, settingsVersion } from "@zay-app/db/schema/settings";
import { desc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { Context } from "../../context";
import { adminProcedure, router } from "../../index";
import {
  conflict,
  isUniqueViolation,
  offsetOf,
  PAGE_SIZE,
  pageSchema,
} from "./common";

const MAX_NOTE_LENGTH = 500;
const CATEGORIES = ["car", "tuk_tuk"] as const;

const VALUE_LIMITS = {
  priceVariationPct: [0, 100],
  groupMaxDrivers: [1, 10],
  driverResponseS: [5, 300],
  clientResponseS: [5, 300],
  driverCounterResponseS: [5, 300],
  groupPauseS: [0, 60],
  maxGroups: [1, 10],
  gpsMaxAgeS: [10, 3600],
} as const;

const FARE_LIMITS = {
  baseFareAr: [0, 1_000_000],
  perKmAr: [0, 1_000_000],
  includedM: [0, 100_000],
  roundingAr: [1, 1000],
  maxCapacity: [1, 20],
} as const;

const fareInput = z.object({
  baseFareAr: z.number().int(),
  perKmAr: z.number().int(),
  includedM: z.number().int(),
  roundingAr: z.number().int(),
  maxCapacity: z.number().int(),
});

const valuesInput = z.object({
  priceVariationPct: z.number().int(),
  groupMinDrivers: z.number().int(),
  groupMaxDrivers: z.number().int(),
  driverResponseS: z.number().int(),
  groupPauseS: z.number().int(),
  maxGroups: z.number().int(),
  clientResponseS: z.number().int(),
  driverCounterResponseS: z.number().int(),
  gpsMaxAgeS: z.number().int(),
});

const createInput = valuesInput.extend({
  baseVersion: z.number().int(),
  fares: z.object({ car: fareInput, tuk_tuk: fareInput }),
  changeNote: z.string(),
});

type CreateInput = z.infer<typeof createInput>;
type Fare = z.infer<typeof fareInput>;

const rangeMessage = (min: number, max: number) =>
  `Saisissez un nombre entre ${min} et ${max}.`;

function checkLimits(input: CreateInput): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, [min, max]] of Object.entries(VALUE_LIMITS)) {
    const value = input[field as keyof typeof VALUE_LIMITS];
    if (value < min || value > max) {
      errors[field] = rangeMessage(min, max);
    }
  }
  if (
    input.groupMinDrivers < 1 ||
    input.groupMinDrivers > input.groupMaxDrivers
  ) {
    errors.groupMinDrivers =
      "Le minimum doit être entre 1 et le maximum du groupe.";
  }
  for (const category of CATEGORIES) {
    for (const [field, [min, max]] of Object.entries(FARE_LIMITS)) {
      const value = input.fares[category][field as keyof Fare];
      if (value < min || value > max) {
        errors[`fares.${category}.${field}`] = rangeMessage(min, max);
      }
    }
  }
  const note = input.changeNote.trim();
  if (note.length === 0 || note.length > MAX_NOTE_LENGTH) {
    errors.changeNote = "Saisissez une note de 1 à 500 caractères.";
  }
  return errors;
}

type VersionRow = typeof settingsVersion.$inferSelect;
type FareRow = typeof categoryFare.$inferSelect;

function pickFare(row: FareRow | undefined): Fare {
  if (!row) {
    throw new Error("a settings version must have two fares");
  }
  const { baseFareAr, perKmAr, includedM, roundingAr, maxCapacity } = row;
  return { baseFareAr, perKmAr, includedM, roundingAr, maxCapacity };
}

function pickFares(rows: FareRow[], versionId: string) {
  const own = rows.filter((row) => row.settingsVersionId === versionId);
  return {
    car: pickFare(own.find((row) => row.category === "car")),
    tuk_tuk: pickFare(own.find((row) => row.category === "tuk_tuk")),
  };
}

function sameValues(
  input: CreateInput,
  version: VersionRow,
  fares: ReturnType<typeof pickFares>
) {
  const valuesMatch = (
    Object.keys(valuesInput.shape) as (keyof typeof valuesInput.shape)[]
  ).every((field) => input[field] === version[field]);
  const faresMatch = CATEGORIES.every((category) =>
    (Object.keys(FARE_LIMITS) as (keyof Fare)[]).every(
      (field) => input.fares[category][field] === fares[category][field]
    )
  );
  return valuesMatch && faresMatch;
}

async function versionsWithFares(
  db: Context["db"],
  rows: (VersionRow & { authorName: string | null })[]
) {
  if (rows.length === 0) {
    return [];
  }
  const fares = await db
    .select()
    .from(categoryFare)
    .where(
      inArray(
        categoryFare.settingsVersionId,
        rows.map((row) => row.id)
      )
    );
  return rows.map((row) => ({ ...row, fares: pickFares(fares, row.id) }));
}

const versionColumns = { version: settingsVersion, authorName: user.name };

const flatten = (row: { version: VersionRow; authorName: string | null }) => ({
  ...row.version,
  authorName: row.authorName,
});

export const settingsRouter = router({
  current: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select(versionColumns)
      .from(settingsVersion)
      .leftJoin(user, eq(user.id, settingsVersion.createdBy))
      .orderBy(desc(settingsVersion.version))
      .limit(1);
    const [current] = await versionsWithFares(ctx.db, rows.map(flatten));
    if (!current) {
      throw new Error("the seed migration must create version 1");
    }
    return current;
  }),

  history: adminProcedure
    .input(z.object({ page: pageSchema }))
    .query(async ({ ctx, input }) => {
      // One row more, so the page's oldest version can be compared with its previous one.
      const rows = await ctx.db
        .select(versionColumns)
        .from(settingsVersion)
        .leftJoin(user, eq(user.id, settingsVersion.createdBy))
        .orderBy(desc(settingsVersion.version))
        .limit(PAGE_SIZE + 1)
        .offset(offsetOf(input.page));
      const [{ total }] = (await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(settingsVersion)) as [{ total: number }];
      const versions = await versionsWithFares(ctx.db, rows.map(flatten));
      return {
        items: versions.slice(0, PAGE_SIZE),
        previous: versions[PAGE_SIZE] ?? null,
        total,
      };
    }),

  create: adminProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const fieldErrors = checkLimits(input);
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false as const, fieldErrors };
    }
    const { baseVersion, fares, changeNote, ...values } = input;
    try {
      return await ctx.db.transaction(async (tx) => {
        const [latest] = await tx
          .select()
          .from(settingsVersion)
          .orderBy(desc(settingsVersion.version))
          .limit(1);
        if (!latest || latest.version !== baseVersion) {
          throw conflict("SETTINGS_CHANGED");
        }
        const latestFares = await tx
          .select()
          .from(categoryFare)
          .where(eq(categoryFare.settingsVersionId, latest.id));
        if (sameValues(input, latest, pickFares(latestFares, latest.id))) {
          return { ok: false as const, code: "NO_CHANGE" as const };
        }
        const [created] = await tx
          .insert(settingsVersion)
          .values({
            ...values,
            version: latest.version + 1,
            changeNote: changeNote.trim(),
            createdBy: ctx.session.user.id,
          })
          .returning();
        if (!created) {
          throw new Error("settings version was not created");
        }
        await tx.insert(categoryFare).values(
          CATEGORIES.map((category) => ({
            ...fares[category],
            category,
            settingsVersionId: created.id,
          }))
        );
        return { ok: true as const, id: created.id, version: created.version };
      });
    } catch (error) {
      // Two admins saving together: the unique index stops the second one.
      if (isUniqueViolation(error)) {
        throw conflict("SETTINGS_CHANGED");
      }
      throw error;
    }
  }),
});
