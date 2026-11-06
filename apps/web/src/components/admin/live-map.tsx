import { Link } from "@tanstack/react-router";
import { Badge } from "@zay-app/ui/components/badge";
import {
  MapControls,
  MapMarker,
  MapPopup,
  type MapRef,
  Map as MapView,
  MarkerContent,
  MarkerTooltip,
} from "@zay-app/ui/components/map";
import { cn } from "@zay-app/ui/lib/utils";
import { BikeIcon, CarFrontIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatAge } from "@/lib/format";
import {
  activityLabel,
  BOOKING_STATUS_LABELS,
  CATEGORY_LABELS,
  labelOf,
} from "@/lib/labels";
import type { RouterOutputs } from "@/utils/trpc";

type Driver = RouterOutputs["admin"]["liveMap"]["drivers"]["items"][number];
type Tone = "available" | "riding" | "busy" | "stale";
interface Coordinates {
  latitude: number;
  longitude: number;
}

const TOLIARA_CENTER: [number, number] = [43.6667, -23.35];
const CITY_ZOOM = 13;
const FOCUS_ZOOM = 15;
const GLIDE_MS = 1000;

const TONES: Record<Tone, { label: string; className: string }> = {
  available: {
    label: "Disponible",
    className: "border-background bg-primary text-primary-foreground",
  },
  riding: {
    label: "En course",
    className: "border-foreground bg-background text-foreground",
  },
  busy: {
    label: "Indisponible",
    className: "border-background bg-muted-foreground text-background",
  },
  stale: {
    label: "Position ancienne",
    className: "border-muted-foreground border-dashed bg-muted text-foreground",
  },
};

function toneOf(driver: Driver): Tone {
  if (driver.isStale) {
    return "stale";
  }
  if (driver.bookingId) {
    return "riding";
  }
  return driver.isAvailable ? "available" : "busy";
}

const activityOf = (driver: Driver) =>
  driver.bookingStatus
    ? labelOf(BOOKING_STATUS_LABELS, driver.bookingStatus)
    : activityLabel(true, driver.isAvailable);

