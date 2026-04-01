import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MessageCircle, MoreHorizontal, User, Check, List, Star, Phone } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Default Icon Issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const driverIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#00b0f0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#fff"></circle></svg>'),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const passengerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#555" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#fff"></circle></svg>'),
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const pickupSpotIcon = new L.DivIcon({
  className: 'custom-pickup-dot',
  html: '<div style="width:14px;height:14px;background:#00b0f0;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// Mock Matches array perfectly replicating Manila geographic logic alongside UI states
const MOCK_MATCHES = [
  {
     id: 'm1',
     type: 'confirmed',
     name: 'Ole Christiansen',
     time: '3:38pm',
     price: '85.00 ₱',
     rating: 4.9,
     reviews: 20,
     seats: 1,
     profilePic: 'https://i.pravatar.cc/150?u=ole',
     pickup: { lat: 14.5532, lon: 121.0500 },
     dropoff: { lat: 14.5560, lon: 121.0300 }
  },
  {
     id: 'm2',
     type: 'match',
     name: 'Laura Franklyn',
     time: '3:41pm',
     price: '120.50 ₱',
     rating: 2.9,
     reviews: 5,
     seats: 2,
     profilePic: 'https://i.pravatar.cc/150?u=laura',
     pickup: { lat: 14.5500, lon: 121.0550 },
     dropoff: { lat: 14.5580, lon: 121.0200 }
  },
  {
     id: 'm3',
     type: 'request',
     name: 'Martin Oberhäuser',
     time: '3:58pm',
     price: '90.00 ₱',
     rating: 4.9,
     reviews: 20,
     seats: 1,
     profilePic: 'https://i.pravatar.cc/150?u=martin',
     pickup: { lat: 14.5570, lon: 121.0450 }, 
     dropoff: { lat: 14.5520, lon: 121.0250 }
  },
  {
     id: 'm4',
     type: 'declined',
     name: 'Katharina Schmitt',
     time: '3:38pm',
     price: '110.00 ₱',
     rating: null,
     reviews: 0,
     seats: 1,
     profilePic: 'https://i.pravatar.cc/150?u=kat',
     pickup: { lat: 14.5600, lon: 121.0600 }, 
     dropoff: { lat: 14.5400, lon: 121.0100 }
  }
];

// Map Focus Adjuster Component
function MapAdjuster({ route1, route2 }) {
  const map = useMap();
  useEffect(() => {
    if (route1 && route1.length > 0) {
      const bounds = L.latLngBounds(route1);
      if (route2 && route2.length > 0) {
        route2.forEach(p => bounds.extend(p));
      }
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [route1, route2, map]);
  return null;
}


export default function OfferMatches() {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  
  const [driverRoute, setDriverRoute] = useState([]);
  const [activePassengerId, setActivePassengerId] = useState(MOCK_MATCHES[0].id);
  const [passengerRoutes, setPassengerRoutes] = useState({});

  // Mock exact driver coordinates (BGC to Makati CBD)
  const driverFrom = { lat: 14.5552, lon: 121.0535 };
  const driverTo = { lat: 14.5547, lon: 121.0244 };
  
  // Fetch Driver Route once on mount
  useEffect(() => {
    const fetchDriverRoute = async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverFrom.lon},${driverFrom.lat};${driverTo.lon},${driverTo.lat}?geometries=geojson`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setDriverRoute(coords);
      } catch (err) {
        console.error("OSRM Driver Route Error", err);
      }
    };
    fetchDriverRoute();
  }, []);

  // Fetch Passenger Route dynamically based on active selection
  useEffect(() => {
    const activePass = MOCK_MATCHES.find(m => m.id === activePassengerId);
    if (!activePass || passengerRoutes[activePassengerId]) return;

    const fetchPassenger = async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${activePass.pickup.lon},${activePass.pickup.lat};${activePass.dropoff.lon},${activePass.dropoff.lat}?geometries=geojson`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setPassengerRoutes(prev => ({ ...prev, [activePassengerId]: coords }));
      } catch (err) {
        console.error("OSRM Passenger Error", err);
      }
    };
    fetchPassenger();
  }, [activePassengerId, passengerRoutes]);

  // Carousel Scroll Intersection Logic detecting centered card
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = window.innerWidth * 0.85; // Roughly the width of a snap card
    const activeIndex = Math.round(scrollLeft / cardWidth);
    if (MOCK_MATCHES[activeIndex]) {
      setActivePassengerId(MOCK_MATCHES[activeIndex].id);
    }
  };

  const activePassenger = MOCK_MATCHES.find(m => m.id === activePassengerId);
  const activePassRoute = passengerRoutes[activePassengerId] || [];

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden', background: '#eaeaea' }}>
      
      {/* BACKGROUND MAP */}
      <MapContainer 
        center={[14.5552, 121.0400]} 
        zoom={14} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
           url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
           attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* DRIVER ROUTE (Sabay Blue) */}
        {driverRoute.length > 0 && (
          <>
            <Polyline positions={driverRoute} color="#00b0f0" weight={5} opacity={0.8} />
            <Marker position={[driverFrom.lat, driverFrom.lon]} icon={driverIcon} />
            <Marker position={[driverTo.lat, driverTo.lon]} icon={driverIcon} />
          </>
        )}

        {/* PASSENGER OVERLAY & INTERCEPTS */}
        {activePassRoute.length > 0 && (
          <>
            {/* Main passenger transit path (Grey line) */}
            <Polyline positions={activePassRoute} color="#888" weight={4} opacity={0.7} />
            
            {/* Dotted theoretical intercept lines from Passenger Origin -> Nearest Driver node (For UI visual mockup) */}
            {driverRoute.length > 0 && (
               <Polyline 
                 positions={[[activePassenger.pickup.lat, activePassenger.pickup.lon], driverRoute[Math.floor(driverRoute.length * 0.2)]]} 
                 color="#888" 
                 weight={3} 
                 dashArray="5, 10" 
                 opacity={0.8}
               />
            )}
            {/* Dotted theoretical intercept line from Driver -> Dropoff */}
            {driverRoute.length > 0 && (
               <Polyline 
                 positions={[driverRoute[Math.floor(driverRoute.length * 0.8)], [activePassenger.dropoff.lat, activePassenger.dropoff.lon]]} 
                 color="#888" 
                 weight={3} 
                 dashArray="5, 10" 
                 opacity={0.8}
               />
            )}

            {/* Passenger endpoints and Pick up nodes */}
            <Marker position={[activePassenger.pickup.lat, activePassenger.pickup.lon]} icon={passengerIcon} />
            <Marker position={[activePassenger.dropoff.lat, activePassenger.dropoff.lon]} icon={passengerIcon} />
            {driverRoute.length > 0 && <Marker position={driverRoute[Math.floor(driverRoute.length * 0.2)]} icon={pickupSpotIcon} />}
            {driverRoute.length > 0 && <Marker position={driverRoute[Math.floor(driverRoute.length * 0.8)]} icon={pickupSpotIcon} />}
          </>
        )}

        <MapAdjuster route1={driverRoute} route2={activePassRoute} />
      </MapContainer>

      {/* TOP OVERLAYS */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        {/* Dark Navbar */}
        <div style={{ background: 'rgba(40,45,50,0.9)', padding: '1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: '#fff' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Offer Ride</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>3:45pm, Sep. 18th</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <User size={16} color="#ccc" fill="#ccc" />
              <User size={16} color="#ccc" fill="#ccc" />
              <User size={16} color="#ccc" fill="#ccc" />
              <User size={16} color="#555" fill="#555" />
            </div>
            <MessageCircle size={20} />
            <MoreHorizontal size={20} />
          </div>
        </div>

        {/* Address Overlay Strip */}
        <div style={{ background: 'rgba(40,45,50,0.9)', padding: '0 1rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: 8, height: 8, background: '#888', borderRadius: '50%' }}></div>
             <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Uptown Mall, Fort Bonifacio</span>
           </div>
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        
        {/* Floating Menu Button */}
        <div style={{ padding: '1rem' }}>
          <div style={{ background: '#fff', width: 40, height: 40, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <List size={20} color="#555" />
          </div>
        </div>
      </div>


      {/* HORIZONTAL MATCH CAROUSEL */}
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        style={{ 
          position: 'absolute', 
          bottom: '2rem', 
          width: '100%', 
          display: 'flex', 
          overflowX: 'auto', 
          scrollSnapType: 'x mandatory',
          padding: '0 20px', // Extra padding for the ends
          boxSizing: 'border-box',
          gap: '12px',
          zIndex: 1000,
          scrollbarWidth: 'none', // Hide scrollbar Firefox
          MsOverflowStyle: 'none' // Hide scrollbar IE
        }}
        className="hide-scrollbar"
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        
        {MOCK_MATCHES.map((match) => (
          <div 
            key={match.id}
            style={{ 
              minWidth: '85vw', 
              maxWidth: '85vw',
              background: '#fff', 
              borderRadius: '8px', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              scrollSnapAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Top Info Row */}
            <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', position: 'relative' }}>
               
               {/* Confirmed Match Green Strip */}
               {match.type === 'confirmed' && (
                 <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '32px', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={16} color="#fff" strokeWidth={3} />
                 </div>
               )}

               <div style={{ marginLeft: match.type === 'confirmed' ? '24px' : '0' }}>
                 <img src={match.profilePic} alt={match.name} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} />
               </div>
               
               <div style={{ flex: 1 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: match.type === 'match' ? '#00b0f0' : match.type === 'request' ? '#ea4335' : '#888', fontWeight: 600 }}>
                   {match.time}
                 </p>
                 <h3 style={{ margin: '2px 0', fontSize: '1rem', fontWeight: 600, color: '#222' }}>
                   {match.name}
                 </h3>
                 
                 {/* Rating & Subtitle Line */}
                 {match.type === 'declined' ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                     <Star size={12} fill="#555" color="#555" />
                     <p style={{ margin: 0, fontSize: '0.85rem', color: '#ea4335', fontWeight: 600, marginLeft: '6px' }}>Offer Declined</p>
                   </div>
                 ) : (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                     <Star size={12} fill="#eab308" color="#eab308" />
                     <Star size={12} fill="#eab308" color="#eab308" />
                     <Star size={12} fill="#eab308" color="#eab308" />
                     <Star size={12} fill="#eab308" color="#eab308" />
                     <Star size={12} fill="#eaeaea" color="#eaeaea" />
                     <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px' }}>{match.rating} ({match.reviews})</span>
                   </div>
                 )}
               </div>

               <div style={{ textAlign: 'right' }}>
                  {match.type === 'match' || match.type === 'request' ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        <User size={12} fill="#00b0f0" color="#00b0f0" />
                        {match.seats > 1 && <User size={12} fill="#00b0f0" color="#00b0f0" />}
                     </div>
                  ) : null}
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>{match.price}</p>
               </div>
            </div>

            {/* Bottom Button Row */}
            <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0' }}>
               
               {/* State 1: Confirmed Match */}
               {match.type === 'confirmed' && (
                 <>
                   <button style={{ flex: 1, padding: '16px', background: '#fff', border: 'none', borderRight: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555', fontWeight: 600, cursor: 'pointer' }}>
                     <MessageCircle size={18} fill="#999" color="#999" /> Chat
                   </button>
                   <button style={{ flex: 1, padding: '16px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555', fontWeight: 600, cursor: 'pointer' }}>
                     <Phone size={18} fill="#999" color="#999" /> Call
                   </button>
                 </>
               )}

               {/* State 2: Match -> Offer Ride */}
               {match.type === 'match' && (
                 <>
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button style={{ flex: 1, padding: '16px', background: '#00b0f0', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Offer Ride
                   </button>
                 </>
               )}

               {/* State 3: Request -> Accept */}
               {match.type === 'request' && (
                 <>
                   <button style={{ position: 'relative', width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                     <div style={{ position: 'absolute', top: 8, right: 8, background: '#ea4335', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333' }}>1</div>
                   </button>
                   <button style={{ flex: 1, padding: '16px', background: '#ea4335', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Accept
                   </button>
                 </>
               )}

               {/* State 4: Declined -> Dismiss */}
               {match.type === 'declined' && (
                 <button style={{ flex: 1, padding: '16px', background: '#fff', border: 'none', color: '#555', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                   Dismiss
                 </button>
               )}

            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
