CREATE TYPE "actor_kind" AS ENUM('client', 'driver', 'admin', 'support', 'system');--> statement-breakpoint
CREATE TYPE "booking_status" AS ENUM('PENDING', 'SEARCHING', 'OFFERED', 'ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_DRIVER_FOUND', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "destination_change_status" AS ENUM('pending', 'applied', 'refused', 'expired');--> statement-breakpoint
CREATE TYPE "dispatch_group_status" AS ENUM('active', 'paused', 'exhausted', 'closed');--> statement-breakpoint
CREATE TYPE "distance_source" AS ENUM('route', 'fallback');--> statement-breakpoint
CREATE TYPE "employment_relation" AS ENUM('owner', 'renter', 'employee');--> statement-breakpoint
CREATE TYPE "offer_status" AS ENUM('sent', 'priced', 'negotiating', 'accepted', 'refused', 'expired', 'void', 'withdrawn');--> statement-breakpoint
CREATE TYPE "payment_event_kind" AS ENUM('declared', 'disputed', 'resolved');--> statement-breakpoint
CREATE TYPE "payment_method" AS ENUM('cash');--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM('pending', 'partial', 'paid', 'disputed');--> statement-breakpoint
CREATE TYPE "proposal_kind" AS ENUM('accept', 'propose', 'counter', 'refuse');--> statement-breakpoint
CREATE TYPE "report_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "requested_category" AS ENUM('car', 'tuk_tuk', 'auto');--> statement-breakpoint
CREATE TYPE "subscription_payment_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "vehicle_category" AS ENUM('car', 'tuk_tuk');--> statement-breakpoint
CREATE TYPE "verification_status" AS ENUM('pending', 'approved', 'rejected', 'changes_requested', 'suspended');--> statement-breakpoint
CREATE TYPE "verification_subject" AS ENUM('driver', 'vehicle', 'document');--> statement-breakpoint
CREATE TYPE "zone_kind" AS ENUM('pickup', 'destination', 'driver');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"phone" text NOT NULL UNIQUE,
	"locale" text DEFAULT 'fr' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY,
	"client_id" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"requested_category" "requested_category" NOT NULL,
	"passengers" integer NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING'::"booking_status" NOT NULL,
	"settings_version_id" uuid NOT NULL,
	"driver_id" text,
	"vehicle_id" uuid,
	"agreed_price_ar" integer,
	"pickup_point" geometry(point,4326) NOT NULL,
	"pickup_note" text,
	"pickup_district_id" uuid,
	"pickup_landmark_id" uuid,
	"destination_point" geometry(point,4326) NOT NULL,
	"destination_note" text,
	"destination_district_id" uuid,
	"destination_landmark_id" uuid,
	"status_changed_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_passengers_positive" CHECK ("passengers" >= 1),
	CONSTRAINT "booking_assigned_has_driver_vehicle_price" CHECK ("status" NOT IN ('ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED')
        OR ("driver_id" IS NOT NULL AND "vehicle_id" IS NOT NULL AND "agreed_price_ar" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "booking_event" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid NOT NULL,
	"type" text NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status",
	"actor_kind" "actor_kind" NOT NULL,
	"actor_id" text,
	"reason_code" text,
	"reason_note" text,
	"data" jsonb,
	"client_request_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_event_actor_required" CHECK ("actor_kind" = 'system' OR "actor_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "destination_change" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid NOT NULL,
	"old_point" geometry(point,4326) NOT NULL,
	"old_note" text,
	"old_district_id" uuid,
	"old_landmark_id" uuid,
	"new_point" geometry(point,4326) NOT NULL,
	"new_note" text,
	"new_district_id" uuid,
	"new_landmark_id" uuid,
	"new_distance_m" integer NOT NULL,
	"new_distance_source" "distance_source" NOT NULL,
	"settings_version_id" uuid NOT NULL,
	"old_price_ar" integer NOT NULL,
	"new_price_ar" integer NOT NULL,
	"fare_quote_id" uuid,
	"requested_by" text NOT NULL,
	"client_accepted_at" timestamp with time zone,
	"driver_accepted_at" timestamp with time zone,
	"status" "destination_change_status" DEFAULT 'pending'::"destination_change_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fare_quote" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"settings_version_id" uuid NOT NULL,
	"distance_m" integer NOT NULL,
	"distance_source" "distance_source" NOT NULL,
	"amount_ar" integer NOT NULL,
	"min_ar" integer NOT NULL,
	"max_ar" integer NOT NULL,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_group" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"status" "dispatch_group_status" DEFAULT 'active'::"dispatch_group_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"driver_id" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"fare_quote_id" uuid NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"status" "offer_status" DEFAULT 'sent'::"offer_status" NOT NULL,
	"current_price_ar" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_proposal" (
	"id" uuid PRIMARY KEY,
	"offer_id" uuid NOT NULL,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_id" text NOT NULL,
	"kind" "proposal_kind" NOT NULL,
	"amount_ar" integer,
	"reason_code" text,
	"reason_note" text,
	"client_request_id" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_document" (
	"id" uuid PRIMARY KEY,
	"driver_id" text NOT NULL,
	"vehicle_id" uuid,
	"type_code" text NOT NULL,
	"storage_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"verification_status" "verification_status" DEFAULT 'pending'::"verification_status" NOT NULL,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_position" (
	"driver_id" text PRIMARY KEY,
	"point" geometry(point,4326) NOT NULL,
	"accuracy_m" double precision,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_profile" (
	"user_id" text PRIMARY KEY,
	"employment_relation" "employment_relation" NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending'::"verification_status" NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"active_vehicle_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "driver_profile_available_requires_online" CHECK (NOT "is_available" OR "is_online")
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY,
	"driver_id" text NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"make" text,
	"model" text NOT NULL,
	"registration" text,
	"capacity" integer NOT NULL,
	"photo_key" text,
	"features" jsonb DEFAULT '[]' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending'::"verification_status" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "vehicle_capacity_positive" CHECK ("capacity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "verification_decision" (
	"id" uuid PRIMARY KEY,
	"subject" "verification_subject" NOT NULL,
	"subject_id" text NOT NULL,
	"status" "verification_status" NOT NULL,
	"reason_code" text,
	"reason_note" text,
	"decided_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid NOT NULL UNIQUE,
	"method" "payment_method" DEFAULT 'cash'::"payment_method" NOT NULL,
	"agreed_amount_ar" integer NOT NULL,
	"declared_amount_ar" integer,
	"status" "payment_status" DEFAULT 'pending'::"payment_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_declared_not_negative" CHECK ("declared_amount_ar" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_event" (
	"id" uuid PRIMARY KEY,
	"payment_id" uuid NOT NULL,
	"kind" "payment_event_kind" NOT NULL,
	"amount_ar" integer,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_id" text,
	"reason_code" text,
	"reason_note" text,
	"client_request_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_event_actor_required" CHECK ("actor_kind" = 'system' OR "actor_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "district" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"point" geometry(point,4326) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landmark" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"point" geometry(point,4326) NOT NULL,
	"district_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_zone" (
	"id" uuid PRIMARY KEY,
	"kind" "zone_kind" NOT NULL,
	"name" text NOT NULL,
	"area" geometry(MultiPolygon,4326) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_fare" (
	"settings_version_id" uuid,
	"category" "vehicle_category",
	"base_fare_ar" integer NOT NULL,
	"per_km_ar" integer NOT NULL,
	"included_m" integer NOT NULL,
	"rounding_ar" integer NOT NULL,
	"max_capacity" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "category_fare_pkey" PRIMARY KEY("settings_version_id","category"),
	CONSTRAINT "category_fare_rounding_positive" CHECK ("rounding_ar" > 0)
);
--> statement-breakpoint
CREATE TABLE "settings_version" (
	"id" uuid PRIMARY KEY,
	"version" integer NOT NULL UNIQUE,
	"price_variation_pct" integer NOT NULL,
	"group_min_drivers" integer NOT NULL,
	"group_max_drivers" integer NOT NULL,
	"driver_response_s" integer NOT NULL,
	"group_pause_s" integer NOT NULL,
	"max_groups" integer NOT NULL,
	"client_response_s" integer NOT NULL,
	"driver_counter_response_s" integer NOT NULL,
	"gps_max_age_s" integer NOT NULL,
	"change_note" text,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "settings_version_group_range" CHECK ("group_min_drivers" <= "group_max_drivers"),
	CONSTRAINT "settings_version_price_variation_range" CHECK ("price_variation_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "subscription_payment" (
	"id" uuid PRIMARY KEY,
	"driver_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"amount_ar" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"status" "subscription_payment_status" DEFAULT 'pending'::"subscription_payment_status" NOT NULL,
	"client_request_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_period" (
	"id" uuid PRIMARY KEY,
	"driver_id" text NOT NULL,
	"payment_id" uuid NOT NULL UNIQUE,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plan" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"price_ar" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "subscription_plan_price_positive" CHECK ("price_ar" > 0),
	CONSTRAINT "subscription_plan_duration_positive" CHECK ("duration_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY,
	"booking_id" uuid,
	"author_id" text NOT NULL,
	"type_code" text NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'open'::"report_status" NOT NULL,
	"assignee_id" text,
	"client_request_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_event" (
	"id" uuid PRIMARY KEY,
	"report_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"from_status" "report_status",
	"to_status" "report_status",
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_client_request_uq" ON "booking" ("client_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_driver_active_uq" ON "booking" ("driver_id") WHERE "status" IN ('ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS');--> statement-breakpoint
CREATE INDEX "booking_client_created_idx" ON "booking" ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_driver_created_idx" ON "booking" ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_event_actor_request_uq" ON "booking_event" ("actor_id","client_request_id");--> statement-breakpoint
CREATE INDEX "booking_event_booking_created_idx" ON "booking_event" ("booking_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "destination_change_pending_uq" ON "destination_change" ("booking_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "destination_change_booking_id_idx" ON "destination_change" ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fare_quote_active_uq" ON "fare_quote" ("booking_id","category") WHERE "replaced_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dispatch_group_booking_sequence_uq" ON "dispatch_group" ("booking_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_booking_driver_uq" ON "offer" ("booking_id","driver_id") WHERE "status" <> 'void';--> statement-breakpoint
CREATE UNIQUE INDEX "offer_driver_open_uq" ON "offer" ("driver_id") WHERE "status" IN ('sent', 'priced', 'negotiating');--> statement-breakpoint
CREATE UNIQUE INDEX "offer_booking_negotiating_uq" ON "offer" ("booking_id") WHERE "status" = 'negotiating';--> statement-breakpoint
CREATE UNIQUE INDEX "offer_booking_accepted_uq" ON "offer" ("booking_id") WHERE "status" = 'accepted';--> statement-breakpoint
CREATE UNIQUE INDEX "offer_proposal_actor_request_uq" ON "offer_proposal" ("actor_id","client_request_id");--> statement-breakpoint
CREATE INDEX "offer_proposal_offer_created_idx" ON "offer_proposal" ("offer_id","created_at");--> statement-breakpoint
CREATE INDEX "driver_document_driver_id_idx" ON "driver_document" ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_position_point_gist" ON "driver_position" USING gist ("point");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_registration_active_uq" ON "vehicle" ("registration") WHERE "archived_at" IS NULL AND "registration" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vehicle_driver_id_idx" ON "vehicle" ("driver_id");--> statement-breakpoint
CREATE INDEX "verification_decision_subject_idx" ON "verification_decision" ("subject","subject_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_event_actor_request_uq" ON "payment_event" ("actor_id","client_request_id");--> statement-breakpoint
CREATE INDEX "payment_event_payment_id_idx" ON "payment_event" ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "district_name_active_uq" ON "district" ("name") WHERE "archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "landmark_district_id_idx" ON "landmark" ("district_id");--> statement-breakpoint
CREATE INDEX "service_zone_area_gist" ON "service_zone" USING gist ("area");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payment_provider_reference_uq" ON "subscription_payment" ("provider","provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payment_driver_request_uq" ON "subscription_payment" ("driver_id","client_request_id");--> statement-breakpoint
CREATE INDEX "subscription_period_driver_ends_idx" ON "subscription_period" ("driver_id","ends_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" ("target_type","target_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_author_request_uq" ON "report" ("author_id","client_request_id");--> statement-breakpoint
CREATE INDEX "report_status_created_idx" ON "report" ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_event_report_id_idx" ON "report_event" ("report_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_client_id_user_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_settings_version_id_settings_version_id_fkey" FOREIGN KEY ("settings_version_id") REFERENCES "settings_version"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_vehicle_id_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_pickup_district_id_district_id_fkey" FOREIGN KEY ("pickup_district_id") REFERENCES "district"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_pickup_landmark_id_landmark_id_fkey" FOREIGN KEY ("pickup_landmark_id") REFERENCES "landmark"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_destination_district_id_district_id_fkey" FOREIGN KEY ("destination_district_id") REFERENCES "district"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_destination_landmark_id_landmark_id_fkey" FOREIGN KEY ("destination_landmark_id") REFERENCES "landmark"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_old_district_id_district_id_fkey" FOREIGN KEY ("old_district_id") REFERENCES "district"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_old_landmark_id_landmark_id_fkey" FOREIGN KEY ("old_landmark_id") REFERENCES "landmark"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_new_district_id_district_id_fkey" FOREIGN KEY ("new_district_id") REFERENCES "district"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_new_landmark_id_landmark_id_fkey" FOREIGN KEY ("new_landmark_id") REFERENCES "landmark"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_settings_version_id_settings_version_id_fkey" FOREIGN KEY ("settings_version_id") REFERENCES "settings_version"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_fare_quote_id_fare_quote_id_fkey" FOREIGN KEY ("fare_quote_id") REFERENCES "fare_quote"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "destination_change" ADD CONSTRAINT "destination_change_requested_by_user_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fare_quote" ADD CONSTRAINT "fare_quote_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fare_quote" ADD CONSTRAINT "fare_quote_settings_version_id_settings_version_id_fkey" FOREIGN KEY ("settings_version_id") REFERENCES "settings_version"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "dispatch_group" ADD CONSTRAINT "dispatch_group_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_group_id_dispatch_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "dispatch_group"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_vehicle_id_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_fare_quote_id_fare_quote_id_fkey" FOREIGN KEY ("fare_quote_id") REFERENCES "fare_quote"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer_proposal" ADD CONSTRAINT "offer_proposal_offer_id_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offer_proposal" ADD CONSTRAINT "offer_proposal_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "driver_document" ADD CONSTRAINT "driver_document_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "driver_document" ADD CONSTRAINT "driver_document_vehicle_id_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "driver_position" ADD CONSTRAINT "driver_position_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "driver_profile" ADD CONSTRAINT "driver_profile_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "driver_profile" ADD CONSTRAINT "driver_profile_active_vehicle_id_vehicle_id_fk" FOREIGN KEY ("active_vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_decided_by_user_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_payment_id_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "landmark" ADD CONSTRAINT "landmark_district_id_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "category_fare" ADD CONSTRAINT "category_fare_settings_version_id_settings_version_id_fkey" FOREIGN KEY ("settings_version_id") REFERENCES "settings_version"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "settings_version" ADD CONSTRAINT "settings_version_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_plan_id_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subscription_period" ADD CONSTRAINT "subscription_period_driver_id_driver_profile_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profile"("user_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subscription_period" ADD CONSTRAINT "subscription_period_payment_id_subscription_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "subscription_payment"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_booking_id_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_assignee_id_user_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report_event" ADD CONSTRAINT "report_event_report_id_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "report_event" ADD CONSTRAINT "report_event_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT;