import { useEffect, useState } from "react";

const SECOND_MS = 1000;

/** Counts down from the server's remaining seconds, never from the phone's clock. */
export function useCountdown(seconds: number, updatedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, seconds - Math.floor((now - updatedAt) / SECOND_MS));
}
