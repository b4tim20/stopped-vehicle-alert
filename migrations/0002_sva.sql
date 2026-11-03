create table if not exists cameras (
  id text primary key,
  name text not null,
  highway text not null,
  direction text not null,
  mile_marker text not null default '',
  lat double precision not null,
  lon double precision not null,
  stream_url text,
  snapshot_url text,
  feed_type text not null default 'simulated',
  source text not null default 'manual',
  enabled boolean not null default true,
  status text not null default 'unknown',
  last_health_at timestamptz,
  last_frame_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cameras_highway_idx on cameras (highway);
create index if not exists cameras_status_idx on cameras (status);

create table if not exists camera_health (
  id serial primary key,
  camera_id text not null references cameras(id) on delete cascade,
  checked_at timestamptz not null default now(),
  ok boolean not null,
  latency_ms integer,
  error text
);

create index if not exists camera_health_camera_idx on camera_health (camera_id, checked_at desc);

create table if not exists tracked_vehicles (
  id text primary key,
  camera_id text not null references cameras(id) on delete cascade,
  track_id integer not null,
  vehicle_class text not null,
  confidence double precision not null,
  x double precision not null,
  y double precision not null,
  vx double precision not null default 0,
  vy double precision not null default 0,
  lane integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_stopped_at timestamptz,
  stopped_duration_sec double precision not null default 0,
  is_stopped boolean not null default false,
  is_active boolean not null default true,
  positions_json text not null default '[]'
);

create index if not exists tracked_vehicles_camera_idx on tracked_vehicles (camera_id, is_active);

create table if not exists stopped_events (
  id text primary key,
  camera_id text not null references cameras(id) on delete cascade,
  track_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec double precision not null default 0,
  max_duration_sec double precision not null default 0,
  lat double precision,
  lon double precision,
  confidence double precision,
  snapshot_path text
);

create table if not exists alerts (
  id text primary key,
  camera_id text not null references cameras(id) on delete cascade,
  event_id text,
  track_id text not null,
  status text not null,
  camera_name text not null,
  highway text not null,
  direction text not null,
  mile_marker text not null default '',
  lat double precision not null,
  lon double precision not null,
  map_url text not null,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  duration_sec double precision not null default 0,
  confidence double precision not null default 0,
  snapshot_url text,
  payload_json text not null,
  cooldown_until timestamptz
);

create index if not exists alerts_status_idx on alerts (status, updated_at desc);
create index if not exists alerts_camera_idx on alerts (camera_id, started_at desc);

create table if not exists alert_deliveries (
  id serial primary key,
  alert_id text not null references alerts(id) on delete cascade,
  channel text not null,
  status text not null,
  sent_at timestamptz not null default now(),
  detail text
);

create table if not exists detections (
  id serial primary key,
  camera_id text not null references cameras(id) on delete cascade,
  frame_ts timestamptz not null default now(),
  box_json text not null default '[]',
  vehicle_count integer not null default 0,
  stopped_count integer not null default 0
);

create table if not exists app_settings (
  id text primary key default 'default',
  radius_miles double precision not null default 25,
  center_zip text not null default '63137',
  center_lat double precision not null default 38.7465,
  center_lon double precision not null default -90.2189,
  stopped_threshold_seconds integer not null default 120,
  pixel_threshold double precision not null default 0.018,
  detection_fps integer not null default 3,
  window_seconds integer not null default 8,
  cooldown_seconds integer not null default 180,
  simulator_enabled boolean not null default true,
  simulator_speed double precision not null default 10,
  alert_email_enabled boolean not null default false,
  alert_sms_enabled boolean not null default false,
  alert_webhook_enabled boolean not null default false,
  alert_slack_enabled boolean not null default false,
  alert_discord_enabled boolean not null default false,
  webhook_url text,
  slack_webhook_url text,
  discord_webhook_url text,
  last_tick_ms bigint,
  updated_at timestamptz not null default now()
);
