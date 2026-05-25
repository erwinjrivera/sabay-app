import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { ArrowLeft, Heart, Building2, Pencil } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Fix typical leaflet native icon bug inside React modules
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Distance Helpers
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = deg2rad(lat2-lat1);  
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
function deg2rad(deg) { return deg * (Math.PI/180); }

const customMapPin = L.divIcon({
  html: `<svg width="40" height="40" viewBox="0 0 24 24" fill="#ea4335" stroke="#ea4335" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3" fill="white" stroke="white"></circle></svg>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

export default function LocationDetails() {
  const navigate = useNavigate();
  const { state, key } = useLocation();

  const item = state?.item || { title: 'Unknown Area', desc: 'No geography found', lat: undefined, lon: undefined };
  const findState = state?.findState || null;
  const activeField = state?.activeField || 'from';
  const sourceMode = state?.sourceMode || 'find';

  const [coords, setCoords] = useState({ lat: item.lat, lon: item.lon });
  const [isFetchingMap, setIsFetchingMap] = useState(!item.lat || !item.lon);
  const [isSaved, setIsSaved] = useState(false);
  const [savedData, setSavedData] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);

  // Distance calculator effect
  useEffect(() => {
    if (coords.lat && coords.lon && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const d = getDistanceFromLatLonInKm(
          pos.coords.latitude, pos.coords.longitude, 
          coords.lat, coords.lon
        );
        setDistanceKm(d.toFixed(1));
      }, () => {});
    }
  }, [coords]);

  // Check if item is saved
  useEffect(() => {
    const savedStr = localStorage.getItem(`sabay_${sourceMode}_saved`);
    if (savedStr) {
      const places = JSON.parse(savedStr);
      const found = places.find(p => p.title === item.title && p.desc === item.desc);
      if (found) {
         setIsSaved(true);
         setSavedData(found);
      } else {
         setIsSaved(false);
         setSavedData(null);
      }
    } else {
      setIsSaved(false);
      setSavedData(null);
    }
  }, [item, key]);

  useEffect(() => {
    // If coords are natively passed, do not fetch
    if (item.lat && item.lon) {
       setCoords({ lat: item.lat, lon: item.lon });
       setIsFetchingMap(false);
       return;
    }
    
    // Attempt aggressive forward geocoding on legacy strings
    const fetchCoords = async () => {
       try {
          const query = item.desc && item.desc !== 'Philippines' ? `${item.title}, ${item.desc}` : item.title;
          let res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Philippines')}&format=json&limit=1`);
          let data = await res.json();
          if (data && data.length > 0) {
             setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
             return;
          }
          
          // Secondary loose fallback sweep for heavily restricted queries
          res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(item.title + ', Philippines')}&format=json&limit=1`);
          data = await res.json();
          if (data && data.length > 0) {
             setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
       } catch (err) {
          console.error('Forward geocoding error', err);
       } finally {
          setIsFetchingMap(false);
       }
    };
    
    if (isFetchingMap) fetchCoords();
  }, [item]);

  const handleSelect = () => {
     const fullAddress = item.desc && item.desc !== 'Philippines' ? `${item.title}, ${item.desc}` : item.title;
     
     navigate(`/${sourceMode}`, { 
       state: { 
         updatedField: activeField, 
         address: fullAddress, 
         originalFindState: findState,
         title: item.title,
         desc: item.desc,
         lat: coords.lat,
         lon: coords.lon,
         type: item.type
       } 
     });
  };

  const handleHeartClick = () => {
    if (isSaved) {
      const savedStr = localStorage.getItem(`sabay_${sourceMode}_saved`);
      if (savedStr) {
        const places = JSON.parse(savedStr);
        const newPlaces = places.filter(p => !(p.title === item.title && p.desc === item.desc));
        localStorage.setItem(`sabay_${sourceMode}_saved`, JSON.stringify(newPlaces));
        setIsSaved(false);
      }
    } else {
      navigate('/add-saved-place', { state: { item, findState, activeField, sourceMode } });
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
       {/* Background FULLSCREEN map */}
       <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, background: '#0f172a' }}>
          {isFetchingMap ? (
             <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#94a3b8' }}>Scanning map coordinates...</p>
             </div>
          ) : coords.lat && coords.lon ? (
             <MapContainer 
               center={[coords.lat, coords.lon]} 
               zoom={18} 
               zoomControl={false}
               style={{ width: '100%', height: '100dvh' }}
             >
               <TileLayer
                 url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                 attribution='&copy; OpenStreetMap'
               />
               <Marker position={[coords.lat, coords.lon]} icon={customMapPin} />
             </MapContainer>
          ) : (
             <p style={{ color: '#888' }}>Map area unmappable</p>
          )}
       </div>

       {/* HEADER */}
       <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(22, 26, 30, 0.7)', zIndex: 10, backdropFilter: 'blur(5px)', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
          <button 
             onClick={() => {
                if (findState) {
                   navigate(`/${sourceMode}`, { 
                      state: { 
                         restoreOnly: true, 
                         originalFindState: findState, 
                         activeField 
                      }
                   });
                } else {
                   navigate(-1);
                }
             }}
             style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '1rem' }}
          >
            <ArrowLeft size={24} color="#fff" />
          </button>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
             <h1 style={{ fontSize: '1.2rem', color: '#fff', margin: '0 0 0.2rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Location Details
             </h1>
             <p style={{ fontSize: '0.85rem', color: '#bbb', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title}
             </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginLeft: '1rem' }}>
            {isSaved && (
              <button 
                 onClick={() => navigate('/add-saved-place', { state: { item, findState, activeField, sourceMode, editMode: true, savedData } })}
                 style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <Pencil size={20} color="#fff" />
              </button>
            )}
            <button 
               onClick={handleHeartClick}
               style={{ background: isSaved ? '#00b0f0' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <Heart size={20} color="#fff" fill={isSaved ? '#fff' : 'none'} />
            </button>
          </div>
       </div>

       {/* ACTION DRAWER */}
       <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(22, 26, 30, 0.7)', borderTop: '1px solid rgba(255, 255, 255, 0.15)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom)) 1.5rem', zIndex: 10, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}>
          {/* Details Circle Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
             <div style={{ width: '60px', height: '60px', background: '#334155', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={28} color="#e2e8f0" />
             </div>
          </div>

          {/* Details Partition */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
             <div style={{ flex: 1, height: '1px', background: '#475569' }}></div>
             <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>Details</h3>
             <div style={{ flex: 1, height: '1px', background: '#475569' }}></div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                {item.type ? item.type.replace(/_/g, ' ') : 'Location area'}
             </p>
             {distanceKm && (
               <>
                 <span style={{ color: '#475569', fontSize: '0.8rem' }}>•</span>
                 <p style={{ margin: 0, color: '#00b0f0', fontSize: '0.9rem', fontWeight: 600 }}>
                    {distanceKm} km away
                 </p>
               </>
             )}
          </div>

          <h1 style={{ fontSize: '1.4rem', color: '#f8fafc', margin: '0 0 0.5rem', fontWeight: 700, textAlign: 'center' }}>
             {item.title}
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 2rem', lineHeight: 1.4, textAlign: 'center' }}>
             {item.desc}
          </p>

          <button 
             className="fr-submit-btn" 
             onClick={handleSelect}
             style={{ width: '100%' }}
          >
             Select Location
          </button>
       </div>
    </div>
  );
}
