import { getSql } from "@/lib/db";
import { catalogInRadius, type CatalogCamera } from "./catalog";
import { fetchPublicCameras } from "./public-feeds";
import { asBool, asNullStr, asNum, asStr, iso } from "./coerce";
import {
  appendPosition,
  hash32,
  mulberry32,
  shouldRaiseAlert,
  updateStopState,
} from "./detection";
import { buildAlertPayload } from "./alert-format";
import {
  CENTER_LAT,
  CENTER_LON,
  CENTER_ZIP,
  DEFAULT_RADIUS_MILES,
  googleMapsUrl,
  haversineMiles,
  inRadius,
} from "./geo";
import type {
  Alert,
  AlertDelivery,
  AlertPayload,
  AppSettings,
  Camera,
  CameraSource,
  CameraStatus,
  FeedType,
  OpsSnapshot,
  TrackedVehicle,
  VehicleClass,
} from "./types";

const CLASSES: VehicleClass[] = ["car", "car", "car", "car", "truck", "bus", "motorcycle"];

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function mapCamera(row: Record<string, unknown>, centerLat: number, centerLon: number): Camera {
  const lat = asNum(row.lat);
  const lon = asNum(row.lon);
  return {
    id: asStr(row.id),
    name: asStr(row.name),
    highway: asStr(row.highway),
    direction: asStr(row.direction),
    mileMarker: asStr(row.mile_marker),
    lat,
    lon,
    streamUrl: asNullStr(row.stream_url),
    snapshotUrl: asNullStr(row.snapshot_url),
    feedType: asStr(row.feed_type, "simulated") as FeedType,
    source: asStr(row.source, "manual") as CameraSource,
    enabled: asBool(row.enabled),
    status: asStr(row.status, "unknown") as CameraStatus,
    lastHealthAt: row.last_health_at ? iso(row.last_health_at) : null,
    lastFrameAt: row.last_frame_at ? iso(row.last_frame_at) : null,
    notes: asNullStr(row.notes),
    milesFromCenter: haversineMiles({ lat, lon }, { lat: centerLat, lon: centerLon }),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapSettings(row: Record<string, unknown>): AppSettings {
  return {
    id: asStr(row.id, "default"),
    radiusMiles: asNum(row.radius_miles, DEFAULT_RADIUS_MILES),
    centerZip: asStr(row.center_zip, CENTER_ZIP),
    centerLat: asNum(row.center_lat, CENTER_LAT),
    centerLon: asNum(row.center_lon, CENTER_LON),
    stoppedThresholdSeconds: asNum(row.stopped_threshold_seconds, 120),
    pixelThreshold: asNum(row.pixel_threshold, 0.018),
    detectionFps: asNum(row.detection_fps, 3),
    windowSeconds: asNum(row.window_seconds, 8),
    cooldownSeconds: asNum(row.cooldown_seconds, 180),
    simulatorEnabled: asBool(row.simulator_enabled),
    simulatorSpeed: asNum(row.simulator_speed, 10),
    alertEmailEnabled: asBool(row.alert_email_enabled),
    alertSmsEnabled: asBool(row.alert_sms_enabled),
    alertWebhookEnabled: asBool(row.alert_webhook_enabled),
    alertSlackEnabled: asBool(row.alert_slack_enabled),
    alertDiscordEnabled: asBool(row.alert_discord_enabled),
    webhookUrl: asNullStr(row.webhook_url),
    slackWebhookUrl: asNullStr(row.slack_webhook_url),
    discordWebhookUrl: asNullStr(row.discord_webhook_url),
    updatedAt: iso(row.updated_at),
  };
}

function mapVehicle(row: Record<string, unknown>): TrackedVehicle {
  let positions: TrackedVehicle["positions"] = [];
  try {
    positions = JSON.parse(asStr(row.positions_json, "[]")) as TrackedVehicle["positions"];
  } catch {
    positions = [];
  }
  return {
    id: asStr(row.id),
    cameraId: asStr(row.camera_id),
    trackId: asNum(row.track_id),
    vehicleClass: asStr(row.vehicle_class, "car") as VehicleClass,
    confidence: asNum(row.confidence, 0.8),
    x: asNum(row.x),
    y: asNum(row.y),
    vx: asNum(row.vx),
    vy: asNum(row.vy),
    lane: asNum(row.lane),
    firstSeenAt: new Date(iso(row.first_seen_at)).getTime(),
    lastSeenAt: new Date(iso(row.last_seen_at)).getTime(),
    firstStoppedAt: row.first_stopped_at ? new Date(iso(row.first_stopped_at)).getTime() : null,
    stoppedDurationSec: asNum(row.stopped_duration_sec),
    isStopped: asBool(row.is_stopped),
    isActive: asBool(row.is_active),
    positions,
  };
}

function mapAlert(row: Record<string, unknown>): Alert {
  let payload: AlertPayload;
  try {
    payload = JSON.parse(asStr(row.payload_json, "{}")) as AlertPayload;
  } catch {
    payload = {
      alert_id: asStr(row.id),
      camera_id: asStr(row.camera_id),
      camera_name: asStr(row.camera_name),
      highway: asStr(row.highway),
      direction: asStr(row.direction),
      mile_marker: asStr(row.mile_marker),
      lat: asNum(row.lat),
      lon: asNum(row.lon),
      map_link: asStr(row.map_url),
      timestamp: iso(row.started_at),
      duration_stopped_seconds: asNum(row.duration_sec),
      duration_stopped_human: `${Math.round(asNum(row.duration_sec))}s`,
      snapshot_url: asNullStr(row.snapshot_url),
      clip_url: null,
      confidence: asNum(row.confidence),
      status: asStr(row.status, "active") as Alert["status"],
      vehicle_class: "car",
      track_id: asStr(row.track_id),
    };
  }
  return {
    id: asStr(row.id),
    cameraId: asStr(row.camera_id),
    eventId: asNullStr(row.event_id),
    trackId: asStr(row.track_id),
    status: asStr(row.status, "active") as Alert["status"],
    cameraName: asStr(row.camera_name),
    highway: asStr(row.highway),
    direction: asStr(row.direction),
    mileMarker: asStr(row.mile_marker),
    lat: asNum(row.lat),
    lon: asNum(row.lon),
    mapUrl: asStr(row.map_url),
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
    durationSec: asNum(row.duration_sec),
    confidence: asNum(row.confidence),
    snapshotUrl: asNullStr(row.snapshot_url),
    payload,
  };
}

async function insertCamera(cam: CatalogCamera & { milesFromCenter?: number }) {
  const sql = await getSql();
  await sql`
    insert into cameras (
      id, name, highway, direction, mile_marker, lat, lon,
      stream_url, snapshot_url, feed_type, source, enabled, status, notes
    ) values (
      ${cam.id}, ${cam.name}, ${cam.highway}, ${cam.direction}, ${cam.mileMarker},
      ${cam.lat}, ${cam.lon}, ${cam.streamUrl ?? null}, ${cam.snapshotUrl ?? null},
      ${cam.feedType ?? "simulated"}, ${cam.source ?? "gateway-guide"}, true, 'online',
      ${cam.notes ?? null}
    )
    on conflict (id) do update set
      stream_url = coalesce(excluded.stream_url, cameras.stream_url),
      snapshot_url = coalesce(excluded.snapshot_url, cameras.snapshot_url),
      feed_type = case
        when excluded.feed_type in ('hls', 'snapshot', 'mjpeg') then excluded.feed_type
        else cameras.feed_type
      end,
      notes = coalesce(excluded.notes, cameras.notes),
      updated_at = now()
  `;
}

export async function ensureSeeded(): Promise<AppSettings> {
  const sql = await getSql();
  const existing = await sql`select * from app_settings where id = 'default'`;
  if (existing.length === 0) {
    await sql`insert into app_settings (id) values ('default')`;
  }
  const settingsRows = await sql`select * from app_settings where id = 'default'`;
  const settings = mapSettings(settingsRows[0] as Record<string, unknown>);

  const countRows = await sql`select count(*)::int as n from cameras`;
  const n = asNum((countRows[0] as { n: number }).n);
  if (n === 0) {
    const cams = catalogInRadius(settings.radiusMiles, {
      lat: settings.centerLat,
      lon: settings.centerLon,
    });
    for (const cam of cams) await insertCamera(cam);
  }
  const liveRows = await sql`select count(*)::int as n from cameras where feed_type in ('hls', 'snapshot')`;
  const live = asNum((liveRows[0] as { n: number }).n);
  if (live === 0) {
    await ingestPublicCameras(settings);
  }
  return settings;
}

async function ingestPublicCameras(settings: AppSettings) {
  const cams = await fetchPublicCameras(
    { lat: settings.centerLat, lon: settings.centerLon },
    settings.radiusMiles,
  );
  for (const cam of cams) await insertCamera(cam);
  return cams.length;
}

export async function getSettings(): Promise<AppSettings> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql`select * from app_settings where id = 'default'`;
  return mapSettings(rows[0] as Record<string, unknown>);
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const sql = await getSql();
  await sql`
    update app_settings set
      radius_miles = ${next.radiusMiles},
      center_zip = ${next.centerZip},
      center_lat = ${next.centerLat},
      center_lon = ${next.centerLon},
      stopped_threshold_seconds = ${next.stoppedThresholdSeconds},
      pixel_threshold = ${next.pixelThreshold},
      detection_fps = ${next.detectionFps},
      window_seconds = ${next.windowSeconds},
      cooldown_seconds = ${next.cooldownSeconds},
      simulator_enabled = ${next.simulatorEnabled},
      simulator_speed = ${next.simulatorSpeed},
      alert_email_enabled = ${next.alertEmailEnabled},
      alert_sms_enabled = ${next.alertSmsEnabled},
      alert_webhook_enabled = ${next.alertWebhookEnabled},
      alert_slack_enabled = ${next.alertSlackEnabled},
      alert_discord_enabled = ${next.alertDiscordEnabled},
      webhook_url = ${next.webhookUrl},
      slack_webhook_url = ${next.slackWebhookUrl},
      discord_webhook_url = ${next.discordWebhookUrl},
      updated_at = now()
    where id = 'default'
  `;
  return getSettings();
}

function cameraHealth(id: string, now: number): CameraStatus {
  const h = hash32(`${id}:${Math.floor(now / 3_600_000)}`);
  const r = (h % 1000) / 1000;
  if (r < 0.06) return "offline";
  if (r < 0.12) return "degraded";
  return "online";
}

function spawnVehicle(cameraId: string, now: number, rng: () => number, nextTrack: number): TrackedVehicle {
  const lane = Math.floor(rng() * 4);
  const cls = CLASSES[Math.floor(rng() * CLASSES.length)] ?? "car";
  const depth = rng() * 0.15;
  const speed = 0.08 + rng() * 0.12;
  return {
    id: uid("trk"),
    cameraId,
    trackId: nextTrack,
    vehicleClass: cls,
    confidence: 0.78 + rng() * 0.2,
    x: lane,
    y: depth,
    vx: 0,
    vy: speed,
    lane,
    firstSeenAt: now,
    lastSeenAt: now,
    firstStoppedAt: null,
    stoppedDurationSec: 0,
    isStopped: false,
    isActive: true,
    positions: [{ t: now, x: lane, y: depth }],
  };
}

async function persistVehicle(v: TrackedVehicle) {
  const sql = await getSql();
  const firstStopped = v.firstStoppedAt ? new Date(v.firstStoppedAt).toISOString() : null;
  await sql`
    insert into tracked_vehicles (
      id, camera_id, track_id, vehicle_class, confidence, x, y, vx, vy, lane,
      first_seen_at, last_seen_at, first_stopped_at, stopped_duration_sec,
      is_stopped, is_active, positions_json
    ) values (
      ${v.id}, ${v.cameraId}, ${v.trackId}, ${v.vehicleClass}, ${v.confidence},
      ${v.x}, ${v.y}, ${v.vx}, ${v.vy}, ${v.lane},
      ${new Date(v.firstSeenAt).toISOString()},
      ${new Date(v.lastSeenAt).toISOString()},
      ${firstStopped},
      ${v.stoppedDurationSec}, ${v.isStopped}, ${v.isActive},
      ${JSON.stringify(v.positions)}
    )
    on conflict (id) do update set
      x = excluded.x,
      y = excluded.y,
      vx = excluded.vx,
      vy = excluded.vy,
      last_seen_at = excluded.last_seen_at,
      first_stopped_at = excluded.first_stopped_at,
      stopped_duration_sec = excluded.stopped_duration_sec,
      is_stopped = excluded.is_stopped,
      is_active = excluded.is_active,
      positions_json = excluded.positions_json
  `;
}

async function deliverAlert(alert: Alert, settings: AppSettings, kind: "new" | "update" | "resolve") {
  const sql = await getSql();
  const channels: { channel: AlertDelivery["channel"]; enabled: boolean; url: string | null }[] = [
    { channel: "dashboard", enabled: true, url: null },
    { channel: "email", enabled: settings.alertEmailEnabled, url: null },
    { channel: "sms", enabled: settings.alertSmsEnabled, url: null },
    { channel: "webhook", enabled: settings.alertWebhookEnabled, url: settings.webhookUrl },
    { channel: "slack", enabled: settings.alertSlackEnabled, url: settings.slackWebhookUrl },
    { channel: "discord", enabled: settings.alertDiscordEnabled, url: settings.discordWebhookUrl },
  ];

  for (const ch of channels) {
    if (!ch.enabled) continue;
    if (kind !== "new" && ch.channel === "dashboard") continue;
    let status: AlertDelivery["status"] = "simulated";
    let detail = `${kind} · ${alert.payload.duration_stopped_human}`;
    if (ch.url && (ch.channel === "webhook" || ch.channel === "slack" || ch.channel === "discord")) {
      try {
        const res = await fetch(ch.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(alert.payload),
          signal: AbortSignal.timeout(2500),
        });
        status = res.ok ? "sent" : "failed";
        detail = `HTTP ${res.status}`;
      } catch (err) {
        status = "failed";
        detail = err instanceof Error ? err.message : "delivery failed";
      }
    } else if (ch.channel === "dashboard") {
      status = "sent";
      detail = "in-app notification";
    }
    await sql`
      insert into alert_deliveries (alert_id, channel, status, detail)
      values (${alert.id}, ${ch.channel}, ${status}, ${detail})
    `;
  }
}

