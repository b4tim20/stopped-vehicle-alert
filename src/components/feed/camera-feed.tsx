import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import type { Camera, TrackedVehicle } from "@/lib/sva/types";
import { formatDuration } from "@/lib/sva/detection";
import { cn } from "@/lib/utils";

type Props = {
  camera: Camera;
  vehicles: TrackedVehicle[];
  className?: string;
  play?: boolean;
};

const LANES = 4;

function project(lane: number, depth: number) {
  const d = Math.min(1, Math.max(0, depth));
  const roadTop = 0.3;
  const roadBottom = 0.97;
  const y = roadTop + d * (roadBottom - roadTop);
  const wFar = 0.28;
  const wNear = 1.02;
  const w = wFar + d * (wNear - wFar);
  const left = 0.5 - w / 2;
  const laneW = w / LANES;
  const x = left + (lane + 0.5) * laneW;
  const scale = 0.28 + d * 1.05;
  return { x, y, scale, w };
}

function hourInStLouis(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 12);
}

type RenderMode = "sim" | "snapshot" | "video";

function pickMode(camera: Camera): RenderMode {
  if (camera.feedType === "snapshot" && camera.snapshotUrl) return "snapshot";
  if ((camera.feedType === "hls" || camera.feedType === "mjpeg") && camera.streamUrl) {
    return "video";
  }
  return "sim";
}

export function CameraFeed({ camera, vehicles, className, play = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const night = useMemo(() => {
    const h = hourInStLouis(new Date());
    return h < 6 || h >= 19;
  }, []);

  const mode = pickMode(camera);

  useEffect(() => {
    if (mode !== "sim") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t0 = performance.now();

    const draw = (t: number) => {
      const dt = (t - t0) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const sky = night
        ? ["#0c1016", "#151b24", "#1c2430"]
        : ["#6f8496", "#8a9aaa", "#9aa7b3"];
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, sky[0]);
      grd.addColorStop(0.38, sky[1]);
      grd.addColorStop(1, sky[2]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = night ? "#1a2118" : "#3d4a38";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.32);
      ctx.lineTo(w * 0.36, h * 0.3);
      ctx.lineTo(0, h * 0.62);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w, h * 0.32);
      ctx.lineTo(w * 0.64, h * 0.3);
      ctx.lineTo(w, h * 0.62);
      ctx.fill();

      ctx.fillStyle = night ? "#2a2e34" : "#5a6168";
      ctx.beginPath();
      ctx.moveTo(w * 0.36, h * 0.3);
      ctx.lineTo(w * 0.64, h * 0.3);
      ctx.lineTo(w * 1.02, h * 0.97);
      ctx.lineTo(w * -0.02, h * 0.97);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = night ? "rgba(232,220,160,0.55)" : "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      for (let i = 1; i < LANES; i += 1) {
        ctx.beginPath();
        const farX = w * (0.36 + (0.28 * i) / LANES);
        const nearX = w * (-0.02 + (1.04 * i) / LANES);
        ctx.moveTo(farX, h * 0.3);
        ctx.lineTo(nearX, h * 0.97);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = night ? "#d8c46a" : "#f2f2f2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.36, h * 0.3);
      ctx.lineTo(w * -0.02, h * 0.97);
      ctx.moveTo(w * 0.64, h * 0.3);
      ctx.lineTo(w * 1.02, h * 0.97);
      ctx.stroke();

      const sorted = [...vehicles].sort((a, b) => a.y - b.y);
      for (const v of sorted) {
        const p = project(v.lane, v.y);
        const bw = (v.vehicleClass === "truck" || v.vehicleClass === "bus" ? 26 : 18) * p.scale;
        const bh = (v.vehicleClass === "truck" || v.vehicleClass === "bus" ? 42 : 28) * p.scale;
        const x = p.x * w - bw / 2;
        const y = p.y * h - bh;
        ctx.fillStyle = v.isStopped ? "#8a3d36" : v.vehicleClass === "truck" ? "#3d4c5c" : "#2c333c";
        roundRect(ctx, x, y, bw, bh, 3);
        ctx.fill();
        if (night) {
          ctx.fillStyle = "rgba(255,230,170,0.85)";
          ctx.fillRect(x + 2, y + bh - 6, 5, 3);
          ctx.fillRect(x + bw - 7, y + bh - 6, 5, 3);
        }
        ctx.strokeStyle = v.isStopped ? "#d26657" : "rgba(143,180,196,0.85)";
        ctx.lineWidth = v.isStopped ? 2 : 1;
        ctx.strokeRect(x - 4, y - 10, bw + 8, bh + 14);
        ctx.font = `${Math.max(9, 10 * p.scale)}px ui-monospace, monospace`;
        ctx.fillStyle = v.isStopped ? "#d26657" : "#c5d4dc";
        const label = v.isStopped
          ? `ID ${v.trackId}  STOPPED ${formatDuration(v.stoppedDurationSec)}`
          : `ID ${v.trackId}  ${v.vehicleClass}`;
        ctx.fillText(label, x - 2, y - 14);
      }

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

      const scan = ((dt * 40) % h) | 0;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(0, scan, w, 8);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [vehicles, night, mode]);

  const stopped = vehicles.filter((v) => v.isStopped).length;
  const offline = camera.status === "offline";

  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-surface-2", className)}>
      {mode === "sim" && (
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className={cn("block h-full w-full object-cover", offline && "opacity-40 grayscale")}
        />
      )}
      {mode === "snapshot" && (
        <SnapshotImage url={camera.snapshotUrl!} alt={camera.name} offline={offline} />
      )}
      {mode === "video" && play && <LiveHls src={camera.streamUrl!} offline={offline} />}
      {mode === "video" && !play && (
        <div className="flex h-full min-h-[8rem] w-full items-center justify-center bg-[#10141a] font-mono text-[11px] tracking-wider text-muted">
          HLS · click play
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,12,14,0.35),transparent_18%,transparent_78%,rgba(10,12,14,0.45))]" />
      <div className="absolute top-2 left-3 flex items-center gap-2 font-mono text-[10px] tracking-wider text-fg">
        <span className={cn("size-1.5 rounded-full", offline ? "bg-muted" : "bg-danger")} />
        <span>{offline ? "NO SIGNAL" : camera.feedType === "simulated" ? "SIM" : "LIVE"}</span>
        <span className="text-muted">
          {camera.highway} {camera.direction} · MM {camera.mileMarker || "—"}
        </span>
      </div>
      <div className="absolute top-2 right-3 font-mono text-[10px] text-muted tabular-nums">
        {camera.id}
      </div>
      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-sm text-fg">{camera.name}</p>
          <p className="font-mono text-[10px] text-muted">
            YOLO · ByteTrack · {stopped} stopped / {vehicles.length} tracks
          </p>
        </div>
        <p className="font-mono text-[10px] text-muted tabular-nums">
          {camera.status.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

function LiveHls({ src, offline }: { src: string; offline: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      void video.play().catch(() => undefined);
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src]);
  return (
    <video
      ref={ref}
      muted
      autoPlay
      playsInline
      className={cn("block h-full w-full object-cover", offline && "opacity-40 grayscale")}
    />
  );
}

function SnapshotImage({ url, alt, offline }: { url: string; alt: string; offline: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, [url]);
  const sep = url.includes("?") ? "&" : "?";
  return (
    <img
      src={`${url}${sep}t=${tick}`}
      alt={alt}
      className={cn("block h-full w-full object-cover", offline && "opacity-40 grayscale")}
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
