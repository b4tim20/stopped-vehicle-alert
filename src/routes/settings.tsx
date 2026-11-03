import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useOps, useSaveSettings } from "@/components/ops/use-ops";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data } = useOps();
  const save = useSaveSettings();
  const s = data?.settings;
  const [threshold, setThreshold] = useState(120);
  const [radius, setRadius] = useState(25);
  const [speed, setSpeed] = useState(10);
  const [fps, setFps] = useState(3);
  const [cooldown, setCooldown] = useState(180);
  const [sim, setSim] = useState(true);
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  const [webhook, setWebhook] = useState(false);
  const [slack, setSlack] = useState(false);
  const [discord, setDiscord] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (!s) return;
    setThreshold(s.stoppedThresholdSeconds);
    setRadius(s.radiusMiles);
    setSpeed(s.simulatorSpeed);
    setFps(s.detectionFps);
    setCooldown(s.cooldownSeconds);
    setSim(s.simulatorEnabled);
    setEmail(s.alertEmailEnabled);
    setSms(s.alertSmsEnabled);
    setWebhook(s.alertWebhookEnabled);
    setSlack(s.alertSlackEnabled);
    setDiscord(s.alertDiscordEnabled);
    setWebhookUrl(s.webhookUrl ?? "");
  }, [s]);

  function persist() {
    save.mutate(
      {
        stoppedThresholdSeconds: threshold,
        radiusMiles: radius,
        simulatorSpeed: speed,
        detectionFps: fps,
        cooldownSeconds: cooldown,
        simulatorEnabled: sim,
        alertEmailEnabled: email,
        alertSmsEnabled: sms,
        alertWebhookEnabled: webhook,
        alertSlackEnabled: slack,
        alertDiscordEnabled: discord,
        webhookUrl: webhookUrl || null,
      },
      { onSuccess: () => toast.message("Settings saved") },
    );
  }

  return (
    <AppShell alertCount={data?.stats.activeAlerts ?? 0}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 p-3 md:p-6">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted">
            Detection window, watch radius, simulator, and alert channels. Email/SMS require operator credentials
            and are recorded as simulated deliveries until configured.
          </p>
        </div>

        <section className="grid gap-4 rounded-xl bg-surface p-4 shadow-border">
          <h2 className="font-display text-base">Detection</h2>
          <Field label="Stopped threshold (seconds)" value={String(threshold)} onChange={setNumber(setThreshold)} />
          <Field label="Watch radius (miles)" value={String(radius)} onChange={setNumber(setRadius)} />
          <Field label="Detection sample rate (FPS)" value={String(fps)} onChange={setNumber(setFps)} />
          <Field label="Alert cooldown (seconds)" value={String(cooldown)} onChange={setNumber(setCooldown)} />
        </section>

        <section className="grid gap-4 rounded-xl bg-surface p-4 shadow-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base">Simulator</h2>
              <p className="text-sm text-muted">
                Public MoDOT HLS and TravelMidwest snapshots play on the camera cards. The simulator only adds synthetic tracks for the alert pipeline. It does not replace the live picture, and nothing is stored from the frames.
              </p>
            </div>
            <Switch checked={sim} onCheckedChange={setSim} />
          </div>
          <Field label="Time acceleration" value={String(speed)} onChange={setNumber(setSpeed)} />
        </section>

        <section className="grid gap-4 rounded-xl bg-surface p-4 shadow-border">
          <h2 className="font-display text-base">Channels</h2>
          <Row label="Dashboard" checked disabled />
          <Row label="Email" checked={email} onCheckedChange={setEmail} />
          <Row label="SMS (Twilio)" checked={sms} onCheckedChange={setSms} />
          <Row label="Slack" checked={slack} onCheckedChange={setSlack} />
          <Row label="Discord" checked={discord} onCheckedChange={setDiscord} />
          <Row label="Webhook" checked={webhook} onCheckedChange={setWebhook} />
          <div className="grid gap-1.5">
            <Label htmlFor="wh">Webhook URL</Label>
            <Input id="wh" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://" />
          </div>
        </section>

        <Button onClick={persist} disabled={save.isPending}>
          Save settings
        </Button>

        <Separator />

        <section className="grid gap-4">
          <h2 className="font-display text-base">Architecture</h2>
          <ol className="grid gap-2 text-sm text-muted">
            <li className="rounded-lg bg-surface px-3 py-2 shadow-border">
              1. Camera manager — Gateway Guide catalog + optional Illinois TravelMidwest discovery, geospatial filter around 63137.
            </li>
            <li className="rounded-lg bg-surface px-3 py-2 shadow-border">
              2. Ingest — HLS / MJPEG / RTSP / snapshot adapters; this deployment uses the legal simulator fallback.
            </li>
            <li className="rounded-lg bg-surface px-3 py-2 shadow-border">
              3. Detect & track — vehicle boxes, ByteTrack-style IDs, sliding-window displacement.
            </li>
            <li className="rounded-lg bg-surface px-3 py-2 shadow-border">
              4. Stop classifier — duration vs threshold, cooldown, dedupe per camera + track.
            </li>
            <li className="rounded-lg bg-surface px-3 py-2 shadow-border">
              5. Alerting — dashboard, webhook, Slack, Discord, email/SMS records. Payload includes camera, highway, mile marker, map, duration, confidence.
            </li>
          </ol>
          <p className="text-xs text-subtle">
            REST: GET /health, GET /api/cameras, POST /api/cameras, GET /api/alerts/active, GET /api/alerts/history,
            POST /api/alerts/config. Live dashboard updates poll every 2 seconds.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function setNumber(setter: (n: number) => void) {
  return (v: string) => setter(Number(v) || 0);
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" />
    </div>
  );
}

function Row({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-11 items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked ?? true} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
