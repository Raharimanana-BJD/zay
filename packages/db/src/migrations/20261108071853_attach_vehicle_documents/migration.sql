-- The app sent every paper with no vehicle, while the back office reads the
-- registration card and the insurance under their vehicle. Papers already sent
-- go to the vehicle the driver uses when this migration runs.
UPDATE "driver_document" AS d
SET "vehicle_id" = p."active_vehicle_id"
FROM "driver_profile" AS p
WHERE d."driver_id" = p."user_id"
  AND d."vehicle_id" IS NULL
  AND d."type_code" IN ('vehicle_registration', 'insurance')
  AND p."active_vehicle_id" IS NOT NULL;
