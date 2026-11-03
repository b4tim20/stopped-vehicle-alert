import { haversineMiles } from "./geo";
import type { CatalogCamera } from "./catalog";

const MODOT_QUERY =
  "https://services2.arcgis.com/jWXb6JPWtBjOCalT/ArcGIS/rest/services/MODOT_Traffic_Cameras/FeatureServer/1/query";

const TM_QUERY =
  "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query";

type ArcFeature = {
  attributes?: Record<string, unknown>;
  geometry?: { x?: number; y?: number };
};

function bbox(center: { lat: number; lon: number }, miles: number) {
  const dLat = miles / 69;
  const dLon = miles / (69 * Math.cos((center.lat * Math.PI) / 180));
  return {
    xmin: center.lon - dLon,
    ymin: center.lat - dLat,
    xmax: center.lon + dLon,
    ymax: center.lat + dLat,
  };
}

function parseMoDot(description: string): { highway: string; mileMarker: string; direction: string } {
  const mm = description.match(/MM\s*([0-9.]+)/i)?.[1] ?? "";
  const route = description.match(/\b(\d{2,3})\b/)?.[1];
  const highway = route ? `I-${route}` : "MO";
  const dir = description.match(/\b(E\/O|W\/O|N\/O|S\/O|EB|WB|NB|SB)\b/i)?.[1] ?? "";
  const direction =
    dir.startsWith("E") ? "EB" : dir.startsWith("W") ? "WB" : dir.startsWith("N") ? "NB" : dir.startsWith("S") ? "SB" : "—";
  return { highway, mileMarker: mm, direction };
}

async function queryArc(base: string, envelope: ReturnType<typeof bbox>, outFields: string) {
  const features: ArcFeature[] = [];
  let offset = 0;
  for (let page = 0; page < 8; page += 1) {
    const params = new URLSearchParams({
      where: "1=1",
      geometry: JSON.stringify({ ...envelope, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields,
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
      resultRecordCount: "200",
      resultOffset: String(offset),
    });
    const res = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) break;
    const data = (await res.json()) as { features?: ArcFeature[]; exceededTransferLimit?: boolean };
    const batch = data.features ?? [];
    features.push(...batch);
    if (!data.exceededTransferLimit || batch.length === 0) break;
    offset += batch.length;
  }
  return features;
}

export async function fetchPublicCameras(center: { lat: number; lon: number }, radiusMiles: number): Promise<CatalogCamera[]> {
  const box = bbox(center, radiusMiles + 1);
  const out: CatalogCamera[] = [];

  try {
    const features = await queryArc(MODOT_QUERY, box, "CAM_ID__,DESCRIPTION,URL2");
    for (const f of features) {
      const lat = f.geometry?.y;
      const lon = f.geometry?.x;
      const url = String(f.attributes?.URL2 ?? "");
      const idNum = f.attributes?.CAM_ID__;
      if (lat == null || lon == null || !url.startsWith("http")) continue;
      if (haversineMiles(center, { lat, lon }) > radiusMiles) continue;
      const description = String(f.attributes?.DESCRIPTION ?? `MoDOT ${idNum}`);
      const parsed = parseMoDot(description);
      out.push({
        id: `modot-cam-${idNum}`,
        name: description,
        highway: parsed.highway,
        direction: parsed.direction,
        mileMarker: parsed.mileMarker,
        lat,
        lon,
        streamUrl: url,
        snapshotUrl: null,
        feedType: "hls",
        source: "gateway-guide",
        notes: "Public MoDOT Traveler Information HLS (sfs*-traveler.modot.mo.gov).",
      });
    }
  } catch {
    // Keep whatever else we have.
  }

  try {
    const features = await queryArc(TM_QUERY, box, "CameraLocation,CameraDirection,SnapShot");
    for (const f of features) {
      const lat = f.geometry?.y;
      const lon = f.geometry?.x;
      const snap = String(f.attributes?.SnapShot ?? "");
      if (lat == null || lon == null || !snap.startsWith("http")) continue;
      if (haversineMiles(center, { lat, lon }) > radiusMiles) continue;
      const name = String(f.attributes?.CameraLocation ?? "Illinois camera");
      const dir = String(f.attributes?.CameraDirection ?? "—");
      const highway = name.match(/\b(I-\d+|IL[ -]?\d+|US-?\d+)\b/i)?.[1]?.replace(/\s+/g, "-").toUpperCase() ?? "IL";
      out.push({
        id: `idot-${Math.round(lat * 1e4)}-${Math.round(Math.abs(lon) * 1e4)}-${dir}`,
        name,
        highway,
        direction: dir,
        mileMarker: "",
        lat,
        lon,
        streamUrl: null,
        snapshotUrl: snap,
        feedType: "snapshot",
        source: "travelmidwest",
        notes: "Public TravelMidwest snapshot (cctv.travelmidwest.com).",
      });
    }
  } catch {
    // Illinois layer is best-effort.
  }

  return out;
}
