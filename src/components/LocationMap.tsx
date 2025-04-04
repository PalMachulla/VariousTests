"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Custom marker icon with a vibrant color that matches our new design
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "marker-pulse", // We'll add a pulse animation to the marker
});

// Custom marker that stays centered on the map
function CenterMarker() {
  const map = useMapEvents({
    move: () => {
      // This empty handler ensures the map is reactive
    },
  });

  return <Marker position={map.getCenter()} icon={icon} interactive={false} />;
}

// MapEvents component to handle map interactions
function MapEvents({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onLocationChange(center.lat, center.lng);
    },
  });

  return null;
}

interface LocationMapProps {
  initialLat: number;
  initialLng: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
  width?: string;
}

export default function LocationMap({
  initialLat = 59.5225,
  initialLng = 10.6866,
  onLocationChange,
  height = "100%",
  width = "100%",
}: LocationMapProps) {
  // Use state to avoid hydration mismatch issues
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Fix for leaflet icon issues in Next.js
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    });

    // Add custom CSS for the pulsing marker
    const style = document.createElement("style");
    style.innerHTML = `
      .marker-pulse {
        animation: marker-pulse 1.5s ease-out infinite;
      }
      @keyframes marker-pulse {
        0% {
          filter: drop-shadow(0 0 0 #ffee00);
        }
        70% {
          filter: drop-shadow(0 0 10px rgba(180, 148, 255, 0));
        }
        100% {
          filter: drop-shadow(0 0 1px rgba(180, 148, 255, 0));
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!mounted)
    return <div style={{ height, width, backgroundColor: "#2d2d2d" }}></div>;

  return (
    <div style={{ height, width, position: "relative" }}>
      <MapContainer
        center={[initialLat, initialLng]}
        zoom={13}
        style={{ height: "100%", width: "100%", borderRadius: "inherit" }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CenterMarker />
        <MapEvents onLocationChange={onLocationChange} />
      </MapContainer>
      <div className="absolute bottom-3 left-0 right-0 text-center text-xs bg-[#1E1E1E] text-[#ffee00] font-medium py-2 mx-auto w-max px-4 rounded-full shadow-lg">
        Drag to set location
      </div>
    </div>
  );
}
