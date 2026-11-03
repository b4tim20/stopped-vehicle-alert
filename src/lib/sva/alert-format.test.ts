import assert from "node:assert/strict";
import { test } from "node:test";
import { alertHeadline, buildAlertPayload } from "./alert-format.ts";

test("alert payload includes camera, duration, map, and confidence", () => {
  const payload = buildAlertPayload({
    alertId: "alrt-1",
    camera: {
      id: "modot-i270-mo367",
      name: "I-270 @ MO-367 / Lewis & Clark",
      highway: "I-270",
      direction: "EB/WB",
      mileMarker: "34.2",
      lat: 38.7584,
      lon: -90.2218,
    },
    track: {
      id: "trk-9",
      vehicleClass: "truck",
      confidence: 0.9124,
      stoppedDurationSec: 128,
    },
    status: "active",
    timestamp: "2026-09-30T05:12:00.000Z",
    snapshotUrl: "sim://modot-i270-mo367/128",
  });

  assert.equal(payload.camera_id, "modot-i270-mo367");
  assert.equal(payload.camera_name, "I-270 @ MO-367 / Lewis & Clark");
  assert.equal(payload.highway, "I-270");
  assert.equal(payload.duration_stopped_seconds, 128);
  assert.equal(payload.duration_stopped_human, "2m 8s");
  assert.equal(payload.map_link, "https://maps.google.com/?q=38.75840,-90.22180");
  assert.equal(payload.confidence, 0.912);
  assert.equal(payload.status, "active");
  assert.match(
    alertHeadline(payload),
    /Stopped truck on I-270 EB\/WB at I-270 @ MO-367 \/ Lewis & Clark for 2m 8s/,
  );
});
