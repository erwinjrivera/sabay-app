import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import { ArrowLeft, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Component to handle map movement
function MapMover({ setCenterCoords, initialZoom, userCoords }) {
  const map = useMap();
  
  // Set initial view once userCoords is available
  useEffect(() => {
    if (userCoords) {
      map.setView([userCoords.lat, userCoords.lng], initialZoom);
      setCenterCoords(userCoords);
    }
  }, [userCoords, map, initialZoom]);

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      setCenterCoords({ lat: center.lat, lng: center.lng });
    }
  });
  return null;
}

export default function ChooseOnMap() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  
  // Fallback defaults if accessed directly
  const activeField = state?.activeField || 'from';
  const findState = state?.findState || null;
  const sourceMode = state?.sourceMode || 'find';
  const initialZoom = activeField === 'from' ? 16 : 12;

  const [userCoords, setUserCoords] = useState(null); 
  const [centerCoords, setCenterCoords] = useState(null);
  
  const debouncedCoords = useDebounce(centerCoords, 600);
  
  const [addressData, setAddressData] = useState({ title: 'Locating...', sub: 'Please wait' });
  const [isResolving, setIsResolving] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // 1. Fetch User Coords on Mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
           // Default to Manila
          setUserCoords({ lat: 14.5995, lng: 120.9842 });
        }
      );
    } else {
      setUserCoords({ lat: 14.5995, lng: 120.9842 });
    }
  }, []);

  // 2. Reverse Geocode when center stops moving (debounced)
  useEffect(() => {
    let active = true;
    const fetchAddress = async () => {
      if (!debouncedCoords) return;
      setIsResolving(true);
      setAddressData({ title: 'Scanning Map...', sub: 'Searching...' });
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${debouncedCoords.lat}&lon=${debouncedCoords.lng}&format=json`);
        const data = await res.json();
        if (active) {
          const parts = data.display_name?.split(',').map(s => s.trim()) || [];
          const primaryTitle = parts[0] || 'Unknown Area';
          const subtitleText = parts.slice(1).join(', ') || 'Philippines';
          
          setAddressData({
            title: primaryTitle,
            sub: subtitleText
          });
          setIsResolving(false);
        }
      } catch (err) {
         if (active) {
           setAddressData({ title: 'Unknown Area', sub: 'Could not resolve address' });
           setIsResolving(false);
         }
      }
    };
    fetchAddress();
    return () => { active = false; };
  }, [debouncedCoords]);

  const handleConfirm = () => {
     let fullAddress = addressData.title;
     if (addressData.sub && addressData.sub !== 'Philippines') {
       fullAddress = `${addressData.title}, ${addressData.sub}`;
     }
       
     navigate(`/${sourceMode}`, { 
       state: { 
         updatedField: activeField, 
         address: fullAddress, 
         title: addressData.title,
         desc: addressData.sub,
         lat: centerCoords.lat,
         lon: centerCoords.lng,
         originalFindState: findState 
       } 
     });
  };

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      {/* HEADER OVERLAY */}
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 1000}}>
        <button 
           onClick={() => {
             navigate(`/${sourceMode}`, { 
               state: { 
                 originalFindState: findState, 
                 restoreOnly: true, 
                 activeField 
               } 
             });
           }}
           style={{ background: 'white', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} color="#333" />
        </button>
      </div>

      {/* MAP */}
      <MapContainer 
        center={[14.5995, 120.9842]} 
        zoom={initialZoom} 
        zoomControl={false}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapMover setCenterCoords={setCenterCoords} initialZoom={initialZoom} userCoords={userCoords} />
      </MapContainer>

      {/* FIXED PIN OVERLAY */}
      <div style={{
         position: 'absolute', 
         top: '50%', 
         left: '50%', 
         transform: 'translate(-50%, -100%)', 
         zIndex: 1000,
         pointerEvents: 'none',
         filter: 'drop-shadow(0px 8px 6px rgba(0,0,0,0.3))'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="#ea4335" stroke="#ea4335" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" fill="white" stroke="white" />
        </svg>
      </div>

      {/* BOTTOM ACTION DRAWER */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom)) 1.5rem', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', margin: '0 0 0.2rem', color: '#111', fontWeight: 700 }}>{addressData.title}</h2>
          <p style={{ fontSize: '0.9rem', color: '#777', margin: '0 0 1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{addressData.sub}</p>
          
          <button 
             className="fr-submit-btn" 
             style={{ 
               backgroundColor: isResolving ? '#d1d5db' : '',
               cursor: isResolving ? 'default' : 'pointer'
             }}
             disabled={isResolving}
             onClick={handleConfirm}
          >
            {sourceMode === 'offer'
               ? (activeField === 'from' ? 'Confirm Starting Location' : 'Confirm Destination')
               : (activeField === 'from' ? 'Confirm this Pickup' : 'Confirm this Drop Off')
            }
          </button>
      </div>
    </div>
  );
}
