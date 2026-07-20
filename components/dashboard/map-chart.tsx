"use client";

import {
  MapContainer,
  TileLayer,
  Circle,
  Popup,
} from "react-leaflet";
import type { DistrictBubble } from "@/lib/types";

interface MapChartProps {
  points: DistrictBubble[];
}

/**
 * Computes a circle radius (in metres) proportional to the record count
 * for a district bubble. Uses sqrt scaling so large values don't produce
 * unwieldy circles — a district with 10× the records of another gets
 * roughly 3× the radius.
 */
function bubbleRadius(count: number): number {
  return Math.sqrt(count) * 50;
}

export function MapChart({ points }: MapChartProps) {
  // MapChart is dynamically imported with ssr:false, so it only mounts
  // client-side. react-leaflet is always available when this renders.

  if (!points.length) {
    return (
      <div className="flex h-[300px] items-center justify-center text-xs text-cordaid-muted">
        No GPS coordinates in the filtered records.
      </div>
    );
  }

  // Compute bounding box to auto-fit the map view.
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  // Increase zoom when points cluster tightly (distance < 0.1°).
  const latSpread = maxLat - minLat;
  const zoom = latSpread < 0.1 ? 12 : 8;

  return (
    <MapContainer
      center={[centerLat, centerLng] as [number, number]}
      zoom={zoom}
      className="h-[300px] w-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p, i) => (
        <Circle
          key={i}
          center={[p.lat, p.lng] as [number, number]}
          radius={bubbleRadius(p.count)}
          pathOptions={{
            color: "#EF3A4F",
            fillColor: "#EF3A4F",
            fillOpacity: 0.25,
            weight: 2,
            opacity: 0.6,
          }}
        >
          <Popup>
            <div className="text-xs font-semibold mb-1">{p.district}</div>
            <div className="text-xs text-cordaid-muted">
              {p.count.toLocaleString()} activities
            </div>
            <div className="text-xs text-cordaid-muted">
              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </div>
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  );
}