const vehicleOf = (driver: Driver) =>
  driver.category
    ? [
        labelOf(CATEGORY_LABELS, driver.category),
        driver.make,
        driver.model,
        driver.registration,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Aucun véhicule actif";

/** Moves a marker smoothly from one received position to the next. */
function useGlide(target: Coordinates): Coordinates {
  const { latitude, longitude } = target;
  const [position, setPosition] = useState<Coordinates>({
    latitude,
    longitude,
  });
  const current = useRef(position);

  useEffect(() => {
    const from = current.current;
    const move = (next: Coordinates) => {
      current.current = next;
      setPosition(next);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      move({ latitude, longitude });
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const progress = Math.min((time - startedAt) / GLIDE_MS, 1);
      move({
        latitude: from.latitude + (latitude - from.latitude) * progress,
        longitude: from.longitude + (longitude - from.longitude) * progress,
      });
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [latitude, longitude]);

  return position;
}

function DriverDetails({ driver }: { driver: Driver }) {
  return (
    <div className="grid gap-1 pr-2 text-sm">
      <p className="font-medium">{driver.name}</p>
      <p className="text-muted-foreground">{vehicleOf(driver)}</p>
      <p>{activityOf(driver)}</p>
      <p className={cn(driver.isStale && "font-medium")}>
        {driver.isStale ? "Dernière position connue, " : "Position reçue "}
        {formatAge(driver.ageS)}
        {driver.accuracyM === null
          ? null
          : ` (± ${Math.round(driver.accuracyM)} m)`}
      </p>
      {driver.phone ? (
        <a className="underline" href={`tel:${driver.phone}`}>
          {driver.phone}
        </a>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <Link
          className="underline"
          params={{ driverId: driver.driverId }}
          to="/admin/chauffeurs/$driverId"
        >
          Voir le dossier
        </Link>
        {driver.bookingId ? (
          <Link
            className="underline"
            params={{ bookingId: driver.bookingId }}
            to="/admin/reservations/$bookingId"
          >
            Voir la course
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function DriverMarker({
  driver,
  isSelected,
  onClose,
  onSelect,
}: {
  driver: Driver;
  isSelected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  const position = useGlide(driver);
  const tone = TONES[toneOf(driver)];
  const Icon = driver.category === "tuk_tuk" ? BikeIcon : CarFrontIcon;

  return (
    <>
      <MapMarker
        {...position}
        onClick={(event) => {
          // A click that reaches the map would close the popup it just opened.
          event.stopPropagation();
          onSelect();
        }}
      >
        <MarkerContent>
          <button
            aria-label={`${driver.name}, ${tone.label}`}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-full border-2 shadow-md",
              tone.className,
              isSelected && "ring-2 ring-ring ring-offset-2"
            )}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        </MarkerContent>
        {isSelected ? null : <MarkerTooltip>{driver.name}</MarkerTooltip>}
      </MapMarker>
      {isSelected ? (
        <MapPopup
          {...position}
          className="font-sans"
          closeButton
          offset={20}
          onClose={onClose}
        >
          <DriverDetails driver={driver} />
        </MapPopup>
      ) : null}
    </>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground text-sm">
      {Object.entries(TONES).map(([key, tone]) => (
        <li className="flex items-center gap-2" key={key}>
          <span
            aria-hidden="true"
            className={cn("size-4 rounded-full border-2", tone.className)}
          />
          {tone.label}
        </li>
      ))}
    </ul>
  );
}

function DriverList({
  drivers,
  onSelect,
  selectedId,
}: {
  drivers: Driver[];
  onSelect: (driver: Driver) => void;
  selectedId: string | null;
}) {
  if (drivers.length === 0) {
    return (
      <p className="rounded-2xl bg-muted px-6 py-12 text-center">
        Aucun chauffeur en ligne pour le moment.
      </p>
    );
  }
  return (
    <ul className="grid content-start gap-2 lg:h-[calc(100svh-16rem)] lg:overflow-y-auto">
      {drivers.map((driver) => (
        <li key={driver.driverId}>
          <button
            aria-pressed={driver.driverId === selectedId}
            className={cn(
              "grid w-full cursor-pointer gap-1 rounded-2xl border p-3 text-left text-sm hover:bg-muted",
              driver.driverId === selectedId && "border-foreground"
            )}
            onClick={() => onSelect(driver)}
            type="button"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{driver.name}</span>
              {driver.isSimulated ? (
                <Badge variant="outline">Simulé</Badge>
              ) : null}
            </span>
            <span>{activityOf(driver)}</span>
            <span
              className={cn(
                "text-muted-foreground",
                driver.isStale && "font-medium text-foreground"
              )}
            >
              {driver.isStale ? "Position ancienne, " : ""}
              {formatAge(driver.ageS)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function LiveMap({
  drivers,
  isDisconnected,
}: {
  drivers: Driver[];
  isDisconnected: boolean;
}) {
  const mapRef = useRef<MapRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Without fresh data, nothing on screen can be presented as current.
  const shown = isDisconnected
    ? drivers.map((driver) => ({ ...driver, isStale: true }))
    : drivers;

  const focus = (driver: Driver) => {
    setSelectedId(driver.driverId);
    const map = mapRef.current;
    map?.easeTo({
      center: [driver.longitude, driver.latitude],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {isDisconnected ? (
        <p className="rounded-2xl bg-muted px-4 py-3 font-medium" role="alert">
          Actualisation interrompue. Les positions affichées ne sont plus à
          jour.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-[60svh] min-h-96 overflow-hidden rounded-2xl border lg:h-[calc(100svh-16rem)]">
          <MapView
            center={TOLIARA_CENTER}
            ref={mapRef}
            theme="light"
            zoom={CITY_ZOOM}
          >
            <MapControls showFullscreen />
            {shown.map((driver) => (
              <DriverMarker
                driver={driver}
                isSelected={driver.driverId === selectedId}
                key={driver.driverId}
                onClose={() => setSelectedId(null)}
                onSelect={() => setSelectedId(driver.driverId)}
              />
            ))}
          </MapView>
        </div>
        <DriverList drivers={shown} onSelect={focus} selectedId={selectedId} />
      </div>
      <Legend />
    </div>
  );
}