async function upsertAlert(camera: Camera, track: TrackedVehicle, settings: AppSettings, now: number) {
  const sql = await getSql();
  const existing = await sql`
    select * from alerts
    where camera_id = ${camera.id} and track_id = ${track.id} and status = 'active'
    limit 1
  `;
  const ts = new Date(now).toISOString();
  if (existing.length === 0) {
    const cooldownRows = await sql`
      select cooldown_until from alerts
      where camera_id = ${camera.id} and track_id = ${track.id}
      order by updated_at desc limit 1
    `;
    const cooldownUntil = cooldownRows[0]?.cooldown_until
      ? new Date(iso(cooldownRows[0].cooldown_until)).getTime()
      : null;
    if (cooldownUntil && now < cooldownUntil) return;

    const id = uid("alrt");
    const eventId = uid("evt");
    const payload = buildAlertPayload({
      alertId: id,
      camera,
      track,
      status: "active",
      timestamp: ts,
      snapshotUrl: `sim://${camera.id}/${Math.round(track.stoppedDurationSec)}`,
    });
    await sql`
      insert into alerts (
        id, camera_id, event_id, track_id, status, camera_name, highway, direction,
        mile_marker, lat, lon, map_url, started_at, updated_at, duration_sec,
        confidence, snapshot_url, payload_json
      ) values (
        ${id}, ${camera.id}, ${eventId}, ${track.id}, 'active', ${camera.name},
        ${camera.highway}, ${camera.direction}, ${camera.mileMarker}, ${camera.lat},
        ${camera.lon}, ${googleMapsUrl(camera.lat, camera.lon)}, ${ts}, ${ts},
        ${track.stoppedDurationSec}, ${track.confidence}, ${payload.snapshot_url},
        ${JSON.stringify(payload)}
      )
    `;
    await sql`
      insert into stopped_events (
        id, camera_id, track_id, started_at, duration_sec, max_duration_sec,
        lat, lon, confidence, snapshot_path
      ) values (
        ${eventId}, ${camera.id}, ${track.id}, ${ts}, ${track.stoppedDurationSec},
        ${track.stoppedDurationSec}, ${camera.lat}, ${camera.lon}, ${track.confidence},
        ${payload.snapshot_url}
      )
    `;
    const alert = mapAlert(
      (
        await sql`select * from alerts where id = ${id}`
      )[0] as Record<string, unknown>,
    );
    await deliverAlert(alert, settings, "new");
    return;
  }

  const row = existing[0] as Record<string, unknown>;
  const payload = buildAlertPayload({
    alertId: asStr(row.id),
    camera,
    track,
    status: "active",
    timestamp: iso(row.started_at),
    snapshotUrl: asNullStr(row.snapshot_url),
  });
  await sql`
    update alerts set
      duration_sec = ${track.stoppedDurationSec},
      confidence = ${track.confidence},
      updated_at = ${ts},
      payload_json = ${JSON.stringify(payload)}
    where id = ${asStr(row.id)}
  `;
  if (row.event_id) {
    await sql`
      update stopped_events set
        duration_sec = ${track.stoppedDurationSec},
        max_duration_sec = greatest(max_duration_sec, ${track.stoppedDurationSec})
      where id = ${asStr(row.event_id)}
    `;
  }
}

