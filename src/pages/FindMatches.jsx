import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MessageCircle, MoreHorizontal, User, Check, List, Star, Phone, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';

function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

// Fix Leaflet Default Icon Issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const passengerIcon = new L.DivIcon({
  className: 'custom-driver-flag',
  html: `<div style="background:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:2px solid #ddd;box-shadow:0 3px 6px rgba(0,0,0,0.15);">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
             <line x1="4" y1="22" x2="4" y2="15"></line>
           </svg>
         </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const getDriverStartIcon = (type) => new L.DivIcon({
  className: 'custom-pass-start-dot',
  html: `<div style="width:16px;height:16px;background:${type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : '#888'};border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px ${type === 'match' ? 'rgba(0,176,240,0.6)' : type === 'offered' ? 'rgba(234,179,8,0.6)' : 'rgba(136,136,136,0.6)'};"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const passengerStartIcon = new L.DivIcon({
  className: 'custom-driver-start-dot',
  html: `<div style="width:16px;height:16px;background:#555;border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px rgba(85,85,85,0.6);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getDriverEndIcon = (type) => new L.DivIcon({
  className: 'custom-end-pin',
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="${type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : '#888'}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const pickupSpotIcon = new L.DivIcon({
  className: 'custom-pickup-dot',
  html: '<div style="width:14px;height:14px;background:#00b0f0;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const getMeetSpotIcon = (type) => new L.DivIcon({
  className: 'custom-meet-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getMeetDropSpotIcon = (type) => new L.DivIcon({
  className: 'custom-meet-drop-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

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

export default function FindMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const carouselRef = useRef(null);
  const geometryCache = useRef({});
  
  const ride = location.state?.ride;
  
  const [passengerRoute, setPassengerRoute] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [activeDriverId, setActiveDriverId] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);

  // Parse exact passenger coordinates bound intrinsically to real ride payloads
  const passengerFrom = ride?.from ? { lat: ride.from.lat, lon: ride.from.lon } : { lat: 14.5552, lon: 121.0535 };
  const passengerTo = ride?.to ? { lat: ride.to.lat, lon: ride.to.lon } : { lat: 14.5547, lon: 121.0244 };
  
  // Format dynamic timestamps matching structural design spec
  const rideTimeStr = ride?.time ? dayjs(ride.time).format('h:mma') : '3:45pm';
  const rideDateStr = ride?.date ? dayjs(ride.date).format('MMM. D') : 'Sep. 18th';
  
  // Fetch Passenger Route once on mount
  useEffect(() => {
    const fetchPassengerRoute = async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${passengerFrom.lon},${passengerFrom.lat};${passengerTo.lon},${passengerTo.lat}?geometries=geojson&overview=full`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setPassengerRoute(coords);
      } catch (err) {
        console.error("OSRM Passenger Route Error", err);
      }
    };
    fetchPassengerRoute();
  }, []);

  // Matching Engine: Fetch and filter drivers dynamically
  useEffect(() => {
    if (passengerRoute.length === 0) return;

    setIsLoadingMatches(true);
    const reqRef = collection(db, 'rideOffers');
    
    const unsubscribe = onSnapshot(reqRef, async (snap) => {
        const reqDocs = [];
        snap.forEach(doc => reqDocs.push({ id: doc.id, ...doc.data() }));

        const matchPromises = reqDocs.map(async (req) => {
           if (!req.from?.lat || !req.to?.lat) return null;
           if (ride?.userId && req.userId === ride.userId) return null; // Prevent self-matching
           
           const typeStatus = req.status === 'confirmed' ? 'confirmed' : req.status === 'offered' ? 'offered' : 'match';
           const nameParams = req.userName || 'Erwin Rivera';
           const timeParams = req.time ? dayjs(req.time).format('h:mma') : 'Any time';
           const ratingParams = req.userRating || '0.0';

           // PREVENT API SPAM - INSTANT CACHE YIELDING LOCALLY
           if (geometryCache.current[req.id]) {
               return {
                   ...geometryCache.current[req.id],
                   type: typeStatus,
                   name: nameParams,
                   time: timeParams,
                   rating: ratingParams,
                   reviews: req.userReviews || 0,
                   seats: req.seats || 1,
                   profilePic: req.userProfilePic || '',
                   rawRequest: req
               };
           }

           const pLat = req.from.lat; const pLon = req.from.lon;
           const dLat = req.to.lat;   const dLon = req.to.lon;
           
           try {
              // Extract passenger route dynamically!
              const resDriver = await fetch(`https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?geometries=geojson&overview=full`);
              const driverData = await resDriver.json();
              if (!driverData.routes || driverData.routes.length === 0) return null;
              
              const driverRoute = driverData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              
              // Find intersections! Find the points on the passenger route natively mapping overlaps
              let globalMin = Infinity;
              const distProfile = driverRoute.map((ptP, idxP) => {
                 let minDist = Infinity;
                 let closestDIdx = -1;
                 passengerRoute.forEach((ptD, idxD) => {
                    const dist = getDistanceKM(ptP[0], ptP[1], ptD[0], ptD[1]);
                    if (dist < minDist) { minDist = dist; closestDIdx = idxD; }
                 });
                 if (minDist < globalMin) globalMin = minDist;
                 return { minDist, closestDIdx, passIdx: idxP };
              });

              // Dynamically buffer node sparsity. If paths natively cross but nodes physically sit 80m apart, globalMin evaluates exactly exposing the true intersection natively!
              const overlapThreshold = Math.max(0.04, globalMin + 0.02);
              
              const overlaps = distProfile
                 .filter(pt => pt.minDist <= overlapThreshold)
                 .map(pt => ({ passIdx: pt.passIdx, driverIdx: pt.closestDIdx }));

              // Process match variables
              let pickupIdx = -1, dropIdx = -1, meetPickup = null, meetDropoff = null;
              let interceptPaths = { pickupPath: [], dropoffPath: [] };
              
              // Pre-calculate absolute Euclidean nearest neighbors globally for Disjoint Route Fallbacks
              let minOriginD = Infinity, euclidPickupIdx = -1;
              let minDestD = Infinity, euclidDropIdx = -1;
              passengerRoute.forEach((pt, idx) => {
                  const distP = getDistanceKM(pt[0], pt[1], pLat, pLon);
                  if (distP < minOriginD) { minOriginD = distP; euclidPickupIdx = idx; }
                  const distD = getDistanceKM(pt[0], pt[1], dLat, dLon);
                  if (distD < minDestD) { minDestD = distD; euclidDropIdx = idx; }
              });

              if (overlaps.length > 0) {
                 pickupIdx = Math.min(...overlaps.map(o => o.driverIdx));
                 dropIdx = Math.max(...overlaps.map(o => o.driverIdx));
                 
                 meetPickup = passengerRoute[pickupIdx];
                 meetDropoff = passengerRoute[dropIdx];
                 
                 interceptPaths.pickupPath = passengerRoute.slice(0, pickupIdx + 1);
                 interceptPaths.dropoffPath = passengerRoute.slice(dropIdx);
              } else {
                 // Pure Fallback: If absolutely no true overlap is physically detected, fall back to pure Euclidean origins sweeping
                 if (minOriginD > 5.0 || minDestD > 5.0) return null; // Reject completely out of bounds rides
                 
                 pickupIdx = euclidPickupIdx;
                 dropIdx = euclidDropIdx;
                 meetPickup = passengerRoute[euclidPickupIdx];
                 meetDropoff = passengerRoute[euclidDropIdx];
                 interceptPaths = {
                    pickupPath: passengerRoute.slice(0, pickupIdx + 1),
                    dropoffPath: passengerRoute.slice(dropIdx)
                 };
              }

              // Final sequential sanity check to prevent rides moving backward in time
              if (pickupIdx > dropIdx) return null;

              const geometricPayload = {
                 id: req.id,
                 price: '0.00 ₱', 
                 pickup: { lat: pLat, lon: pLon, address: req.from.address },
                 dropoff: { lat: dLat, lon: dLon, address: req.to.address },
                 meetPickup: { lat: meetPickup[0], lon: meetPickup[1], idx: pickupIdx },
                 meetDropoff: { lat: meetDropoff[0], lon: meetDropoff[1], idx: dropIdx },
                 interceptPaths,
                 driverFullRoute: driverRoute,
                 rawRequest: req
              };

              // Map to local logical memory
              geometryCache.current[req.id] = geometricPayload;

              return {
                 ...geometricPayload,
                 type: typeStatus,
                 name: nameParams,
                 time: timeParams,
                 rating: ratingParams,
                 reviews: req.userReviews || 0,
                 seats: req.seats || 1,
                 profilePic: req.userProfilePic || '',
              };

           } catch (e) {
              console.error("OSRM Pass fetch failure", e);
              return null;
           }
        });
        
        const results = await Promise.all(matchPromises);
        const validMatches = results.filter(m => m !== null);
        
        setMatches(validMatches);
        setIsLoadingMatches(false);
        setActiveDriverId(currentId => {
           if (validMatches.length > 0 && !validMatches.find(m => m.id === currentId)) {
               return validMatches[0].id;
           }
           return currentId || null;
        });
        
    }, (error) => {
        console.error("Match Engine Realtime Error", error);
        setIsLoadingMatches(false);
    });

    return () => unsubscribe();
  }, [passengerRoute, ride?.userId]);

  // Real-time bidirectional matching state sync natively updating passenger match views instantly if a driver reacts
  useEffect(() => {
    if (!ride?.id) return;
    const unsub = onSnapshot(doc(db, 'rideRequests', ride.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'offered' && data.offeredByRideId) {
           setMatches(prev => prev.map(m => m.id === data.offeredByRideId ? { ...m, type: 'offered' } : m));
        }
      }
    });
    return () => unsub();
  }, [ride?.id]);

  // Carousel Scroll Intersection Logic detecting centered card
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = window.innerWidth * 0.85; // Roughly the width of a snap card
    const activeIndex = Math.round(scrollLeft / cardWidth);
    if (matches[activeIndex]) {
      setActiveDriverId(matches[activeIndex].id);
    }
  };

  const activeDriver = matches.find(m => m.id === activeDriverId);
  const activeDriverRoute = activeDriver?.meetPickup && passengerRoute.length > 0
    ? passengerRoute.slice(activeDriver.meetPickup.idx, activeDriver.meetDropoff.idx + 1)
    : [];

  const handleRequestJoin = async (matchId) => {
    // Optimistic generic map transition
    setMatches((prev) => 
      prev.map((m) => m.id === matchId ? { ...m, type: 'request' } : m)
    );
    // Force backend synchronization
    try {
      const matchDocRef = doc(db, 'rideOffers', matchId);
      await updateDoc(matchDocRef, { 
        status: 'request', 
        requestedByRideId: ride?.id || 'unknown' 
      });
    } catch (error) {
      console.error("Join request state synchronization failed:", error);
    }
  };

  const confirmedPassengers = matches.filter(m => m.type === 'confirmed');

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
        
        {/* SWIPED DRIVER BASE ROUTE (Grey) */}
        {activeDriver?.driverFullRoute?.length > 0 && (
          <>
            <Polyline positions={activeDriver.driverFullRoute} pathOptions={{ color: '#555', weight: 5, opacity: 0.8 }} />
            <Marker position={[activeDriver.pickup.lat, activeDriver.pickup.lon]} icon={passengerStartIcon} />
            <Marker position={[activeDriver.dropoff.lat, activeDriver.dropoff.lon]} icon={passengerIcon} />
          </>
        )}

        {/* PASSENGER PERSISTENT ROUTE (Visible if NO matches) */}
        {!activeDriverRoute.length && passengerRoute.length > 0 && (
          <>
            <Polyline positions={passengerRoute} pathOptions={{ color: '#00b0f0', weight: 6, opacity: 0.8 }} />
            <Marker position={[passengerFrom.lat, passengerFrom.lon]} icon={getDriverStartIcon('match')} />
            <Marker position={[passengerTo.lat, passengerTo.lon]} icon={getDriverEndIcon('match')} />
          </>
        )}

        {/* PASSENGER OVERLAY & INTERCEPTS (Colored) */}
        {activeDriverRoute.length > 0 && (
          <>
            {/* Passenger endpoints rendered persistently for context */}
            <Marker position={[passengerFrom.lat, passengerFrom.lon]} icon={getDriverStartIcon(activeDriver.type)} />
            <Marker position={[passengerTo.lat, passengerTo.lon]} icon={getDriverEndIcon(activeDriver.type)} />

            {/* Main passenger transit overlap path (solid Color) */}
            <Polyline positions={activeDriverRoute} pathOptions={{ color: activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#eab308' : activeDriver.type === 'request' ? '#ea4335' : '#888', weight: 6, opacity: 1 }} />
            
            {/* Dotted theoretical intercept lines from Passenger Origin -> Nearest Driver node */}
            {passengerRoute.length > 0 && activeDriver?.meetPickup && (
               <Polyline 
                 positions={activeDriver?.interceptPaths?.pickupPath || [[activeDriver.pickup.lat, activeDriver.pickup.lon], [activeDriver.meetPickup.lat, activeDriver.meetPickup.lon]]} 
                 pathOptions={{ color: activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#eab308' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
               />
            )}

            {/* Meet around here Marker & Tooltip */}
            {activeDriver?.meetPickup && (
              <Marker position={[activeDriver.meetPickup.lat, activeDriver.meetPickup.lon]} icon={getMeetSpotIcon(activeDriver.type)}>
                 <Tooltip 
                    direction="right" 
                    offset={[10, 0]} 
                    opacity={1} 
                    permanent
                 >
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       {activeDriver.profilePic ? (
                          <img src={activeDriver.profilePic} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : (
                          <User size={14} color="#555" />
                       )}
                     </div>
                     <span style={{ fontWeight: 600, color: '#333' }}>Meet around here</span>
                   </div>
                 </Tooltip>
              </Marker>
            )}

            {/* Dotted theoretical intercept line from Driver -> Dropoff */}
            {passengerRoute.length > 0 && activeDriver?.meetDropoff && (
               <Polyline 
                 positions={activeDriver?.interceptPaths?.dropoffPath || [[activeDriver.meetDropoff.lat, activeDriver.meetDropoff.lon], [activeDriver.dropoff.lat, activeDriver.dropoff.lon]]} 
                 pathOptions={{ color: activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#eab308' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
               />
            )}

            {/* Drop off around here Marker & Tooltip */}
            {activeDriver?.meetDropoff && (
              <Marker position={[activeDriver.meetDropoff.lat, activeDriver.meetDropoff.lon]} icon={getMeetDropSpotIcon(activeDriver.type)}>
                 <Tooltip 
                    direction="left" 
                    offset={[-10, 0]} 
                    opacity={1} 
                    permanent
                 >
                   <span style={{ fontWeight: 600, color: '#333' }}>Drop-off point</span>
                 </Tooltip>
              </Marker>
            )}
          </>
        )}

        <MapAdjuster route1={passengerRoute} route2={activeDriver?.driverFullRoute || []} />
      </MapContainer>

      {/* TOP OVERLAYS */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(40,45,50,0.9)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          {/* Dark Navbar */}
          <div style={{ padding: '1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: '#fff' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => navigate('/my-rides')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>Find Ride</span>
                </h1>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>{rideTimeStr}, {rideDateStr}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: ride?.seats || 4 }).map((_, i) => {
                   const isTaken = i < parseInt(ride?.seatsTaken || 0);
                   return (
                     <User key={i} size={16} color={isTaken ? '#555' : '#ccc'} fill={isTaken ? '#555' : '#ccc'} />
                   );
                })}
              </div>
              {/* 
              <MessageCircle size={20} />
              <MoreHorizontal size={20} /> 
              */}
            </div>
          </div>

          {/* Address Overlay Strip */}
          <div 
            onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
            style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', cursor: 'pointer', color: '#fff' }}
          >
            {isHeaderExpanded ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '6px', paddingBottom: '6px' }}>
                     <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: 'transparent', border: '2px solid #888', zIndex: 2 }}></div>
                     <div style={{ width: 1, flex: 1, background: '#555', margin: '4px 0' }}></div>
                     <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: '#888', zIndex: 2 }}></div>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                     <span style={{ fontSize: '0.9rem', color: '#fff', lineHeight: '1.3' }}>
                       {ride?.from?.address || 'Unknown Origin'}
                     </span>
                     <span style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: '1.3' }}>
                       {ride?.to?.address || 'Uptown Mall, Fort Bonifacio'}
                     </span>
                   </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center', marginLeft: '8px' }}>
                   <svg style={{ minWidth: 16, flexShrink: 0, transform: 'rotate(180deg)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                   <div style={{ minWidth: 8, height: 8, background: '#888', borderRadius: '50%' }}></div>
                   <span style={{ fontSize: '0.9rem', color: '#ccc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                     {ride?.to?.address || 'Uptown Mall, Fort Bonifacio'}
                   </span>
                 </div>
                 <svg style={{ minWidth: 16, flexShrink: 0, marginLeft: '8px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            )}
          </div>
        </div>
        
        {/* Floating Menu Button positioned OUTSIDE the grey background logically */}
        <div style={{ padding: '0 1rem 1rem', marginTop: '1rem', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', width: 40, height: 40, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', cursor: 'pointer', pointerEvents: 'auto' }}>
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
          bottom: '56px', 
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
        
        {isLoadingMatches ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', width: '90%', margin: '0 auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}>
            <p style={{ margin: 0, color: '#888', fontWeight: 600 }}>Scanning for ride matches...</p>
          </div>
        ) : matches.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', width: '90%', margin: '0 auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}>
            <p style={{ margin: 0, color: '#555', fontWeight: 600, fontSize: '1.2rem' }}>No Matches Found 😢</p>
            <p style={{ margin: '8px 0 0', color: '#888', fontSize: '0.9rem', lineHeight: '1.4' }}>We couldn't find any passengers looking for a ride along your planned route right now.</p>
          </div>
        ) : (
          matches.map((match) => (
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
                 <img 
                   src={match.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
                   alt="" 
                   onError={(e) => { e.target.onerror = null; e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"; }}
                   style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                 />
               </div>
               
               <div style={{ flex: 1 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : match.type === 'request' ? '#ea4335' : '#888', fontWeight: 600 }}>
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
                     <Star size={12} fill="#eaeaea" color="#eaeaea" />
                     <Star size={12} fill="#eaeaea" color="#eaeaea" />
                     <Star size={12} fill="#eaeaea" color="#eaeaea" />
                     <Star size={12} fill="#eaeaea" color="#eaeaea" />
                     <Star size={12} fill="#eaeaea" color="#eaeaea" />
                     <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px' }}>{match.rating} ({match.reviews})</span>
                   </div>
                 )}
               </div>

               <div style={{ textAlign: 'right' }}>
                  {match.type === 'match' || match.type === 'offered' || match.type === 'request' ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        {Array.from({ length: match.seats || 4 }).map((_, i) => (
                           <User key={i} size={12} fill={match.type === 'offered' ? '#eab308' : '#00b0f0'} color={match.type === 'offered' ? '#eab308' : '#00b0f0'} />
                        ))}
                     </div>
                  ) : null}
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>{match.price}</p>
               </div>
            </div>

            {/* Bottom Button Row */}
            <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0', marginTop: 'auto' }}>
               
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

               {/* State 2: Match -> Request to Join */}
               {match.type === 'match' && (
                 <>
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button onClick={() => handleRequestJoin(match.id)} style={{ flex: 1, padding: '16px', background: '#00b0f0', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Request to Join
                   </button>
                 </>
               )}

               {/* State 3: Request -> Request Sent */}
               {match.type === 'request' && (
                 <>
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button style={{ flex: 1, padding: '16px', background: '#ea4335', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'default' }}>
                     Request Sent
                   </button>
                 </>
               )}

               {/* State 4: Offered -> Accept Offer */}
               {match.type === 'offered' && (
                 <>
                   <button style={{ position: 'relative', width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                     <div style={{ position: 'absolute', top: 8, right: 8, background: '#ff0043', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333' }}>1</div>
                   </button>
                   <button style={{ flex: 1, padding: '16px', background: '#ff0043', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Accept Offer
                   </button>
                 </>
               )}

               {/* State 5: Declined -> Dismiss */}
               {match.type === 'declined' && (
                 <button style={{ flex: 1, padding: '16px', background: '#fff', border: 'none', color: '#555', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                   Dismiss
                 </button>
               )}

             </div>

          </div>
        )))}
      </div>

      {/* BOTTOM ACTION PANEL PULL-UP OVERLAY */}
      <div 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          background: '#f2f4f7', 
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.1)',
          padding: '16px 24px 32px 24px',
          zIndex: 2000,
          transform: isBottomPanelExpanded ? 'translateY(0)' : 'translateY(calc(100% - 40px))',
          transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        {/* Drag Handle Top Bar */}
        <div 
          onClick={() => setIsBottomPanelExpanded(!isBottomPanelExpanded)}
          style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}
        >
           {/* Center Pill */}
           <div style={{ width: '48px', height: '6px', background: '#ccc', borderRadius: '3px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', opacity: isBottomPanelExpanded ? 0 : 1, transition: 'opacity 0.2s' }}></div>
           
           {/* Top Right Close Applet */}
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center', opacity: isBottomPanelExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>
             <X size={24} color="#555" strokeWidth={2.5} />
           </div>
        </div>

        {/* Content (only visible fully when expanded) */}
        <div style={{ width: '100%', marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isBottomPanelExpanded ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isBottomPanelExpanded ? 'auto' : 'none' }}>
           <h3 style={{ margin: '0 0 24px', fontSize: '1.2rem', fontWeight: 800, color: '#111' }}>Cancel your ride request?</h3>
           
           <button 
             onClick={async () => {
               if (window.confirm("Are you sure you want to cancel this ride request?")) {
                 try {
                     if (ride?.id) {
                         await updateDoc(doc(db, 'rideRequests', ride.id), { status: 'cancelled_by_passenger' });
                     }
                     navigate('/my-rides');
                 } catch (e) {
                     console.error("Cancellation error:", e);
                 }
               }
             }}
             style={{ width: '100%', padding: '16px', background: '#ea4335', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
           >
             Cancel Ride
           </button>
        </div>
      </div>

    </div>
  );
}
