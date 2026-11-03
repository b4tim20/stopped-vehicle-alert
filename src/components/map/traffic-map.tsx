import { useEffect } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Alert, Camera } from "@/lib/sva/types";

type Props = {
  cameras: Camera[];
  alerts: Alert[];
  center: [number, number];
  radiusMiles: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function cameraIcon(status: Camera["status"], hasAlert: boolean, selected: boolean) {
  const color = hasAlert ? "#d26657" : status === "online" ? "#6a9e78" : status === "degraded" ? "#c4a15a" : "#6b717a";
  const size = selected ? 18 : hasAlert ? 16 : 12;
  return L.divIcon({
    className: "sva-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${color};box-shadow:0 0 0 ${hasAlert ? 6 : 2}px ${color}33;border:2px solid #0a0c0e"></span>`,
  });
}

export function TrafficMap({ cameras, alerts, center, radiusMiles, selectedId, onSelect }: Props) {
  const alertByCam = new Map(alerts.map((a) => [a.cameraId, a]));
  const meters = radiusMiles * 1609.34;

  return (
    <MapContainer
      center={center}
      zoom={10}
      className="h-full w-full rounded-lg"
      zoomControl={false}
      attributionControl={true}
    >
      <Recenter center={center} zoom={10} />
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <Circle
        center={center}
        radius={meters}
        pathOptions={{ color: "#8fb4c4", weight: 1, opacity: 0.55, fillOpacity: 0.04, dashArray: "4 6" }}
      />
      {cameras.map((cam) => {
        const alert = alertByCam.get(cam.id);
        return (
          <Marker
            key={cam.id}
            position={[cam.lat, cam.lon]}
            icon={cameraIcon(cam.status, Boolean(alert), cam.id === selectedId)}
            eventHandlers={{ click: () => onSelect(cam.id) }}
          />
        );
      })}
    </MapContainer>
  );
}