async function resolveAlert(trackId: string, settings: AppSettings, now: number) {
  const sql = await getSql();
  const rows = await sql`
    select * from alerts where track_id = ${trackId} and status = 'active'
  `;
  const ts = new Date(now).toISOString();
  const cooldown = new Date(now + settings.cooldownSeconds * 1000).toISOString();
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    let payload: AlertPayload;
    try {
      payload = JSON.parse(asStr(row.payload_json, "{}")) as AlertPayload;
    } catch {
      continue;
    }
    payload = { ...payload, status: "resolved", timestamp: ts };
    await sql`
      update alerts set
        status = 'resolved',
        resolved_at = ${ts},
        updated_at = ${ts},
        cooldown_until = ${cooldown},
        payload_json = ${JSON.stringify(payload)}
      where id = ${asStr(row.id)}
    `;
    if (row.event_id) {
      await sql`
        update stopped_events set ended_at = ${ts}, duration_sec = ${asNum(row.duration_sec)}
        where id = ${asStr(row.event_id)}
      `;
    }
    const alert = mapAlert({ ...row, status: "resolved", resolved_at: ts, payload_json: JSON.stringify(payload) });
    await deliverAlert(alert, settings, "resolve");
  }
}

export async function tickSimulator(): Promise<void> {
  const settings = await ensureSeeded();
  if (!settings.simulatorEnabled) return;
  const sql = await getSql();
  const now = Date.now();
  const tickRows = await sql`select last_tick_ms from app_settings where id = 'default'`;
  const lastTick = asNum((tickRows[0] as { last_tick_ms: number | null }).last_tick_ms, now - 2000);
  const wallDt = Math.min(8, Math.max(0.4, (now - lastTick) / 1000));
  const dt = wallDt * settings.simulatorSpeed;
  await sql`update app_settings set last_tick_ms = ${now} where id = 'default'`;

  const camRows = await sql`select * from cameras where enabled = true`;
  const cameras = camRows.map((r) =>
    mapCamera(r as Record<string, unknown>, settings.centerLat, settings.centerLon),
  );
  const inScope = cameras.filter((c) =>
    inRadius(c, { lat: settings.centerLat, lon: settings.centerLon }, settings.radiusMiles),
  );

  const vehRows = await sql`select * from tracked_vehicles where is_active = true`;
  const byCam = new Map<string, TrackedVehicle[]>();
  for (const row of vehRows) {
    const v = mapVehicle(row as Record<string, unknown>);
    const list = byCam.get(v.cameraId) ?? [];
    list.push(v);
    byCam.set(v.cameraId, list);
  }

  for (const cam of inScope) {
    const status = cameraHealth(cam.id, now);
    await sql`
      update cameras set status = ${status}, last_health_at = now(),
        last_frame_at = ${status === "offline" ? cam.lastFrameAt : new Date(now).toISOString()},
        updated_at = now()
      where id = ${cam.id}
    `;
    await sql`
      insert into camera_health (camera_id, ok, latency_ms, error)
      values (
        ${cam.id},
        ${status !== "offline"},
        ${40 + (hash32(cam.id) % 80)},
        ${status === "offline" ? "feed timeout" : null}
      )
    `;
    if (status === "offline") continue;

    const rng = mulberry32(hash32(`${cam.id}:${Math.floor(now / 250)}`));
    let vehicles = byCam.get(cam.id) ?? [];
    const maxTracks = 7;
    if (vehicles.length < 3 + Math.floor(rng() * 3) && vehicles.length < maxTracks) {
      const nextId = vehicles.reduce((m, v) => Math.max(m, v.trackId), 0) + 1;
      vehicles.push(spawnVehicle(cam.id, now, rng, nextId));
    }

    const kept: TrackedVehicle[] = [];
    for (const v of vehicles) {
      let next = { ...v };
      const stopRoll = rng();
      const already = next.isStopped;
      const shouldStop = already
        ? stopRoll > 0.04
        : next.y > 0.35 && next.y < 0.78 && stopRoll < 0.012;
      if (shouldStop) {
        next.vy = 0;
        next.vx = 0;
      } else {
        next.vy = next.vy > 0.02 ? next.vy : 0.09 + rng() * 0.08;
        next.y += next.vy * (dt / 8);
      }
      next.x = next.lane;
      next.positions = appendPosition(next.positions, { t: now, x: next.x, y: next.y });
      next = updateStopState(
        next,
        now,
        { pixelThreshold: settings.pixelThreshold, windowMs: settings.windowSeconds * 1000 },
        settings.simulatorSpeed,
      );
      if (next.y > 1.08) {
        next.isActive = false;
        await persistVehicle(next);
        if (already) await resolveAlert(next.id, settings, now);
        continue;
      }
      await persistVehicle(next);
      if (shouldRaiseAlert(next, settings.stoppedThresholdSeconds)) {
        await upsertAlert(cam, next, settings, now);
      } else if (already && !next.isStopped) {
        await resolveAlert(next.id, settings, now);
      }
      kept.push(next);
    }

    const stopped = kept.filter((v) => v.isStopped).length;
    await sql`
      insert into detections (camera_id, box_json, vehicle_count, stopped_count)
      values (
        ${cam.id},
        ${JSON.stringify(
          kept.map((v) => ({
            trackId: v.trackId,
            class: v.vehicleClass,
            conf: v.confidence,
            x: v.x,
            y: v.y,
            stopped: v.isStopped,
          })),
        )},
        ${kept.length},
        ${stopped}
      )
    `;
  }

  await sql`delete from detections where frame_ts < now() - interval '20 minutes'`;
  await sql`delete from camera_health where checked_at < now() - interval '20 minutes'`;
  await sql`delete from tracked_vehicles where is_active = false and last_seen_at < now() - interval '30 minutes'`;
}

