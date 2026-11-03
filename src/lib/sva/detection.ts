import type { TrackPosition, TrackedVehicle } from "./types.ts";

export type StopConfig = {
  pixelThreshold: number;
  windowMs: number;
  durationThresholdSec: number;
};

export function displacementInWindow(
  positions: TrackPosition[],
  now: number,
  windowMs: number,
): number {
  const inWindow = positions.filter((p) => now - p.t <= windowMs);
  if (inWindow.length < 2) return Number.POSITIVE_INFINITY;
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y);
}

export function meanSpeed(
  positions: TrackPosition[],
  now: number,
  windowMs: number,
): number {
  const inWindow = positions.filter((p) => now - p.t <= windowMs);
  if (inWindow.length < 2) return Number.POSITIVE_INFINITY;
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return Number.POSITIVE_INFINITY;
  return Math.hypot(last.x - first.x, last.y - first.y) / dt;
}

export function updateStopState(
  track: TrackedVehicle,
  now: number,
  config: Pick<StopConfig, "pixelThreshold" | "windowMs">,
  speedMultiplier = 1,
): TrackedVehicle {
  const disp = displacementInWindow(track.positions, now, config.windowMs);
  const moving = disp >= config.pixelThreshold;
  if (moving) {
    return {
      ...track,
      isStopped: false,
      firstStoppedAt: null,
      stoppedDurationSec: 0,
      lastSeenAt: now,
    };
  }
  const firstStoppedAt = track.firstStoppedAt ?? now;
  const wallSec = (now - firstStoppedAt) / 1000;
  return {
    ...track,
    isStopped: true,
    firstStoppedAt,
    stoppedDurationSec: wallSec * speedMultiplier,
    lastSeenAt: now,
  };
}

export function shouldRaiseAlert(
  track: TrackedVehicle,
  thresholdSec: number,
): boolean {
  return track.isActive && track.isStopped && track.stoppedDurationSec >= thresholdSec;
}

export function isInCooldown(cooldownUntil: number | null, now: number): boolean {
  return cooldownUntil != null && now < cooldownUntil;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export function appendPosition(
  positions: TrackPosition[],
  next: TrackPosition,
  keep = 24,
): TrackPosition[] {
  const out = [...positions, next];
  return out.length > keep ? out.slice(out.length - keep) : out;
}

/** Deterministic 32-bit hash for stable per-camera simulation. */
export function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
