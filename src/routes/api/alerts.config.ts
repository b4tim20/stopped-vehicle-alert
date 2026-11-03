import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/alerts/config")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const engine = await import("@/lib/sva/engine.server");
        const settings = await engine.saveSettings({
          stoppedThresholdSeconds:
            typeof body.stoppedThresholdSeconds === "number"
              ? body.stoppedThresholdSeconds
              : typeof body.STOPPED_THRESHOLD_SECONDS === "number"
                ? body.STOPPED_THRESHOLD_SECONDS
                : undefined,
          alertEmailEnabled:
            typeof body.alertEmailEnabled === "boolean" ? body.alertEmailEnabled : undefined,
          alertSmsEnabled: typeof body.alertSmsEnabled === "boolean" ? body.alertSmsEnabled : undefined,
          alertWebhookEnabled:
            typeof body.alertWebhookEnabled === "boolean" ? body.alertWebhookEnabled : undefined,
          webhookUrl: typeof body.webhookUrl === "string" ? body.webhookUrl : undefined,
        });
        return Response.json(settings);
      },
    },
  },
});