export async function injectStoppedScenario(cameraId?: string): Promise<{ cameraId: string; trackId: string }> {
  const settings = await ensureSeeded();
  const sql = await getSql();
  const cams = (
    await sql`select * from cameras where enabled = true`
  ).map((r) => mapCamera(r as Record<string, unknown>, settings.centerLat, settings.centerLon));
  const scoped = cams.filter((c) =>
    inRadius(c, { lat: settings.centerLat, lon: settings.centerLon }, settings.radiusMiles),
  );
  const cam =
    scoped.find((c) => c.id === cameraId) ??
    scoped.find((c) => c.id === "modot-i270-mo367") ??
    scoped[0];
  if (!cam) throw new Error("No cameras in radius");

  const now = Date.now();
  const speed = Math.max(1, settings.simulatorSpeed);
  const already = Math.max(5, settings.stoppedThresholdSeconds - 8);
  const firstStoppedAt = now - (already / speed) * 1000;
  const existing = await sql`
    select coalesce(max(track_id), 0)::int as n from tracked_vehicles where camera_id = ${cam.id}
  `;
  const trackNum = asNum((existing[0] as { n: number }).n) + 1;
  const vehicle: TrackedVehicle = {
    id: uid("trk"),
    cameraId: cam.id,
    trackId: trackNum,
    vehicleClass: "truck",
    confidence: 0.94,
    x: 1,
    y: 0.58,
    vx: 0,
    vy: 0,
    lane: 1,
    firstSeenAt: firstStoppedAt - 20_000,
    lastSeenAt: now,
    firstStoppedAt,
    stoppedDurationSec: already,
    isStopped: true,
    isActive: true,
    positions: [
      { t: firstStoppedAt - 8000, x: 1, y: 0.58 },
      { t: firstStoppedAt - 4000, x: 1, y: 0.581 },
      { t: now, x: 1, y: 0.58 },
    ],
  };
  await persistVehicle(vehicle);
  await sql`update cameras set status = 'online', last_frame_at = now() where id = ${cam.id}`;
  await upsertAlert(cam, vehicle, settings, now);
  return { cameraId: cam.id, trackId: vehicle.id };
}

