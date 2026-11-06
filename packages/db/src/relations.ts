import { defineRelations, defineRelationsPart } from "drizzle-orm";

import * as schema from "./schema";

// `user` keeps only the relations Better Auth generates, so read app data from its
// own table (for example `booking.client`) rather than from `user`.
const appRelations = defineRelationsPart(schema, (r) => ({
  driverProfile: {
    user: r.one.user({
      from: r.driverProfile.userId,
      to: r.user.id,
      optional: false,
    }),
    activeVehicle: r.one.vehicle({
      from: r.driverProfile.activeVehicleId,
      to: r.vehicle.id,
      alias: "driver_active_vehicle",
    }),
    vehicles: r.many.vehicle({ alias: "driver_vehicles" }),
    documents: r.many.driverDocument(),
    position: r.one.driverPosition({
      from: r.driverProfile.userId,
      to: r.driverPosition.driverId,
    }),
  },
  vehicle: {
    driver: r.one.driverProfile({
      from: r.vehicle.driverId,
      to: r.driverProfile.userId,
      alias: "driver_vehicles",
      optional: false,
    }),
  },
  driverDocument: {
    driver: r.one.driverProfile({
      from: r.driverDocument.driverId,
      to: r.driverProfile.userId,
      optional: false,
    }),
    vehicle: r.one.vehicle({
      from: r.driverDocument.vehicleId,
      to: r.vehicle.id,
    }),
  },
  driverPosition: {
    driver: r.one.driverProfile({
      from: r.driverPosition.driverId,
      to: r.driverProfile.userId,
      optional: false,
    }),
  },
  landmark: {
    district: r.one.district({
      from: r.landmark.districtId,
      to: r.district.id,
    }),
  },
  settingsVersion: {
    categoryFares: r.many.categoryFare(),
  },
  categoryFare: {
    settingsVersion: r.one.settingsVersion({
      from: r.categoryFare.settingsVersionId,
      to: r.settingsVersion.id,
      optional: false,
    }),
  },
  booking: {
    client: r.one.user({
      from: r.booking.clientId,
      to: r.user.id,
      optional: false,
    }),
    driver: r.one.driverProfile({
      from: r.booking.driverId,
      to: r.driverProfile.userId,
    }),
    vehicle: r.one.vehicle({ from: r.booking.vehicleId, to: r.vehicle.id }),
    settingsVersion: r.one.settingsVersion({
      from: r.booking.settingsVersionId,
      to: r.settingsVersion.id,
      optional: false,
    }),
    pickupDistrict: r.one.district({
      from: r.booking.pickupDistrictId,
      to: r.district.id,
      alias: "booking_pickup_district",
    }),
    pickupLandmark: r.one.landmark({
      from: r.booking.pickupLandmarkId,
      to: r.landmark.id,
      alias: "booking_pickup_landmark",
    }),
    destinationDistrict: r.one.district({
      from: r.booking.destinationDistrictId,
      to: r.district.id,
      alias: "booking_destination_district",
    }),
    destinationLandmark: r.one.landmark({
      from: r.booking.destinationLandmarkId,
      to: r.landmark.id,
      alias: "booking_destination_landmark",
    }),
    events: r.many.bookingEvent(),
    fareQuotes: r.many.fareQuote(),
    destinationChanges: r.many.destinationChange(),
    dispatchGroups: r.many.dispatchGroup(),
    offers: r.many.offer(),
    payment: r.one.payment({ from: r.booking.id, to: r.payment.bookingId }),
    reports: r.many.report(),
  },
  bookingEvent: {
    booking: r.one.booking({
      from: r.bookingEvent.bookingId,
      to: r.booking.id,
      optional: false,
    }),
    actor: r.one.user({ from: r.bookingEvent.actorId, to: r.user.id }),
  },
  fareQuote: {
    booking: r.one.booking({
      from: r.fareQuote.bookingId,
      to: r.booking.id,
      optional: false,
    }),
  },
  destinationChange: {
    booking: r.one.booking({
      from: r.destinationChange.bookingId,
      to: r.booking.id,
      optional: false,
    }),
    fareQuote: r.one.fareQuote({
      from: r.destinationChange.fareQuoteId,
      to: r.fareQuote.id,
    }),
  },
  dispatchGroup: {
    booking: r.one.booking({
      from: r.dispatchGroup.bookingId,
      to: r.booking.id,
      optional: false,
    }),
    offers: r.many.offer(),
  },
  offer: {
    booking: r.one.booking({
      from: r.offer.bookingId,
      to: r.booking.id,
      optional: false,
    }),
    group: r.one.dispatchGroup({
      from: r.offer.groupId,
      to: r.dispatchGroup.id,
      optional: false,
    }),
    driver: r.one.driverProfile({
      from: r.offer.driverId,
      to: r.driverProfile.userId,
      optional: false,
    }),
    vehicle: r.one.vehicle({
      from: r.offer.vehicleId,
      to: r.vehicle.id,
      optional: false,
    }),
    fareQuote: r.one.fareQuote({
      from: r.offer.fareQuoteId,
      to: r.fareQuote.id,
      optional: false,
    }),
    proposals: r.many.offerProposal(),
  },
  offerProposal: {
    offer: r.one.offer({
      from: r.offerProposal.offerId,
      to: r.offer.id,
      optional: false,
    }),
    actor: r.one.user({
      from: r.offerProposal.actorId,
      to: r.user.id,
      optional: false,
    }),
  },
  payment: {
    booking: r.one.booking({
      from: r.payment.bookingId,
      to: r.booking.id,
      optional: false,
    }),
    events: r.many.paymentEvent(),
  },
  paymentEvent: {
    payment: r.one.payment({
      from: r.paymentEvent.paymentId,
      to: r.payment.id,
      optional: false,
    }),
    actor: r.one.user({ from: r.paymentEvent.actorId, to: r.user.id }),
  },
  report: {
    booking: r.one.booking({ from: r.report.bookingId, to: r.booking.id }),
    author: r.one.user({
      from: r.report.authorId,
      to: r.user.id,
      alias: "report_author",
      optional: false,
    }),
    assignee: r.one.user({
      from: r.report.assigneeId,
      to: r.user.id,
      alias: "report_assignee",
    }),
    events: r.many.reportEvent(),
  },
  reportEvent: {
    report: r.one.report({
      from: r.reportEvent.reportId,
      to: r.report.id,
      optional: false,
    }),
    actor: r.one.user({
      from: r.reportEvent.actorId,
      to: r.user.id,
      optional: false,
    }),
  },
  subscriptionPayment: {
    driver: r.one.driverProfile({
      from: r.subscriptionPayment.driverId,
      to: r.driverProfile.userId,
      optional: false,
    }),
    plan: r.one.subscriptionPlan({
      from: r.subscriptionPayment.planId,
      to: r.subscriptionPlan.id,
      optional: false,
    }),
    period: r.one.subscriptionPeriod({
      from: r.subscriptionPayment.id,
      to: r.subscriptionPeriod.paymentId,
    }),
  },
  subscriptionPeriod: {
    driver: r.one.driverProfile({
      from: r.subscriptionPeriod.driverId,
      to: r.driverProfile.userId,
      optional: false,
    }),
    payment: r.one.subscriptionPayment({
      from: r.subscriptionPeriod.paymentId,
      to: r.subscriptionPayment.id,
      optional: false,
    }),
  },
}));

export const relations = {
  ...defineRelations(schema),
  ...schema.authRelations,
  ...appRelations,
};
