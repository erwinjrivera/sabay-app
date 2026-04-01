import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function LocationMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);
  return position === null ? null : (
    <Marker position={position} icon={customIcon}></Marker>
  )
}

const customIcon = L.divIcon({
  className: 'custom-user-icon',
  html: '<div class="user-accuracy" style="width: 150px; height: 150px;"></div><div class="user-marker"></div>',
  iconSize: [0, 0]
});

export default function MapBackground() {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.log(err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const defaultCenter = [14.5995, 120.9842]; // Manila default

  return (
    <div className="map-canvas">
      <MapContainer 
        center={defaultCenter} 
        zoom={14} 
        zoomControl={false} 
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />
        <LocationMarker position={position} />
      </MapContainer>
    </div>
  );
}
