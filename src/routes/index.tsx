import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MapPane } from "@/components/map/map-pane";
import { CameraFeed } from "@/components/feed/camera-feed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInjectScenario, useOps } from "@/components/ops/use-ops";
import { useUiStore } from "@/lib/sva/ui-store";
import { formatDuration } from "@/lib/sva/detection";
import { formatMiles } from "@/lib/sva/geo";

export const Route = createFileRoute("/")({ component: Overview });

function Overview() {
  const { data, isPending, isError } = useOps();
  const inject = useInjectScenario();
  const selectedId = useUiStore((s) => s.selectedCameraId);
  const setSelected = useUiStore((s) => s.setSelectedCameraId);

  const cameras = data?.cameras ?? [];
  const alerts = data?.activeAlerts ?? [];
  const liveFirst = [...cameras].sort((a, b) => Number(b.feedType === "hls") - Number(a.feedType === "hls"));
  const selected =
    cameras.find((c) => c.id === (selectedId ?? alerts[0]?.cameraId)) ??
    liveFirst.find((c) => c.feedType === "hls" || c.feedType === "snapshot") ??
    cameras[0];
  const vehicles = (data?.vehicles ?? []).filter((v) => v.cameraId === selected?.id);
  const settings = data?.settings;

  return (
    <AppShell alertCount={alerts.length}>
      <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:p-4">
        <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Cameras online" value={data ? `${data.stats.camerasOnline}/${data.stats.camerasTotal}` : "—"} />
          <Kpi label="Active alerts" value={data ? String(data.stats.activeAlerts) : "—"} hot={Boolean(data?.stats.activeAlerts)} />
          <Kpi label="Stopped now" value={data ? String(data.stats.stoppedNow) : "—"} />
          <Kpi label="Tracked" value={data ? String(data.stats.vehiclesTracked) : "—"} />
        </section>

        {isError ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            Could not load operations state. Retrying.
          </p>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="relative min-h-[42vh] overflow-hidden rounded-xl bg-surface shadow-border lg:min-h-0">
            {settings ? (
              <MapPane
                cameras={cameras}
                alerts={alerts}
                center={[settings.centerLat, settings.centerLon]}
                radiusMiles={settings.radiusMiles}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                {isPending ? "Starting watch circle…" : "No map"}
              </div>
            )}
            <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2">
              <Badge variant="accent">ZIP {settings?.centerZip ?? "63137"}</Badge>
              <Badge>{settings ? `${settings.radiusMiles} mi radius` : "25 mi"}</Badge>
              {settings?.simulatorEnabled ? <Badge variant="warn">Simulator</Badge> : <Badge variant="ok">Live ingest</Badge>}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-medium">Active alerts</h2>
              <Button
                size="sm"
                onClick={() => inject.mutate(selected?.id)}
                disabled={inject.isPending}
              >
                <TriangleAlert className="size-3.5" />
                Inject stop
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <p className="rounded-lg bg-surface p-4 text-sm text-muted shadow-border">
                  No stopped vehicles past the {settings?.stoppedThresholdSeconds ?? 120}s threshold.
                  Inject a stop on the selected camera to exercise the pipeline.
                </p>
              ) : (
                alerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => setSelected(alert.cameraId)}
                    className="w-full rounded-lg bg-surface p-3 text-left shadow-border transition-colors hover:bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{alert.cameraName}</p>
                      <span className="font-mono text-xs text-danger tabular-nums">
                        {formatDuration(alert.durationSec)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {alert.highway} {alert.direction} · MM {alert.mileMarker} · {Math.round(alert.confidence * 100)}%
                    </p>
                  </button>
                ))
              )}
            </div>

            {selected ? (
              <div className="overflow-hidden rounded-xl bg-surface shadow-border">
                <CameraFeed camera={selected} vehicles={vehicles} className="aspect-video" />
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Radio className="size-3.5" />
                    {formatMiles(selected.milesFromCenter)} from 63137
                  </p>
                  <Link to="/cameras/$id" params={{ id: selected.id }} className="text-xs text-accent hover:underline">
                    Camera detail
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3 shadow-border">
      <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-1 font-mono text-2xl tabular-nums ${hot ? "text-danger" : "text-fg"}`}>{value}</p>
    </div>
  );
}
