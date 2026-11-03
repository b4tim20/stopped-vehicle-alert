import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const engine = await import("@/lib/sva/engine.server");
        return Response.json(await engine.healthPayload());
      },
    },
  },
});
