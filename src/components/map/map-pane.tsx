import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { Alert, Camera } from "@/lib/sva/types";

const TrafficMap = lazy(() =>
  import("./traffic-map").then((m) => ({ default: m.TrafficMap })),
);

type Props = {
  cameras: Camera[];
  alerts: Alert[];
  center: [number, number];
  radiusMiles: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function MapFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-surface-2 text-sm text-muted">
      Loading map
    </div>
  );
}

export function MapPane(props: Props) {
  return (
    <ClientOnly fallback={<MapFallback />}>
      <Suspense fallback={<MapFallback />}>
        <TrafficMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