export async function listCameras(): Promise<Camera[]> {
  const settings = await ensureSeeded();
  const sql = await getSql();
  const rows = await sql`select * from cameras order by highway, mile_marker`;
  return rows
    .map((r) => mapCamera(r as Record<string, unknown>, settings.centerLat, settings.centerLon))
    .filter((c) => inRadius(c, { lat: settings.centerLat, lon: settings.centerLon }, settings.radiusMiles + 0.5));
}

export async function getCamera(id: string): Promise<Camera | null> {
  const settings = await getSettings();
  const sql = await getSql();
  const rows = await sql`select * from cameras where id = ${id}`;
  if (!rows[0]) return null;
  return mapCamera(rows[0] as Record<string, unknown>, settings.centerLat, settings.centerLon);
}

export async function createCamera(input: {
  name: string;
  highway: string;
  direction: string;
  mileMarker: string;
  lat: number;
  lon: number;
  streamUrl?: string | null;
  snapshotUrl?: string | null;
  feedType?: FeedType;
  notes?: string | null;
}): Promise<Camera> {
  const settings = await getSettings();
  const id = uid("cam");
  await insertCamera({
    id,
    name: input.name,
    highway: input.highway,
    direction: input.direction,
    mileMarker: input.mileMarker,
    lat: input.lat,
    lon: input.lon,
    streamUrl: input.streamUrl ?? null,
    snapshotUrl: input.snapshotUrl ?? null,
    feedType: input.feedType ?? "simulated",
    source: "manual",
    notes: input.notes ?? "Manually added",
  });
  const cam = await getCamera(id);
  if (!cam) throw new Error("Failed to create camera");
  void settings;
  return cam;
}

