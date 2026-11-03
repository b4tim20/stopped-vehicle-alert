export type FeedType = "hls" | "mjpeg" | "rtsp" | "snapshot" | "simulated";
export type CameraSource =
  | "gateway-guide"
  | "travelmidwest"
  | "opencctv"
  | "manual";
export type CameraStatus = "online" | "offline" | "degraded" | "unknown";
export type VehicleClass = "car" | "truck" | "bus" | "motorcycle";
export type AlertStatus = "active" | "resolved" | "suppressed";
export type AlertChannel =
  | "dashboard"
  | "email"
  | "sms"
  | "webhook"
  | "slack"
  | "discord";

export type Camera = {
  id: string;
  name: string;
  highway: string;
  direction: string;
  mileMarker: string;
  lat: number;
  lon: number;
  streamUrl: string | null;
  snapshotUrl: string | null;
  feedType: FeedType;
  source: CameraSource;
  enabled: boolean;
  status: CameraStatus;
  lastHealthAt: string | null;
  lastFrameAt: string | null;
  notes: string | null;
  milesFromCenter: number;
  createdAt: string;
  updatedAt: string;
};

export type TrackedVehicle = {
  id: string;
  cameraId: string;
  trackId: number;
  vehicleClass: VehicleClass;
  confidence: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lane: number;
  firstSeenAt: number;
  lastSeenAt: number;
  firstStoppedAt: number | null;
  stoppedDurationSec: number;
  isStopped: boolean;
  isActive: boolean;
  positions: TrackPosition[];
};

export type TrackPosition = {
  t: number;
  x: number;
  y: number;
};

export type Alert = {
  id: string;
  cameraId: string;
  eventId: string | null;
  trackId: string;
  status: AlertStatus;
  cameraName: string;
  highway: string;
  direction: string;
  mileMarker: string;
  lat: number;
  lon: number;
  mapUrl: string;
  startedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  durationSec: number;
  confidence: number;
  snapshotUrl: string | null;
  payload: AlertPayload;
};

export type AlertPayload = {
  alert_id: string;
  camera_id: string;
  camera_name: string;
  highway: string;
  direction: string;
  mile_marker: string;
  lat: number;
  lon: number;
  map_link: string;
  timestamp: string;
  duration_stopped_seconds: number;
  duration_stopped_human: string;
  snapshot_url: string | null;
  clip_url: string | null;
  confidence: number;
  status: AlertStatus;
  vehicle_class: VehicleClass;
  track_id: string;
};

export type AlertDelivery = {
  id: number;
  alertId: string;
  channel: AlertChannel;
  status: "sent" | "failed" | "queued" | "simulated";
  sentAt: string;
  detail: string | null;
};

export type AppSettings = {
  id: string;
  radiusMiles: number;
  centerZip: string;
  centerLat: number;
  centerLon: number;
  stoppedThresholdSeconds: number;
  pixelThreshold: number;
  detectionFps: number;
  windowSeconds: number;
  cooldownSeconds: number;
  simulatorEnabled: boolean;
  simulatorSpeed: number;
  alertEmailEnabled: boolean;
  alertSmsEnabled: boolean;
  alertWebhookEnabled: boolean;
  alertSlackEnabled: boolean;
  alertDiscordEnabled: boolean;
  webhookUrl: string | null;
  slackWebhookUrl: string | null;
  discordWebhookUrl: string | null;
  updatedAt: string;
};

export type OpsSnapshot = {
  settings: AppSettings;
  cameras: Camera[];
  vehicles: TrackedVehicle[];
  activeAlerts: Alert[];
  recentAlerts: Alert[];
  deliveries: AlertDelivery[];
  stats: OpsStats;
  serverTime: string;
};

export type OpsStats = {
  camerasTotal: number;
  camerasOnline: number;
  camerasOffline: number;
  activeAlerts: number;
  stoppedNow: number;
  vehiclesTracked: number;
  alertsToday: number;
};
