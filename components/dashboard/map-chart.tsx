"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import type { GpsPoint } from "@/lib/filters";

interface MapChartProps {
  points: GpsPoint[];
}

export function MapChart({ points }: MapChartProps) {
  const [leafletReady, setLeafletReady] = useState(false);

  // Dynamically import Leaflet core inside useEffect to avoid SSR crash.
  // Fix the default marker icon paths broken by webpack bundling.
  useEffect(() => {
    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
        ._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setLeafletReady(true);
    });
  }, []);

  if (!points.length) {
    return (
      <div className="flex h-[300px] items-center justify-center text-xs text-cordaid-muted">
        No GPS coordinates in the filtered records.
      </div>
    );
  }

  if (!leafletReady) {
    return (
      <div className="flex h-[300px] items-center justify-center text-xs text-cordaid-muted">
        Loading map…
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
        <Marker key={i} position={[p.lat, p.lng] as [number, number]}>
          <Popup>
            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
