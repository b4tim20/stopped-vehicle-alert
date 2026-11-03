import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cameras")({
  server: {
    handlers: {
      GET: async () => {
        const engine = await import("@/lib/sva/engine.server");
        return Response.json(await engine.listCameras());
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const engine = await import("@/lib/sva/engine.server");
        const cam = await engine.createCamera({
          name: String(body.name ?? ""),
          highway: String(body.highway ?? ""),
          direction: String(body.direction ?? ""),
          mileMarker: String(body.mileMarker ?? body.mile_marker ?? ""),
          lat: Number(body.lat),
          lon: Number(body.lon),
          streamUrl: body.streamUrl ? String(body.streamUrl) : null,
          snapshotUrl: body.snapshotUrl ? String(body.snapshotUrl) : null,
          feedType:
            body.feedType === "hls" ||
            body.feedType === "mjpeg" ||
            body.feedType === "rtsp" ||
            body.feedType === "snapshot"
              ? body.feedType
              : "simulated",
          notes: body.notes ? String(body.notes) : "API",
        });
        return Response.json(cam, { status: 201 });
      },
    },
  },
});
