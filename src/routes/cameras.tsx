import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CameraFeed } from "@/components/feed/camera-feed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOps } from "@/components/ops/use-ops";
import { createOpsCamera, rediscoverOpsCameras, updateOpsCamera } from "@/lib/sva/api";
import { formatMiles } from "@/lib/sva/geo";
import { toast } from "sonner";

export const Route = createFileRoute("/cameras")({ component: CamerasPage });

function CamerasPage() {
  const { data } = useOps();
  const qc = useQueryClient();
  const [highway, setHighway] = useState("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const cameras = data?.cameras ?? [];
  const highways = ["all", ...Array.from(new Set(cameras.map((c) => c.highway)))];
  const filtered = highway === "all" ? cameras : cameras.filter((c) => c.highway === highway);
  const vehicles = data?.vehicles ?? [];

  const rediscover = useMutation({
    mutationFn: () => rediscoverOpsCameras(),
    onSuccess: (res) => {
      toast.message(`Discovery finished · ${res.added} added · ${res.total} total`);
      void qc.invalidateQueries({ queryKey: ["ops"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (args: { id: string; enabled: boolean }) => updateOpsCamera({ data: args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops"] }),
  });

  return (
    <AppShell alertCount={data?.stats.activeAlerts ?? 0}>
      <div className="flex flex-col gap-4 p-3 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Cameras</h1>
            <p className="mt-1 text-sm text-muted">
              Public highway cameras inside the {data?.settings.radiusMiles ?? 25}-mile watch circle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => rediscover.mutate()} disabled={rediscover.isPending}>
              Rediscover
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-3.5" />
                  Add camera
                </Button>
              </DialogTrigger>
              <DialogContent title="Add camera">
                <AddCameraForm
                  onDone={() => {
                    setOpen(false);
                    void qc.invalidateQueries({ queryKey: ["ops"] });
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((cam) => {
            const v = vehicles.filter((x) => x.cameraId === cam.id);
            const playing = playingId === cam.id;
            return (
              <article key={cam.id} className="overflow-hidden rounded-xl bg-surface shadow-border">
                <button type="button" className="block w-full text-left" onClick={() => setPlayingId(playing ? null : cam.id)}>
                  <CameraFeed camera={cam} vehicles={v} className="aspect-video" play={playing || cam.feedType !== "hls"} />
                </button>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div>
                    <Link to="/cameras/$id" params={{ id: cam.id }} className="text-sm font-medium hover:underline">
                      {cam.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {cam.highway} {cam.direction} · {formatMiles(cam.milesFromCenter)} · {cam.source}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={cam.status === "online" ? "ok" : cam.status === "offline" ? "live" : "warn"}>
                      {cam.status}
                    </Badge>
                    <button
                      type="button"
                      className="text-[11px] text-muted hover:text-fg"
                      onClick={() => toggle.mutate({ id: cam.id, enabled: !cam.enabled })}
                    >
                      {cam.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function AddCameraForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [highway, setHighway] = useState("I-270");
  const [direction, setDirection] = useState("EB");
  const [mileMarker, setMileMarker] = useState("");
  const [lat, setLat] = useState("38.7465");
  const [lon, setLon] = useState("-90.2189");

  const create = useMutation({
    mutationFn: () =>
      createOpsCamera({
        data: {
          name,
          highway,
          direction,
          mileMarker,
          lat: Number(lat),
          lon: Number(lon),
          feedType: "simulated",
        },
      }),
    onSuccess: () => {
      toast.message("Camera added");
      onDone();
    },
    onError: () => toast.message("Could not add camera"),
  });

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="cam-name">Name</Label>
        <Input id="cam-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cam-hwy">Highway</Label>
          <Input id="cam-hwy" value={highway} onChange={(e) => setHighway(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cam-dir">Direction</Label>
          <Input id="cam-dir" value={direction} onChange={(e) => setDirection(e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cam-mm">Mile marker</Label>
        <Input id="cam-mm" value={mileMarker} onChange={(e) => setMileMarker(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cam-lat">Latitude</Label>
          <Input id="cam-lat" value={lat} onChange={(e) => setLat(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cam-lon">Longitude</Label>
          <Input id="cam-lon" value={lon} onChange={(e) => setLon(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" disabled={create.isPending}>
        Save camera
      </Button>
    </form>
  );
}
