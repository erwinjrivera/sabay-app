import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MessageCircle, MoreHorizontal, User, Check, List, Star, Phone, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, getDoc, increment, arrayRemove } from 'firebase/firestore';

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
const driverIcon = new L.DivIcon({
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

const getPassengerStartIcon = (type) => new L.DivIcon({
  className: 'custom-pass-start-dot',
  html: `<div style="width:16px;height:16px;background:${type === 'confirmed' ? '#28ec33' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'};border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px ${type === 'confirmed' ? 'rgba(40,236,51,0.6)' : type === 'match' ? 'rgba(0,176,240,0.6)' : type === 'offered' ? 'rgba(234,179,8,0.6)' : type === 'request' ? 'rgba(255,0,67,0.6)' : 'rgba(136,136,136,0.6)'};"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const driverStartIcon = new L.DivIcon({
  className: 'custom-driver-start-dot',
  html: `<div style="width:16px;height:16px;background:#555;border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px rgba(85,85,85,0.6);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getPassengerEndIcon = (type) => new L.DivIcon({
  className: 'custom-end-pin',
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="${type === 'confirmed' ? '#28ec33' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>`,
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
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'confirmed' ? '#28ec33' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getMeetDropSpotIcon = (type) => new L.DivIcon({
  className: 'custom-meet-drop-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'confirmed' ? '#28ec33' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
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


export default function OfferMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const carouselRef = useRef(null);
  const geometryCache = useRef({});
  
  const ride = location.state?.ride;
  
  const [driverRoute, setDriverRoute] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [activePassengerId, setActivePassengerId] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRetractOfferModal, setShowRetractOfferModal] = useState(false);
  const [matchToRetract, setMatchToRetract] = useState(null);
  const [showCapacityFullModal, setShowCapacityFullModal] = useState(false);
  const [capacityModalText, setCapacityModalText] = useState("");
  const [showCancelConfirmedModal, setShowCancelConfirmedModal] = useState(false);
  const [confirmedMatchToCancel, setConfirmedMatchToCancel] = useState(null);

  // Parse exact driver coordinates bound intrinsically to real ride payloads
  const driverFrom = ride?.from ? { lat: ride.from.lat, lon: ride.from.lon } : { lat: 14.5552, lon: 121.0535 };
  const driverTo = ride?.to ? { lat: ride.to.lat, lon: ride.to.lon } : { lat: 14.5547, lon: 121.0244 };
  
  // Format dynamic timestamps matching structural design spec
  const rideTimeStr = ride?.time ? dayjs(ride.time).format('h:mma') : '3:45pm';
  const rideDateStr = ride?.date ? dayjs(ride.date).format('MMM. D') : 'Sep. 18th';
  
  // Fetch Driver Route once on mount
  useEffect(() => {
    const fetchDriverRoute = async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverFrom.lon},${driverFrom.lat};${driverTo.lon},${driverTo.lat}?geometries=geojson&overview=full`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setDriverRoute(coords);
      } catch (err) {
        console.error("OSRM Driver Route Error", err);
      }
    };
    fetchDriverRoute();
  }, []);

  // Matching Engine: Fetch and filter passengers dynamically
  useEffect(() => {
    if (driverRoute.length === 0) return;

    setIsLoadingMatches(true);
    const reqRef = collection(db, 'rideRequests');
    
    const unsubscribe = onSnapshot(reqRef, async (snap) => {
        const reqDocs = [];
        snap.forEach(doc => reqDocs.push({ id: doc.id, ...doc.data() }));

        const matchPromises = reqDocs.map(async (req) => {
           if (!req.from?.lat || !req.to?.lat) return null;
           if (ride?.userId && req.userId === ride.userId) return null; // Prevent self-matching
           
           const typeStatus = (req.status === 'confirmed' && req.offeredByRideId === ride?.id) ? 'confirmed' : 
                              (req.status === 'request' && req.offeredByRideId === ride?.id) ? 'request' : 
                              (req.status === 'offered' && req.offeredByRideId === ride?.id) ? 'offered' : 'match';
           const nameParams = req.userName || 'Passenger';
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
              const resPass = await fetch(`https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?geometries=geojson&overview=full`);
              const passData = await resPass.json();
              if (!passData.routes || passData.routes.length === 0) return null;
              
              const passRoute = passData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              
              // Find intersections! Find the points on the passenger route natively mapping overlaps
              let globalMin = Infinity;
              const distProfile = passRoute.map((ptP, idxP) => {
                 let minDist = Infinity;
                 let closestDIdx = -1;
                 driverRoute.forEach((ptD, idxD) => {
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
              passRoute.forEach((pt, idx) => {
                  const distP = getDistanceKM(pt[0], pt[1], driverFrom.lat, driverFrom.lon);
                  if (distP < minOriginD) { minOriginD = distP; euclidPickupIdx = idx; }
                  const distD = getDistanceKM(pt[0], pt[1], driverTo.lat, driverTo.lon);
                  if (distD < minDestD) { minDestD = distD; euclidDropIdx = idx; }
              });

              if (overlaps.length > 0) {
                 const minPassOverlap = overlaps.reduce((min, o) => o.passIdx < min.passIdx ? o : min, overlaps[0]);
                 const maxPassOverlap = overlaps.reduce((max, o) => o.passIdx > max.passIdx ? o : max, overlaps[0]);

                 // Parity block: If the driver intercepts the passenger's destination BEFORE their origin, the paths run inversely!
                 if (minPassOverlap.driverIdx > maxPassOverlap.driverIdx) return null;

                 pickupIdx = minPassOverlap.passIdx;
                 dropIdx = maxPassOverlap.passIdx;
                 
                 meetPickup = passRoute[pickupIdx];
                 meetDropoff = passRoute[dropIdx];
                 
                 interceptPaths.pickupPath = passRoute.slice(0, pickupIdx + 1);
                 interceptPaths.dropoffPath = passRoute.slice(dropIdx);
              } else {
                 if (minOriginD > 5.0 || minDestD > 5.0) return null; 
                 
                 pickupIdx = euclidPickupIdx;
                 dropIdx = euclidDropIdx;
                 meetPickup = passRoute[euclidPickupIdx];
                 meetDropoff = passRoute[euclidDropIdx];
                 interceptPaths = {
                    pickupPath: passRoute.slice(0, pickupIdx + 1),
                    dropoffPath: passRoute.slice(dropIdx)
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
                 sharedPath: passRoute.slice(pickupIdx, dropIdx + 1),
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
        setActivePassengerId(currentId => {
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
  }, [driverRoute, ride?.userId]);



  // Carousel Scroll Intersection Logic detecting centered card
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = window.innerWidth * 0.85; // Roughly the width of a snap card
    const activeIndex = Math.round(scrollLeft / cardWidth);
    if (matches[activeIndex]) {
      setActivePassengerId(matches[activeIndex].id);
    }
  };

  const activePassenger = matches.find(m => m.id === activePassengerId);
  const activePassRoute = activePassenger?.sharedPath || [];

  const handleOfferRide = async (matchId) => {
    const requestedPassenger = matches.find(m => m.id === matchId);
    if (!requestedPassenger) return;

    const passengerSeats = parseInt(requestedPassenger?.seats) || 1;
    const currentTakenSeats = confirmedPassengers.reduce((acc, m) => acc + (parseInt(m.seats)||1), 0);
    const driverMaxSeats = parseInt(ride?.seats) || 4;

    if (currentTakenSeats + passengerSeats > driverMaxSeats) {
      setCapacityModalText(`You cannot offer a ride to this passenger. You only have ${driverMaxSeats - currentTakenSeats} seat(s) left, but the passenger requested ${passengerSeats} seat(s).`);
      setShowCapacityFullModal(true);
      return;
    }

    // Optimistic generic map transition
    setMatches((prev) => 
      prev.map((m) => m.id === matchId ? { ...m, type: 'offered' } : m)
    );
    // Force backend synchronization
    try {
      const matchDocRef = doc(db, 'rideRequests', matchId);
      await updateDoc(matchDocRef, { 
        status: 'offered', 
        offeredByRideId: ride?.id || 'unknown' 
      });
    } catch (error) {
      console.error("Offered request state synchronization failed:", error);
    }
  };

  const handleAcceptRequest = async (matchId) => {
    const requestedPassenger = matches.find(m => m.id === matchId);
    const passengerSeats = parseInt(requestedPassenger?.seats) || 1;
    const currentTakenSeats = confirmedPassengers.reduce((acc, m) => acc + (parseInt(m.seats)||1), 0);
    const driverMaxSeats = parseInt(ride?.seats) || 4;

    if (currentTakenSeats + passengerSeats > driverMaxSeats) {
      setCapacityModalText(`You cannot accept this request. You only have ${driverMaxSeats - currentTakenSeats} seat(s) left, but the passenger requested ${passengerSeats} seat(s).`);
      setShowCapacityFullModal(true);
      return;
    }
    
    setMatches((prev) => 
      prev.map((m) => m.id === matchId ? { ...m, type: 'confirmed' } : m)
    );
    try {
      // Safely sync Driver's global seatsTaken incrementally resolving overflow blocks universally
      const matchDocRef = doc(db, 'rideOffers', ride.id);
      await updateDoc(matchDocRef, { 
        status: 'confirmed',
        seatsTaken: increment(passengerSeats)
      });
      
      // Crucially synchronize Passenger's specific document confirming their exact identity workflow
      const passDocRef = doc(db, 'rideRequests', matchId);
      await updateDoc(passDocRef, {
        status: 'confirmed',
        offeredByRideId: ride.id
      });
    } catch (error) {
      console.error("Accept request state synchronization failed:", error);
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
        
        {/* DRIVER ROUTE */}
        {driverRoute.length > 0 && (
          <>
            <Polyline positions={driverRoute} pathOptions={{ color: '#555', weight: 5, opacity: 0.8 }} />
            <Marker position={[driverFrom.lat, driverFrom.lon]} icon={driverStartIcon} />
            <Marker position={[driverTo.lat, driverTo.lon]} icon={driverIcon} />
          </>
        )}

        {/* PASSENGER OVERLAY & INTERCEPTS */}
        {activePassRoute.length > 0 && (
          <>
            {/* Main passenger transit path */}
            <Polyline positions={activePassRoute} pathOptions={{ color: activePassenger.type === 'confirmed' ? '#28ec33' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888', weight: 6, opacity: 1 }} />
            
            {/* Dotted theoretical intercept lines from Passenger Origin -> Nearest Driver node */}
            {driverRoute.length > 0 && activePassenger?.meetPickup && (
               <Polyline 
                 positions={activePassenger?.interceptPaths?.pickupPath || [[activePassenger.pickup.lat, activePassenger.pickup.lon], [activePassenger.meetPickup.lat, activePassenger.meetPickup.lon]]} 
                 pathOptions={{ color: activePassenger.type === 'confirmed' ? '#28ec33' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
               />
            )}

            {/* Meet around here Marker & Tooltip */}
            {activePassenger?.meetPickup && (
              <Marker position={[activePassenger.meetPickup.lat, activePassenger.meetPickup.lon]} icon={getMeetSpotIcon(activePassenger.type)}>
                 <Tooltip 
                    direction="right" 
                    offset={[10, 0]} 
                    opacity={1} 
                    permanent
                 >
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       {activePassenger.profilePic ? (
                          <img src={activePassenger.profilePic} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            {driverRoute.length > 0 && activePassenger?.meetDropoff && (
               <Polyline 
                 positions={activePassenger?.interceptPaths?.dropoffPath || [[activePassenger.meetDropoff.lat, activePassenger.meetDropoff.lon], [activePassenger.dropoff.lat, activePassenger.dropoff.lon]]} 
                 pathOptions={{ color: activePassenger.type === 'confirmed' ? '#28ec33' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
               />
            )}

            {/* Drop off around here Marker & Tooltip */}
            {activePassenger?.meetDropoff && (
              <Marker position={[activePassenger.meetDropoff.lat, activePassenger.meetDropoff.lon]} icon={getMeetDropSpotIcon(activePassenger.type)}>
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

            {/* Passenger endpoints */}
            <Marker position={[activePassenger.pickup.lat, activePassenger.pickup.lon]} icon={getPassengerStartIcon(activePassenger.type)} />
            <Marker position={[activePassenger.dropoff.lat, activePassenger.dropoff.lon]} icon={getPassengerEndIcon(activePassenger.type)} />
          </>
        )}

        <MapAdjuster route1={driverRoute} route2={activePassRoute} />
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
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Offer Ride</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>{rideTimeStr}, {rideDateStr}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: ride?.seats || 4 }).map((_, i) => {
                   const absoluteConfirmedCount = matches.filter(m => m.type === 'confirmed').reduce((acc, m) => acc + (parseInt(m.seats) || 1), 0);
                   const isTaken = i < absoluteConfirmedCount;
                   return (
                     <User key={i} size={16} color={isTaken ? '#28ec33' : '#ccc'} fill={isTaken ? '#28ec33' : '#ccc'} />
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
               
               <div>
                 <img 
                   src={match.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
                   alt="" 
                   onError={(e) => { e.target.onerror = null; e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"; }}
                   style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                 />
               </div>
               
               <div style={{ flex: 1 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: match.type === 'confirmed' ? '#28ec33' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : match.type === 'request' ? '#ff0043' : '#888', fontWeight: 600 }}>
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
                  {match.type === 'confirmed' || match.type === 'match' || match.type === 'offered' || match.type === 'request' ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        {Array.from({ length: match.seats || 4 }).map((_, i) => (
                           <User key={i} size={12} fill={match.type === 'confirmed' ? '#28ec33' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : '#ff0043'} color={match.type === 'confirmed' ? '#28ec33' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : '#ff0043'} />
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
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button 
                     onClick={() => { setConfirmedMatchToCancel(match.id); setShowCancelConfirmedModal(true); }}
                     style={{ flex: 1, padding: '16px', background: '#28ec33', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Confirmed
                   </button>
                 </>
               )}

               {/* State 2: Match -> Offer Ride */}
               {match.type === 'match' && (
                 <>
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button onClick={() => handleOfferRide(match.id)} style={{ flex: 1, padding: '16px', background: '#00b0f0', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Offer Ride
                   </button>
                 </>
               )}

               {/* State 5: Offered -> Pending Accept */}
               {match.type === 'offered' && (
                 <>
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button 
                     onClick={() => { setMatchToRetract(match.id); setShowRetractOfferModal(true); }}
                     style={{ flex: 1, padding: '16px', background: '#eab308', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                   >
                     Ride Offered
                   </button>
                 </>
               )}

               {/* State 3: Request -> Accept */}
               {match.type === 'request' && (
                 <>
                   <button style={{ position: 'relative', width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                     <div style={{ position: 'absolute', top: 8, right: 8, background: '#ff0043', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333' }}>1</div>
                   </button>
                   <button onClick={() => handleAcceptRequest(match.id)} style={{ flex: 1, padding: '16px', background: '#ff0043', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                     Accept Request
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
           <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#111' }}>Ready to start your ride?</h3>
           {confirmedPassengers.length === 0 ? (
             <p style={{ margin: '0 0 24px', color: '#888', fontSize: '0.9rem' }}>You don't have confirmed passengers yet.</p>
           ) : (
             <p style={{ margin: '0 0 24px', color: '#888', fontSize: '0.9rem' }}>You have {confirmedPassengers.length} confirmed passenger(s).</p>
           )}
           <div style={{ marginBottom: confirmedPassengers.length === 0 ? '0' : '24px' }}></div>
           
           {/* Confirmed Passenger Avatars Overlap */}
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
              {confirmedPassengers.length > 0 ? (
                 confirmedPassengers.map((cp, idx) => (
                    <div key={cp.id} style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #f2f4f7', marginLeft: idx > 0 ? '-16px' : 0, overflow: 'hidden', background: '#e0e0e0', zIndex: 10 - idx }}>
                        <img src={cp.profilePic} alt="confirmed user" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                 ))
              ) : (
                 // Fallback Mock Display if none confirmed identically matching blue generic avatars precisely
                 <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #f2f4f7', background: '#dbdbdb', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <User size={28} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #f2f4f7', marginLeft: '-20px', background: '#dbdbdb', zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <User size={28} color="#fff" strokeWidth={2.5} />
                    </div>
                 </>
              )}
           </div>

           {/* Buttons */}
           <button 
             onClick={() => setShowCancelModal(true)}
             style={{ width: '100%', padding: '16px', background: '#dbdbdb', border: 'none', borderRadius: '8px', color: '#555', fontWeight: 700, fontSize: '1rem', marginBottom: '16px', cursor: 'pointer' }}
           >
             Cancel Ride
           </button>
           <button 
             onClick={() => {
               if (window.confirm("Are you ready to start your ride?")) {
                 alert("Ride started successfully!");
               }
             }}
             style={{ width: '100%', padding: '16px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
           >
             Start Ride
           </button>
        </div>
      </div>

      {/* CUSTOM CANCEL MODAL */}
      {showCancelModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel this ride?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel this ride offer? This action cannot be undone.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCancelModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep Ride
              </button>
              <button 
                onClick={() => navigate('/my-rides')}
                style={{ flex: 1, padding: '14px', background: '#ff2744', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(255,39,68,0.3)' }}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM RETRACT OFFER MODAL */}
      {showRetractOfferModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel ride offer?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel the ride offer specifically sent to this passenger?</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowRetractOfferModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep Offer
              </button>
              <button 
                onClick={async () => {
                  try {
                      if (matchToRetract) {
                         setMatches(prev => prev.map(m => m.id === matchToRetract ? { ...m, type: 'match' } : m));
                         await updateDoc(doc(db, 'rideRequests', matchToRetract), { status: 'open', offeredByRideId: null });
                      }
                      setShowRetractOfferModal(false);
                      setMatchToRetract(null);
                  } catch (e) {
                      console.error("Retraction error:", e);
                  }
                }}
                style={{ flex: 1, padding: '14px', background: '#ff2744', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(255,39,68,0.3)' }}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt Window For Confirmed Status Cancellation */}
      {showCancelConfirmedModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel confirmed passenger?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel this passenger's confirmed ride?</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCancelConfirmedModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep Passenger
              </button>
              <button 
                onClick={async () => {
                  try {
                      if (confirmedMatchToCancel) {
                         setMatches(prev => prev.map(m => m.id === confirmedMatchToCancel ? { ...m, type: 'match' } : m));
                         
                         // Clear the passenger's direct link structurally
                         await updateDoc(doc(db, 'rideRequests', confirmedMatchToCancel), { status: 'open', offeredByRideId: null });
                         
                         // Extract the passenger natively AND restore driver capacity seamlessly resolving state
                         const requestedPassenger = matches.find(m => m.id === confirmedMatchToCancel);
                         const passengerSeatCount = parseInt(requestedPassenger?.seats) || 1;
                         
                         await updateDoc(doc(db, 'rideOffers', ride.id), { 
                           requestedByPassengerIds: arrayRemove(confirmedMatchToCancel),
                           seatsTaken: increment(-Math.abs(passengerSeatCount))
                         });
                      }
                      setShowCancelConfirmedModal(false);
                      setConfirmedMatchToCancel(null);
                  } catch (e) {
                      console.error("Cancellation error:", e);
                  }
                }}
                style={{ flex: 1, padding: '14px', background: '#ff2744', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(255,39,68,0.3)' }}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt Window For Capacity Full */}
      {showCapacityFullModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Ride Capacity Full</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>
               {capacityModalText || "You cannot accept this request because your vehicle's seat capacity is already fully reached."}
            </p>
            
            <button 
              onClick={() => setShowCapacityFullModal(false)}
              style={{ width: '100%', padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
