-- Test values for version 1 of the settings, to adjust from the back office.
-- Ids and dates are given here because these columns have no database default.
WITH new_version AS (
  INSERT INTO "settings_version" (
    "id", "version", "price_variation_pct", "group_min_drivers", "group_max_drivers",
    "driver_response_s", "group_pause_s", "max_groups", "client_response_s",
    "driver_counter_response_s", "gps_max_age_s", "change_note", "created_at"
  )
  VALUES (
    gen_random_uuid(), 1, 20, 1, 3, 20, 3, 4, 30, 30, 120, 'Valeurs de test initiales', now()
  )
  RETURNING "id"
)
INSERT INTO "category_fare" (
  "settings_version_id", "category", "base_fare_ar", "per_km_ar", "included_m",
  "rounding_ar", "max_capacity", "created_at"
)
SELECT new_version."id", fare."category"::"vehicle_category", fare."base", fare."per_km", 0, 100, fare."capacity", now()
FROM new_version
CROSS JOIN (
  VALUES ('car', 3000, 1000, 4), ('tuk_tuk', 1500, 600, 3)
) AS fare ("category", "base", "per_km", "capacity");
