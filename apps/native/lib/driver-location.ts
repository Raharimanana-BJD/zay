import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { trpcClient } from "@/utils/trpc";

const SECOND_MS = 1000;
const WATCH_DISTANCE_M = 15;
const KEEP_AWAKE_TAG = "zay-driver-online";

type PositionState = "idle" | "denied" | "active";

/**
 * Sends the position while the driver is online. Standing still still sends, so the
 * server keeps it fresh. There is no background tracking in the demo (spec 0003).
 */
export function useDriverPosition(isOnline: boolean, intervalS: number) {
  const [state, setState] = useState<PositionState>("idle");
  const latest = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    if (!isOnline) {
      setState("idle");
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    const send = () => {
      const location = latest.current;
      if (location) {
        trpcClient.driver.updatePosition
          .mutate({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracyM: location.coords.accuracy ?? undefined,
            // A repeat of the same point is still news: the driver is still here.
            recordedAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }
    };
    const start = async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (!granted) {
        setState("denied");
        return;
      }
      setState("active");
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: WATCH_DISTANCE_M,
          timeInterval: intervalS * SECOND_MS,
        },
        (location) => {
          latest.current = location;
          send();
        }
      );
      if (cancelled) {
        subscription.remove();
      }
    };
    start().catch(() => setState("denied"));
    const heartbeat = setInterval(send, intervalS * SECOND_MS);
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      cancelled = true;
      subscription?.remove();
      clearInterval(heartbeat);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [isOnline, intervalS]);

  return { state, coords: latest.current?.coords ?? null };
}
