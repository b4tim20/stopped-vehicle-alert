import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOps } from "@/components/ops/use-ops";
import { formatDuration } from "@/lib/sva/detection";
import { alertHeadline } from "@/lib/sva/alert-format";
import type { Alert } from "@/lib/sva/types";

export const Route = createFileRoute("/alerts")({ component: AlertsPage });

function AlertsPage() {
  const { data } = useOps();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [highway, setHighway] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const active = data?.activeAlerts ?? [];
  const history = data?.recentAlerts ?? [];
  const rows = tab === "active" ? active : history;
  const highways = useMemo(
    () => ["all", ...Array.from(new Set(history.map((a) => a.highway)))],
    [history],
  );
  const filtered = highway === "all" ? rows : rows.filter((a) => a.highway === highway);
  const open = filtered.find((a) => a.id === openId) ?? filtered[0];

  return (
    <AppShell alertCount={active.length}>
      <div className="flex flex-col gap-4 p-3 md:p-5">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Alerts</h1>
          <p className="mt-1 text-sm text-muted">
            Raised when a tracked vehicle stays under the motion threshold for{" "}
            {data?.settings.stoppedThresholdSeconds ?? 120} seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={tab === "active" ? "default" : "secondary"} onClick={() => setTab("active")}>
            Active ({active.length})
          </Button>
          <Button size="sm" variant={tab === "history" ? "default" : "secondary"} onClick={() => setTab("history")}>
            History
          </Button>
          <div className="ml-auto flex gap-2 overflow-x-auto">
            {highways.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHighway(h)}
                className={`h-9 shrink-0 rounded-full px-3 text-xs ${
                  highway === h ? "bg-accent text-accent-fg" : "bg-surface text-muted shadow-border"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.8fr)]">
          <div className="overflow-hidden rounded-xl bg-surface shadow-border">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Camera</th>
                  <th className="px-3 py-2 font-medium">Route</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted">
                      No alerts in this view.
                    </td>
                  </tr>
                ) : (
                  filtered.map((alert) => (
                    <tr
                      key={alert.id}
                      className="cursor-pointer border-b border-border/70 hover:bg-surface-2"
                      onClick={() => setOpenId(alert.id)}
                    >
                      <td className="px-3 py-3">{alert.cameraName}</td>
                      <td className="px-3 py-3 text-muted">
                        {alert.highway} {alert.direction}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums">{formatDuration(alert.durationSec)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={alert.status === "active" ? "live" : "default"}>{alert.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AlertPayloadCard alert={open} />
        </div>
      </div>
    </AppShell>
  );
}

function AlertPayloadCard({ alert }: { alert?: Alert }) {
  if (!alert) {
    return (
      <div className="rounded-xl bg-surface p-4 text-sm text-muted shadow-border">
        Select an alert to inspect the payload.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-surface p-4 shadow-border">
      <h2 className="text-sm font-medium">Payload</h2>
      <p className="mt-2 text-sm">{alertHeadline(alert.payload)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Confidence</dt>
          <dd className="font-mono">{Math.round(alert.confidence * 100)}%</dd>
        </div>
        <div>
          <dt className="text-muted">Mile marker</dt>
          <dd className="font-mono">{alert.mileMarker || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Started</dt>
          <dd className="font-mono">{new Date(alert.startedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted">Map</dt>
          <dd>
            <a href={alert.mapUrl} className="text-accent hover:underline" target="_blank" rel="noreferrer">
              Open
            </a>
          </dd>
        </div>
      </dl>
      <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-bg p-3 font-mono text-[11px] text-muted">
        {JSON.stringify(alert.payload, null, 2)}
      </pre>
      <Link to="/cameras/$id" params={{ id: alert.cameraId }} className="mt-3 inline-block text-xs text-accent hover:underline">
        Open camera
      </Link>
    </div>
  );
}
