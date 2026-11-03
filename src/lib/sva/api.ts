import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AppSettings, FeedType, OpsSnapshot } from "./types";

export const syncOps = createServerFn({ method: "POST" }).handler(async () => {
  const engine = await import("./engine.server");
  await engine.tickSimulator();
  return engine.getSnapshot() as Promise<OpsSnapshot>;
});

export const getOps = createServerFn({ method: "GET" }).handler(async () => {
  const engine = await import("./engine.server");
  return engine.getSnapshot() as Promise<OpsSnapshot>;
});

export const injectScenario = createServerFn({ method: "POST" })
  .validator(z.object({ cameraId: z.string().optional() }))
  .handler(async ({ data }) => {
    const engine = await import("./engine.server");
    return engine.injectStoppedScenario(data.cameraId);
  });

export const saveOpsSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      radiusMiles: z.number().min(1).max(80).optional(),
      stoppedThresholdSeconds: z.number().min(5).max(3600).optional(),
      pixelThreshold: z.number().min(0.001).max(0.2).optional(),
      detectionFps: z.number().min(1).max(12).optional(),
      windowSeconds: z.number().min(2).max(30).optional(),
      cooldownSeconds: z.number().min(0).max(3600).optional(),
      simulatorEnabled: z.boolean().optional(),
      simulatorSpeed: z.number().min(1).max(30).optional(),
      alertEmailEnabled: z.boolean().optional(),
      alertSmsEnabled: z.boolean().optional(),
      alertWebhookEnabled: z.boolean().optional(),
      alertSlackEnabled: z.boolean().optional(),
      alertDiscordEnabled: z.boolean().optional(),
      webhookUrl: z.string().nullable().optional(),
      slackWebhookUrl: z.string().nullable().optional(),
      discordWebhookUrl: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const engine = await import("./engine.server");
    return engine.saveSettings(data as Partial<AppSettings>);
  });

export const createOpsCamera = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(2).max(120),
      highway: z.string().min(1).max(40),
      direction: z.string().min(1).max(20),
      mileMarker: z.string().max(20),
      lat: z.number().min(36).max(41),
      lon: z.number().min(-94).max(-87),
      streamUrl: z.string().nullable().optional(),
      snapshotUrl: z.string().nullable().optional(),
      feedType: z.enum(["hls", "mjpeg", "rtsp", "snapshot", "simulated"]).optional(),
      notes: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const engine = await import("./engine.server");
    return engine.createCamera({
      ...data,
      feedType: data.feedType as FeedType | undefined,
    });
  });

export const updateOpsCamera = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(2).max(120).optional(),
      enabled: z.boolean().optional(),
      notes: z.string().nullable().optional(),
      streamUrl: z.string().nullable().optional(),
      snapshotUrl: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const engine = await import("./engine.server");
    return engine.updateCamera(data);
  });

export const removeOpsCamera = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const engine = await import("./engine.server");
    return engine.deleteCamera(data.id);
  });

export const rediscoverOpsCameras = createServerFn({ method: "POST" }).handler(async () => {
  const engine = await import("./engine.server");
  return engine.rediscoverCameras();
});
