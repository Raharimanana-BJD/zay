import z from "zod";

/** `createUser` skips Better Auth's field validators, so its callers use this. */
export const phoneSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Le téléphone doit être au format international, par exemple +261340000000"
  );
