import { runDispatchTick } from "@zay-app/api/domain/dispatch";

import { db } from "./services";

const TICK_MS = 1000;

let running = false;

async function tick() {
  // A slow database must not stack ticks on top of each other.
  if (running) {
    return;
  }
  running = true;
  try {
    await runDispatchTick(db);
  } catch (error) {
    console.error("Dispatch tick failed", error);
  } finally {
    running = false;
  }
}

/** `bun --hot` reloads this module, so the timer is kept across reloads. */
export function startDispatcher() {
  const state = globalThis as {
    zayDispatcher?: ReturnType<typeof setInterval>;
  };
  if (state.zayDispatcher) {
    clearInterval(state.zayDispatcher);
  }
  state.zayDispatcher = setInterval(tick, TICK_MS);
}
