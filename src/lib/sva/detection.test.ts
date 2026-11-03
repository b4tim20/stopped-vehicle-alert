import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendPosition,
  displacementInWindow,
  formatDuration,
  shouldRaiseAlert,
  updateStopState,
} from "./detection.ts";
import type { TrackedVehicle } from "./types.ts";

function track(over: Partial<TrackedVehicle> = {}): TrackedVehicle {
  return {
    id: "trk-1",
    cameraId: "cam-1",
    trackId: 1,
    vehicleClass: "car",
    confidence: 0.9,
    x: 0.5,
    y: 0.5,
    vx: 0,
    vy: 0,
    lane: 1,
    firstSeenAt: 0,
    lastSeenAt: 0,
    firstStoppedAt: null,
    stoppedDurationSec: 0,
    isStopped: false,
    isActive: true,
    positions: [],
    ...over,
  };
}

test("displacement is infinite with fewer than two samples", () => {
  assert.equal(displacementInWindow([{ t: 0, x: 0, y: 0 }], 1000, 8000), Number.POSITIVE_INFINITY);
});

test("moving vehicle is not classified stopped", () => {
  const now = 10_000;
  const positions = [
    { t: 2000, x: 0.1, y: 0.2 },
    { t: 5000, x: 0.25, y: 0.35 },
    { t: 9000, x: 0.4, y: 0.5 },
  ];
  const next = updateStopState(track({ positions, x: 0.4, y: 0.5 }), now, {
    pixelThreshold: 0.018,
    windowMs: 8000,
  });
  assert.equal(next.isStopped, false);
  assert.equal(next.firstStoppedAt, null);
});

test("stationary vehicle accumulates duration", () => {
  const t0 = 1_000;
  const now = t0 + 15_000;
  const positions = [
    { t: t0, x: 0.4, y: 0.5 },
    { t: t0 + 4000, x: 0.401, y: 0.5 },
    { t: t0 + 8000, x: 0.4, y: 0.501 },
    { t: now, x: 0.4, y: 0.5 },
  ];
  const next = updateStopState(
    track({ positions, firstStoppedAt: t0, x: 0.4, y: 0.5 }),
    now,
    { pixelThreshold: 0.018, windowMs: 8000 },
    1,
  );
  assert.equal(next.isStopped, true);
  assert.equal(next.firstStoppedAt, t0);
  assert.ok(Math.abs(next.stoppedDurationSec - 15) < 0.01);
});

test("speed multiplier scales reported duration", () => {
  const t0 = 0;
  const now = 12_000;
  const positions = [
    { t: 0, x: 0.5, y: 0.5 },
    { t: 4000, x: 0.5, y: 0.5 },
    { t: 12000, x: 0.5, y: 0.5 },
  ];
  const next = updateStopState(
    track({ positions, firstStoppedAt: t0 }),
    now,
    { pixelThreshold: 0.018, windowMs: 8000 },
    10,
  );
  assert.ok(Math.abs(next.stoppedDurationSec - 120) < 0.01);
});

test("alert fires at threshold and not before", () => {
  const below = track({ isStopped: true, stoppedDurationSec: 119, isActive: true });
  const at = track({ isStopped: true, stoppedDurationSec: 120, isActive: true });
  assert.equal(shouldRaiseAlert(below, 120), false);
  assert.equal(shouldRaiseAlert(at, 120), true);
  assert.equal(shouldRaiseAlert({ ...at, isActive: false }, 120), false);
});

test("formatDuration is compact and readable", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(9), "9s");
  assert.equal(formatDuration(128), "2m 8s");
  assert.equal(formatDuration(3725), "1h 2m 5s");
});

test("appendPosition keeps a sliding window", () => {
  const start = Array.from({ length: 24 }, (_, i) => ({ t: i, x: i, y: 0 }));
  const next = appendPosition(start, { t: 24, x: 24, y: 0 }, 24);
  assert.equal(next.length, 24);
  assert.equal(next[0].t, 1);
  assert.equal(next[23].t, 24);
});
