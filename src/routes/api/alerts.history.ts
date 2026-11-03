import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/alerts/history")({
  server: {
    handlers: {
      GET: async () => {
        const engine = await import("@/lib/sva/engine.server");
        const snap = await engine.getSnapshot();
        return Response.json(snap.recentAlerts);
      },
    },
  },
});