export async function updateCamera(input: {
  id: string;
  name?: string;
  enabled?: boolean;
  notes?: string | null;
  streamUrl?: string | null;
  snapshotUrl?: string | null;
}): Promise<Camera | null> {
  const current = await getCamera(input.id);
  if (!current) return null;
  const sql = await getSql();
  await sql`
    update cameras set
      name = ${input.name ?? current.name},
      enabled = ${input.enabled ?? current.enabled},
      notes = ${input.notes === undefined ? current.notes : input.notes},
      stream_url = ${input.streamUrl === undefined ? current.streamUrl : input.streamUrl},
      snapshot_url = ${input.snapshotUrl === undefined ? current.snapshotUrl : input.snapshotUrl},
      updated_at = now()
    where id = ${input.id}
  `;
  return getCamera(input.id);
}

export async function deleteCamera(id: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql`select id from cameras where id = ${id}`;
  if (!rows[0]) return false;
  await sql`delete from cameras where id = ${id}`;
  return true;
}

export async function rediscoverCameras(): Promise<{ added: number; total: number }> {
  const settings = await getSettings();
  const sql = await getSql();
  const before = asNum(((await sql`select count(*)::int as n from cameras`)[0] as { n: number }).n);
  await ingestPublicCameras(settings);
  const cams = catalogInRadius(settings.radiusMiles, {
    lat: settings.centerLat,
    lon: settings.centerLon,
  });
  for (const cam of cams) await insertCamera(cam);

  try {
    const url =
      "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query?where=1%3D1&geometry=%7B%22xmin%22%3A-90.65%2C%22ymin%22%3A38.38%2C%22xmax%22%3A-89.78%2C%22ymax%22%3A39.05%2C%22spatialReference%22%3A%7B%22wkid%22%3A4326%7D%7D&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=CameraLocation,CameraDirection,SnapShot,ImgPath&returnGeometry=true&outSR=4326&f=json&resultRecordCount=40";
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as {
        features?: {
          attributes?: Record<string, string>;
          geometry?: { x: number; y: number };
        }[];
      };
      for (const f of data.features ?? []) {
        const lat = f.geometry?.y;
        const lon = f.geometry?.x;
        if (lat == null || lon == null) continue;
        if (!inRadius({ lat, lon }, { lat: settings.centerLat, lon: settings.centerLon }, settings.radiusMiles)) {
          continue;
        }
        const name = f.attributes?.CameraLocation ?? "Illinois camera";
        const dir = f.attributes?.CameraDirection ?? "UNK";
        const snap = f.attributes?.SnapShot ?? null;
        const id = `idot-${Math.abs(hash32(`${name}:${lat}:${lon}`)).toString(36)}`;
        await insertCamera({
          id,
          name: `${name}`,
          highway: inferHighway(name),
          direction: dir,
          mileMarker: "",
          lat,
          lon,
          snapshotUrl: snap,
          feedType: snap ? "snapshot" : "simulated",
          source: "travelmidwest",
          notes: "Discovered from Illinois Gateway / TravelMidwest public layer.",
        });
      }
    }
  } catch {
    // Public layer is best-effort; catalog seed still covers the radius.
  }

  const after = asNum(((await sql`select count(*)::int as n from cameras`)[0] as { n: number }).n);
  return { added: Math.max(0, after - before), total: after };
}

