import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "../types/shared";

// [INTEGRATE] Kakao Maps JS SDK로 교체 가능 (도메인 제한 키 필요).
// 현재는 키 없이 동작하는 Leaflet + OpenStreetMap 조합을 사용해
// "npm run dev 즉시 실행"을 보장함.
const OSM_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      background: #7C5B3A; transform: rotate(-45deg) translate(50%, -50%);
      border: 3px solid #FBF8F3; box-shadow: 0 2px 6px rgba(0,0,0,.3);
    "></div>`,
  iconSize: [28, 28],
  iconAnchor: [0, 0],
});

function MapClickHandler({ onPick }: { onPick: (c: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface MapViewProps {
  center: Coordinates;
  draggable?: boolean;
  onPick?: (c: Coordinates) => void;
  height?: number;
}

export function MapView({ center, draggable = false, onPick, height = 260 }: MapViewProps) {
  const [pos, setPos] = useState<Coordinates>(center);

  useEffect(() => {
    setPos(center);
  }, [center]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-xl border border-cream-200">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={16}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer url={OSM_TILE} attribution={OSM_ATTR} />
        <Marker
          position={[pos.lat, pos.lng]}
          icon={pinIcon}
          draggable={draggable}
          eventHandlers={{
            dragend(e) {
              const ll = (e.target as L.Marker).getLatLng();
              const c = { lat: ll.lat, lng: ll.lng };
              setPos(c);
              onPick?.(c);
            },
          }}
        />
        {onPick && <MapClickHandler onPick={onPick} />}
      </MapContainer>
    </div>
  );
}
