import { booking } from "@zay-app/db/schema/bookings";
import { payment } from "@zay-app/db/schema/payments";
import z from "zod";

const MAX_NOTE = 300;

export const requestIdSchema = z.uuid();
export const noteSchema = z.string().trim().max(MAX_NOTE).optional();
export const priceSchema = z.number().int().positive();

export const placeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: noteSchema,
  districtId: z.uuid().optional(),
  landmarkId: z.uuid().optional(),
});
export type PlaceInput = z.infer<typeof placeSchema>;

export const reasonSchema = z.object({
  clientRequestId: requestIdSchema,
  reasonCode: z.string(),
  reasonNote: noteSchema,
});

export const historyColumns = {
  id: booking.id,
  status: booking.status,
  createdAt: booking.createdAt,
  completedAt: booking.completedAt,
  agreedPriceAr: booking.agreedPriceAr,
  paymentStatus: payment.status,
  declaredAmountAr: payment.declaredAmountAr,
};
