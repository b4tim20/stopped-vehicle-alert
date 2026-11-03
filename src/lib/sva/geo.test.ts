import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CENTER_LAT,
  CENTER_LON,
  haversineMiles,
  inRadius,
  googleMapsUrl,
} from "./geo.ts";

test("center is inside its own radius", () => {
  assert.equal(
    inRadius({ lat: CENTER_LAT, lon: CENTER_LON }, { lat: CENTER_LAT, lon: CENTER_LON }, 25),
    true,
  );
  assert.ok(haversineMiles({ lat: CENTER_LAT, lon: CENTER_LON }, { lat: CENTER_LAT, lon: CENTER_LON }) < 0.01);
});

test("I-270 @ MO-367 is near ZIP 63137", () => {
  const mi = haversineMiles(
    { lat: CENTER_LAT, lon: CENTER_LON },
    { lat: 38.7584, lon: -90.2218 },
  );
  assert.ok(mi < 2, `expected < 2 miles, got ${mi}`);
});

test("Jefferson Barracks is inside 25 miles", () => {
  assert.equal(
    inRadius({ lat: 38.4872, lon: -90.2764 }, { lat: CENTER_LAT, lon: CENTER_LON }, 25),
    true,
  );
});

test("Columbia MO is outside 25 miles", () => {
  assert.equal(
    inRadius({ lat: 38.9517, lon: -92.3341 }, { lat: CENTER_LAT, lon: CENTER_LON }, 25),
    false,
  );
});

test("google maps link formats coordinates", () => {
  assert.equal(googleMapsUrl(38.7465, -90.2189), "https://maps.google.com/?q=38.74650,-90.21890");
});
