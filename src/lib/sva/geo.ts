export const CENTER_ZIP = "63137";
export const CENTER_NAME = "Bellefontaine Neighbors, MO";
export const CENTER_LAT = 38.7465;
export const CENTER_LON = -90.2189;
export const DEFAULT_RADIUS_MILES = 25;

const EARTH_MI = 3958.8;

export type LatLon = { lat: number; lon: number };

export function haversineMiles(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function inRadius(
  point: LatLon,
  center: LatLon = { lat: CENTER_LAT, lon: CENTER_LON },
  miles: number = DEFAULT_RADIUS_MILES,
): boolean {
  return haversineMiles(point, center) <= miles + 1e-6;
}

export function googleMapsUrl(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export function formatMiles(mi: number): string {
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}