function inferHighway(name: string): string {
  const m = name.match(/\b(I-\d+|IL-\d+|US-\d+|MO-\d+)\b/i);
  return m?.[1]?.toUpperCase() ?? "IL";
}

export async function getSnapshot(): Promise<OpsSnapshot> {
  const settings = await ensureSeeded();
  const sql = await getSql();
  const camRows = await sql`select * from cameras order by highway, name`;
  const cameras = camRows
    .map((r) => mapCamera(r as Record<string, unknown>, settings.centerLat, settings.centerLon))
    .filter((c) => inRadius(c, { lat: settings.centerLat, lon: settings.centerLon }, settings.radiusMiles + 0.5));

  const vehRows = await sql`select * from tracked_vehicles where is_active = true`;
  const vehicles = vehRows.map((r) => mapVehicle(r as Record<string, unknown>));

  const activeRows = await sql`select * from alerts where status = 'active' order by duration_sec desc`;
  const recentRows = await sql`select * from alerts order by updated_at desc limit 40`;
  const activeAlerts = activeRows.map((r) => mapAlert(r as Record<string, unknown>));
  const recentAlerts = recentRows.map((r) => mapAlert(r as Record<string, unknown>));

  const delivRows = await sql`
    select * from alert_deliveries order by sent_at desc limit 30
  `;
  const deliveries: AlertDelivery[] = delivRows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: asNum(row.id),
      alertId: asStr(row.alert_id),
      channel: asStr(row.channel) as AlertDelivery["channel"],
      status: asStr(row.status) as AlertDelivery["status"],
      sentAt: iso(row.sent_at),
      detail: asNullStr(row.detail),
    };
  });

  const todayRows = await sql`
    select count(*)::int as n from alerts where started_at >= current_date
  `;
  const online = cameras.filter((c) => c.status === "online" && c.enabled).length;
  const offline = cameras.filter((c) => c.status === "offline").length;

  return {
    settings,
    cameras,
    vehicles,
    activeAlerts,
    recentAlerts,
    deliveries,
    stats: {
      camerasTotal: cameras.length,
      camerasOnline: online,
      camerasOffline: offline,
      activeAlerts: activeAlerts.length,
      stoppedNow: vehicles.filter((v) => v.isStopped).length,
      vehiclesTracked: vehicles.length,
      alertsToday: asNum((todayRows[0] as { n: number }).n),
    },
    serverTime: new Date().toISOString(),
  };
}

export async function healthPayload() {
  const settings = await ensureSeeded();
  const snap = await getSnapshot();
  return {
    ok: true,
    service: "StoppedVehicleAlert",
    center: { zip: settings.centerZip, lat: settings.centerLat, lon: settings.centerLon },
    radiusMiles: settings.radiusMiles,
    cameras: snap.stats.camerasTotal,
    online: snap.stats.camerasOnline,
    activeAlerts: snap.stats.activeAlerts,
    simulator: settings.simulatorEnabled,
    time: new Date().toISOString(),
  };
}
