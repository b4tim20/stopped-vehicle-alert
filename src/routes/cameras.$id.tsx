import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { CameraFeed } from "@/components/feed/camera-feed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInjectScenario, useOps } from "@/components/ops/use-ops";
import { formatDuration } from "@/lib/sva/detection";
import { formatMiles } from "@/lib/sva/geo";

export const Route = createFileRoute("/cameras/$id")({ component: CameraDetail });

function CameraDetail() {
  const { id } = Route.useParams();
  const { data } = useOps();
  const inject = useInjectScenario();
  const cam = data?.cameras.find((c) => c.id === id);
  const vehicles = (data?.vehicles ?? []).filter((v) => v.cameraId === id);
  const alerts = (data?.recentAlerts ?? []).filter((a) => a.cameraId === id);

  return (
    <AppShell alertCount={data?.stats.activeAlerts ?? 0}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-3 md:p-6">
        <Link to="/cameras" className="text-sm text-muted hover:text-fg">
          Back to cameras
        </Link>
        {!cam ? (
          <p className="text-muted">Camera not in the current watch circle.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl tracking-tight">{cam.name}</h1>
                <p className="mt-1 text-sm text-muted">
                  {cam.highway} {cam.direction} · MM {cam.mileMarker || "—"} · {formatMiles(cam.milesFromCenter)} from 63137
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cam.status === "online" ? "ok" : "live"}>{cam.status}</Badge>
                <Button size="sm" onClick={() => inject.mutate(cam.id)} disabled={inject.isPending}>
                  Inject stopped vehicle
                </Button>
              </div>
            </div>
            <CameraFeed camera={cam} vehicles={vehicles} className="aspect-video" />
            <section className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-surface p-4 shadow-border">
                <h2 className="text-sm font-medium">Tracks</h2>
                <ul className="mt-3 space-y-2">
                  {vehicles.length === 0 ? (
                    <li className="text-sm text-muted">No active tracks on this sample.</li>
                  ) : (
                    vehicles.map((v) => (
                      <li key={v.id} className="flex justify-between font-mono text-xs">
                        <span>
                          ID {v.trackId} · {v.vehicleClass}
                        </span>
                        <span className={v.isStopped ? "text-danger" : "text-muted"}>
                          {v.isStopped ? `STOPPED ${formatDuration(v.stoppedDurationSec)}` : "moving"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-xl bg-surface p-4 shadow-border">
                <h2 className="text-sm font-medium">Alert history</h2>
                <ul className="mt-3 space-y-2">
                  {alerts.length === 0 ? (
                    <li className="text-sm text-muted">No alerts yet for this camera.</li>
                  ) : (
                    alerts.map((a) => (
                      <li key={a.id} className="text-sm">
                        <span className={a.status === "active" ? "text-danger" : "text-muted"}>
                          {a.status}
                        </span>
                        <span className="text-muted"> · {formatDuration(a.durationSec)} · </span>
                        {new Date(a.startedAt).toLocaleTimeString()}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
            <p className="text-xs text-muted">
              Feed type {cam.feedType} · source {cam.source}. Faces and plates are not stored. ROI is the paved
              lanes in the simulated frame.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
