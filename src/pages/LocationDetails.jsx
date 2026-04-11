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
         lon: coords.lon
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
    <div style={{ backgroundColor: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
       {/* HEADER */}
       <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
             onClick={() => navigate(-1)}
             style={{ background: '#757575', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            <ArrowLeft size={24} color="#fff" />
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {isSaved && (
              <button 
                 onClick={() => navigate('/add-saved-place', { state: { item, findState, activeField, sourceMode, editMode: true, savedData } })}
                 style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              >
                <Pencil size={20} color="#333" />
              </button>
            )}
            <button 
               onClick={handleHeartClick}
               style={{ background: isSaved ? '#00b0f0' : '#757575', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              <Heart size={20} color="#fff" fill={isSaved ? '#fff' : 'none'} />
            </button>
          </div>
       </div>

       {/* CONTENT */}
       <div style={{ padding: '0 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '1.4rem', color: '#111', margin: '0 0 0.5rem', fontWeight: 700 }}>
             {item.title}
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#555', margin: '0 0 2rem', lineHeight: 1.4 }}>
             {item.desc}
          </p>

          {/* Details Circle Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
             <div style={{ width: '60px', height: '60px', background: '#555', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={28} color="#fff" />
             </div>
          </div>

          {/* Details Partition */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
             <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
             <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#111' }}>Details</h3>
             <div style={{ flex: 1, height: '1px', background: '#eaeaea' }}></div>
          </div>
          
          <p style={{ textAlign: 'center', color: '#555', fontSize: '0.9rem', marginBottom: '2rem' }}>
             residential
          </p>

          {/* MINIMAP */}
          {isFetchingMap ? (
             <div style={{ flex: 1, minHeight: '180px', borderRadius: '12px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <p style={{ color: '#888' }}>Scanning map coordinates...</p>
             </div>
          ) : coords.lat && coords.lon ? (
             <div style={{ flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem' }}>
                <MapContainer 
                  center={[coords.lat, coords.lon]} 
                  zoom={15} 
                  zoomControl={false}
                  style={{ flex: 1, width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <Marker position={[coords.lat, coords.lon]} icon={customMapPin} />
                </MapContainer>
             </div>
          ) : (
             <div style={{ flex: 1, minHeight: '180px', borderRadius: '12px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <p style={{ color: '#888' }}>Map area unmappable</p>
             </div>
          )}

       </div>

       {/* ACTION BUTTON */}
       <div style={{ padding: '1.5rem', paddingBottom: '2.5rem', background: '#fff', position: 'sticky', bottom: 0, marginTop: 'auto' }}>
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
