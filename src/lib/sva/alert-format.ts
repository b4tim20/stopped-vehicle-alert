import type { AlertPayload, AlertStatus, Camera, TrackedVehicle } from "./types.ts";
import { formatDuration } from "./detection.ts";
import { googleMapsUrl } from "./geo.ts";

export function buildAlertPayload(args: {
  alertId: string;
  camera: Pick<
    Camera,
    "id" | "name" | "highway" | "direction" | "mileMarker" | "lat" | "lon"
  >;
  track: Pick<TrackedVehicle, "id" | "vehicleClass" | "confidence" | "stoppedDurationSec">;
  status: AlertStatus;
  timestamp: string;
  snapshotUrl?: string | null;
}): AlertPayload {
  const { alertId, camera, track, status, timestamp, snapshotUrl } = args;
  return {
    alert_id: alertId,
    camera_id: camera.id,
    camera_name: camera.name,
    highway: camera.highway,
    direction: camera.direction,
    mile_marker: camera.mileMarker,
    lat: camera.lat,
    lon: camera.lon,
    map_link: googleMapsUrl(camera.lat, camera.lon),
    timestamp,
    duration_stopped_seconds: Math.round(track.stoppedDurationSec),
    duration_stopped_human: formatDuration(track.stoppedDurationSec),
    snapshot_url: snapshotUrl ?? null,
    clip_url: null,
    confidence: roundConf(track.confidence),
    status,
    vehicle_class: track.vehicleClass,
    track_id: track.id,
  };
}

export function roundConf(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function alertHeadline(payload: AlertPayload): string {
  return `Stopped ${payload.vehicle_class} on ${payload.highway} ${payload.direction} at ${payload.camera_name} for ${payload.duration_stopped_human}`;
}
