import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MessageCircle, MoreHorizontal, User, Check, List, Star, Phone, X, Loader2, Car, Calendar, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, query, getDocs, doc, getDoc, updateDoc, onSnapshot, increment, arrayUnion, arrayRemove, where, deleteField, documentId, runTransaction } from 'firebase/firestore';
import { sendRideNotification } from '../utils/notifications';

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
  html: `<div style="width:16px;height:16px;background:${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#ff0043' : type === 'request' ? '#eab308' : '#888'};border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px ${type === 'completed' ? 'rgba(156,201,58,0.6)' : type === 'confirmed' ? 'rgba(156,201,58,0.6)' : type === 'match' ? 'rgba(0,176,240,0.6)' : type === 'offered' ? 'rgba(255,0,67,0.6)' : type === 'request' ? 'rgba(234,179,8,0.6)' : 'rgba(136,136,136,0.6)'};"></div>`,
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
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#ff0043' : type === 'request' ? '#eab308' : '#888'}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>`,
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
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#ff0043' : type === 'request' ? '#eab308' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getMeetDropSpotIcon = (type) => new L.DivIcon({
  className: 'custom-meet-drop-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#ff0043' : type === 'request' ? '#eab308' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const AvatarFallback = ({ src, name, size = 40 }) => {
    const [imgError, setImgError] = useState(false);
    const getInitials = (name) => {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    if (src && !imgError) {
        return <img src={src} alt={name || 'Avatar'} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={() => setImgError(true)} />;
    }

    if (name) {
        return (
            <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#00b0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: size * 0.4, flexShrink: 0 }}>
                {getInitials(name)}
            </div>
        );
    }

    return (
        <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={size * 0.6} color="#555" />
        </div>
    );
};

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
  const [isRouteLoading, setIsRouteLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [actionProcessingId, setActionProcessingId] = useState(null);
  const [activeDriverId, setActiveDriverId] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const [drawerMode, setDrawerMode] = useState('driver');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRetractRequestModal, setShowRetractRequestModal] = useState(false);
  const [matchToRetract, setMatchToRetract] = useState(null);
  const [showCapacityFullModal, setShowCapacityFullModal] = useState(false);
  const [capacityModalText, setCapacityModalText] = useState("");
  const [showCancelConfirmedModal, setShowCancelConfirmedModal] = useState(false);
  const [confirmedMatchToCancel, setConfirmedMatchToCancel] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Real-time bidirectional matching state sync natively updating passenger match views instantly if a driver reacts
  const [volatilePassengerState, setVolatilePassengerState] = useState(ride);

  // Parse exact passenger coordinates bound intrinsically to real ride payloads
  // Parse exact passenger coordinates bound intrinsically to real ride payloads
  const passengerFrom = useMemo(() => (ride?.from ? { lat: ride.from.lat, lon: ride.from.lon } : { lat: 14.5552, lon: 121.0535 }), [ride?.from, ride?.from?.lat, ride?.from?.lon]);
  const passengerTo = useMemo(() => (ride?.to ? { lat: ride.to.lat, lon: ride.to.lon } : { lat: 14.5547, lon: 121.0244 }), [ride?.to, ride?.to?.lat, ride?.to?.lon]);
  
  // Format dynamic timestamps matching structural design spec
  const rideTimeStr = ride?.time ? dayjs(ride.time).format('h:mma') : '3:45pm';
  const rideDateStr = ride?.date ? dayjs(ride.date).format('MMM. D') : 'Sep. 18th';
  
  // Fetch Passenger Route once on mount
  useEffect(() => {
    const fetchPassengerRoute = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${passengerFrom.lon},${passengerFrom.lat};${passengerTo.lon},${passengerTo.lat}?geometries=geojson&overview=full`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`OSRM Error: ${res.status}`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setPassengerRoute(coords);
      } catch (err) {
        if (err.name !== 'AbortError') console.error("OSRM Passenger Route Error", err);
        setPassengerRoute([[passengerFrom.lat, passengerFrom.lon], [passengerTo.lat, passengerTo.lon]]);
      }
    };
    fetchPassengerRoute();
  }, [passengerFrom.lat, passengerFrom.lon, passengerTo.lat, passengerTo.lon]);

  const volatilePassengerStateRef = useRef(ride);

  // Matching Engine: Fetch and filter drivers dynamically
  useEffect(() => {
    if (passengerRoute.length === 0) return;
    if (['cancelled', 'expired'].includes(volatilePassengerStateRef.current?.status)) {
        setIsLoadingMatches(false);
        setMatches([]);
        return;
    }

    setIsLoadingMatches(true);
    let reqRef;
    if (volatilePassengerStateRef.current?.status === 'completed') {
        if (volatilePassengerStateRef.current?.offeredByRideId) {
            reqRef = query(collection(db, 'rideOffers'), where(documentId(), '==', volatilePassengerStateRef.current.offeredByRideId));
        } else {
            setIsLoadingMatches(false);
            setMatches([]);
            return;
        }
    } else {
        reqRef = query(collection(db, 'rideOffers'), where('status', 'in', ['open', 'matched', 'confirmed', 'in_progress']));
    }
    
    const unsubscribe = onSnapshot(reqRef, async (snap) => {
        const reqDocs = [];
        snap.forEach(doc => reqDocs.push({ id: doc.id, ...doc.data() }));

        const matchPromises = reqDocs.map(async (req) => {
           if (!req.from?.lat || !req.to?.lat) return null;
           if (ride?.userId && req.userId === ride.userId) return null; // Prevent self-matching
           
           // TEMPORAL CHECK LAUNCH
           if (!ride?.date || !req.date || !ride?.time || !req.time) return null;
           const dRide = dayjs(ride.date).format('YYYY-MM-DD');
           const dReq = dayjs(req.date).format('YYYY-MM-DD');
           if (dRide !== dReq) return null;
           const isLinkedMatch = volatilePassengerStateRef.current?.offeredByRideId === req.id || 
                                 (req.requestedByPassengerIds || []).includes(ride?.id) || 
                                 (req.offeredToPassengerIds || []).includes(ride?.id);
           if (!isLinkedMatch && dRide < dayjs().subtract(1, 'day').format('YYYY-MM-DD')) return null;
           const mRide = dayjs(ride.time).hour() * 60 + dayjs(ride.time).minute();
           const mReq = dayjs(req.time).hour() * 60 + dayjs(req.time).minute();
           const timeDiff = mReq - mRide;
           if (!isLinkedMatch && (timeDiff < -60 || timeDiff > 180)) return null;
           if (req.status === 'completed' || req.status === 'cancelled' || req.status === 'in_progress') {
               if (volatilePassengerStateRef.current?.offeredByRideId !== req.id) {
                   if (geometryCache.current[req.id]) delete geometryCache.current[req.id];
                   return null;
               }
           }

           // CRITICAL FIX: Hide all other unrelated active open drivers entirely if this passenger request historically or actively bound itself to someone else natively!
           if (['confirmed', 'in_progress', 'completed'].includes(volatilePassengerStateRef.current?.status) && volatilePassengerStateRef.current?.offeredByRideId && volatilePassengerStateRef.current?.offeredByRideId !== req.id) {
               return null;
           }

           let typeStatus = 'match';
           const passengerIsConfirmedWithThisDriver = ['confirmed', 'completed', 'in_progress'].includes(volatilePassengerStateRef.current?.status) && volatilePassengerStateRef.current?.offeredByRideId === req.id;
           const driverIsConfirmedWithThisPassenger = ['confirmed', 'completed', 'in_progress'].includes(req.status) && req.requestedByRideId === ride?.id;

           if (passengerIsConfirmedWithThisDriver) {
               typeStatus = volatilePassengerStateRef.current?.status;
           } else if (driverIsConfirmedWithThisPassenger) {
               typeStatus = req.status;
           } else if ((req.requestedByPassengerIds || []).includes(ride?.id)) {
               typeStatus = 'request';
           } else if ((req.offeredToPassengerIds || []).includes(ride?.id)) {
               typeStatus = 'offered';
           }

           const nameParams = req.userName || 'Erwin Rivera';
           const timeParams = req.time ? dayjs(req.time).format('h:mma') : 'Any time';
           
           let ratingParams = req.userRating || '0.0';
           let reviewsParams = req.userReviews || 0;
           let completedRidesParams = 0;
           let carMakeParams = '';
           let carModelParams = '';
           let carColorParams = '';
           let plateNumberParams = '';

           if (req.userId) {
               try {
                   const userDocSnap = await getDoc(doc(db, 'users', req.userId));
                   if (userDocSnap.exists()) {
                       const userData = userDocSnap.data();
                       if (userData.rating) ratingParams = parseFloat(userData.rating).toFixed(1);
                       if (userData.reviewsCount !== undefined) reviewsParams = userData.reviewsCount;
                       else if (userData.reviews !== undefined) reviewsParams = userData.reviews;
                       if (userData.completedRides) completedRidesParams = userData.completedRides;
                        
                       if (userData.carMake) carMakeParams = userData.carMake;
                       if (userData.carModel) carModelParams = userData.carModel;
                       if (userData.carColor) carColorParams = userData.carColor;
                       if (userData.plateNumber) plateNumberParams = userData.plateNumber;
                       if (userData.photoURL) req.userProfilePic = userData.photoURL;
                   }
               } catch (e) {
                   console.error("Error fetching user rating", e);
               }
           }

           // PREVENT API SPAM - INSTANT CACHE YIELDING LOCALLY
           if (geometryCache.current[req.id]) {
               return {
                   ...geometryCache.current[req.id],
                   type: typeStatus,
                   name: nameParams,
                   time: timeParams,
                   seats: req.seats || geometryCache.current[req.id].seats || 1,
                   seatsTaken: req.seatsTaken || geometryCache.current[req.id].seatsTaken || 0,
                   profilePic: req.userProfilePic || geometryCache.current[req.id].profilePic || '',
                   rawRequest: req
               };
           }

           const pLat = req.from.lat; const pLon = req.from.lon;
           const dLat = req.to.lat;   const dLon = req.to.lon;
           
           try {
              // Extract passenger route dynamically!
              const resDriver = await fetch(`https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?geometries=geojson&overview=full`);
               if (!resDriver.ok) throw new Error(`OSRM Error: ${resDriver.status}`);
               const driverData = await resDriver.json();
               if (!driverData.routes || driverData.routes.length === 0) {
                   throw new Error("No OSRM routes found");
               }
               
               const driverRoute = driverData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              
              // Sub-function to find the true road-network driving distance optimal point on D
              const findBestNetworkNode = async (targetPos) => {
                 const candidates = driverRoute.map((pt, idx) => ({ pt, idx, dist: getDistanceKM(pt[0], pt[1], targetPos.lat, targetPos.lon) }))
                                               .filter(c => c.dist <= 5.0);
                 if (candidates.length === 0) return null;

                 // Downsample to max 50 coordinates to fit OSRM public table limit
                 let sampleSize = Math.max(1, Math.ceil(candidates.length / 50));
                 let sampled = [];
                 for (let i = 0; i < candidates.length; i += sampleSize) {
                      sampled.push(candidates[i]);
                 }
                 if (sampled.length > 90) sampled = sampled.slice(0, 90);

                 let coords = `${targetPos.lon},${targetPos.lat}`;
                 sampled.forEach(c => { coords += `;${c.pt[1]},${c.pt[0]}`; });

                 try {
                     const controller = new AbortController();
                     const timeoutId = setTimeout(() => controller.abort(), 2000);
                     const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0`, { signal: controller.signal });
                     clearTimeout(timeoutId);
                     if (!res.ok) throw new Error(`OSRM Error: ${res.status}`);
                     const data = await res.json();
                     if (data.code !== 'Ok' || !data.durations || !data.durations[0]) throw new Error("Table API failed");

                     let minDur = Infinity;
                     let bestCandidate = null;
                     for (let i = 0; i < sampled.length; i++) {
                         const dur = data.durations[0][i + 1];
                         if (dur !== null && dur < minDur) { minDur = dur; bestCandidate = sampled[i]; }
                     }
                     return bestCandidate || sampled.reduce((min, c) => c.dist < min.dist ? c : min, sampled[0]);
                 } catch(e) {
                     return sampled.reduce((min, c) => c.dist < min.dist ? c : min, sampled[0]);
                 }
              };

              // 1. Constrain Passenger to Driver's Route via actual Road Network Proximity!
              const bestPickup = await findBestNetworkNode(passengerFrom);
              const bestDropoff = await findBestNetworkNode(passengerTo);

              if (!isLinkedMatch && (!bestPickup || !bestDropoff || bestPickup.idx >= bestDropoff.idx)) return null;

              let pickupIdx = bestPickup?.idx || 0;
              let dropIdx = bestDropoff?.idx || (driverRoute.length - 1);
              if (isLinkedMatch && pickupIdx >= dropIdx) {
                  pickupIdx = 0;
                  dropIdx = Math.max(0, driverRoute.length - 1);
              }
              let meetPickup = driverRoute[pickupIdx] || [passengerFrom.lat, passengerFrom.lon];
              let meetDropoff = driverRoute[dropIdx] || [passengerTo.lat, passengerTo.lon];
              
              let interceptPaths = {
                 pickupPath: [[passengerFrom.lat, passengerFrom.lon], [meetPickup[0], meetPickup[1]]],
                 dropoffPath: [[meetDropoff[0], meetDropoff[1]], [passengerTo.lat, passengerTo.lon]]
              };
              
              // Segment 1 & 3: Connector routes mapped natively to exactly the OSRM geometric paths!
              try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 2000);
                  const pFetch = fetch(`https://router.project-osrm.org/route/v1/driving/${passengerFrom.lon},${passengerFrom.lat};${meetPickup[1]},${meetPickup[0]}?geometries=geojson`, { signal: controller.signal });
                  const dFetch = fetch(`https://router.project-osrm.org/route/v1/driving/${meetDropoff[1]},${meetDropoff[0]};${passengerTo.lon},${passengerTo.lat}?geometries=geojson`, { signal: controller.signal });
                  const [pRes, dRes] = await Promise.all([pFetch, dFetch]);
                  clearTimeout(timeoutId);
                  if (!pRes.ok || !dRes.ok) throw new Error("OSRM Connector API failed");
                  const pData = await pRes.json();
                  const dData = await dRes.json();
                  if (pData.routes?.length > 0) interceptPaths.pickupPath = pData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                  if (dData.routes?.length > 0) interceptPaths.dropoffPath = dData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              } catch (e) {
                  if (e.name !== 'AbortError') {
                      console.error("OSRM Connector routing failed natively", e);
                  }
              }

              // Final sequential sanity check
              if (!isLinkedMatch && pickupIdx >= dropIdx) return null;

              const geometricPayload = {
                 id: req.id,
                 price: '0.00 ₱', 
                 pickup: { lat: pLat, lon: pLon, address: req.from.address },
                 dropoff: { lat: dLat, lon: dLon, address: req.to.address },
                 meetPickup: { lat: meetPickup[0], lon: meetPickup[1], idx: pickupIdx },
                 meetDropoff: { lat: meetDropoff[0], lon: meetDropoff[1], idx: dropIdx },
                 interceptPaths,
                 driverFullRoute: driverRoute,
                 rawRequest: req,
                 rating: ratingParams,
                 reviews: reviewsParams,
                 completedRides: completedRidesParams,
                 carMake: carMakeParams,
                 carModel: carModelParams,
                 carColor: carColorParams,
                 plateNumber: plateNumberParams
              };

              // Map to local logical memory
              geometryCache.current[req.id] = geometricPayload;

              return {
                 ...geometricPayload,
                 type: typeStatus,
                 name: nameParams,
                 time: timeParams,
                 seats: req.seats || 1,
                 seatsTaken: req.seatsTaken || 0,
                 profilePic: req.userProfilePic || '',
              };

           } catch (e) {
               console.error("OSRM Pass fetch failure", e);
               
               if (!isLinkedMatch) {
                   // Fallback proxy if OSRM is rate-limited or fails
                   const dx = dLon - pLon;
                   const dy = dLat - pLat;
                   const lenSq = (dx * dx) + (dy * dy);
                   
                   if (lenSq !== 0) {
                       const pPickupX = passengerFrom.lon - pLon;
                       const pPickupY = passengerFrom.lat - pLat;
                       const projPickup = (pPickupX * dx) + (pPickupY * dy);
                       
                       const pDropX = passengerTo.lon - pLon;
                       const pDropY = passengerTo.lat - pLat;
                       const projDrop = (pDropX * dx) + (pDropY * dy);

                       if (projPickup > lenSq) return null;
                       if (projDrop < 0) return null;
                       if (projPickup >= projDrop) return null;
                   }

                   const buffer = 0.045; 
                   const r1MinLat = Math.min(pLat, dLat) - buffer;
                   const r1MaxLat = Math.max(pLat, dLat) + buffer;
                   const r1MinLon = Math.min(pLon, dLon) - buffer;
                   const r1MaxLon = Math.max(pLon, dLon) + buffer;

                   const r2MinLat = Math.min(passengerFrom.lat, passengerTo.lat);
                   const r2MaxLat = Math.max(passengerFrom.lat, passengerTo.lat);
                   const r2MinLon = Math.min(passengerFrom.lon, passengerTo.lon);
                   const r2MaxLon = Math.max(passengerFrom.lon, passengerTo.lon);

                   if (!((r1MaxLat > r2MinLat && r1MinLat < r2MaxLat) && (r1MaxLon > r2MinLon && r1MinLon < r2MaxLon))) {
                       return null;
                   }
               }

               const geometricPayload = {
                  id: req.id,
                  price: '0.00 ₱', 
                  pickup: { lat: pLat, lon: pLon, address: req.from.address },
                  dropoff: { lat: dLat, lon: dLon, address: req.to.address },
                  meetPickup: { lat: passengerFrom.lat, lon: passengerFrom.lon, idx: 0 },
                  meetDropoff: { lat: passengerTo.lat, lon: passengerTo.lon, idx: 1 },
                  interceptPaths: {
                     pickupPath: [[passengerFrom.lat, passengerFrom.lon], [passengerFrom.lat, passengerFrom.lon]],
                     dropoffPath: [[passengerTo.lat, passengerTo.lon], [passengerTo.lat, passengerTo.lon]]
                  },
                  driverFullRoute: [[pLat, pLon], [dLat, dLon]],
                  rawRequest: req,
                  rating: ratingParams,
                  reviews: reviewsParams,
                  completedRides: completedRidesParams,
                  carMake: carMakeParams,
                  carModel: carModelParams,
                  carColor: carColorParams,
                  plateNumber: plateNumberParams
               };

               geometryCache.current[req.id] = geometricPayload;

               return {
                  ...geometricPayload,
                  type: typeStatus,
                  name: nameParams,
                  time: timeParams,
                  seats: req.seats || 1,
                  seatsTaken: req.seatsTaken || 0,
                  profilePic: req.userProfilePic || '',
               };
            }
        });
        
        const results = await Promise.all(matchPromises);
        const validMatches = results.filter(m => m !== null);
        
        // Re-apply the absolute freshest volatilePassengerStateRef synchronously before commit to prevent async stale overwrites
        let finalMatchesToProcess = validMatches;
        if (['confirmed', 'in_progress', 'completed'].includes(volatilePassengerStateRef.current?.status) && volatilePassengerStateRef.current?.offeredByRideId) {
            finalMatchesToProcess = finalMatchesToProcess.filter(m => m.id === volatilePassengerStateRef.current.offeredByRideId);
        }

        const fullyFreshMatches = finalMatchesToProcess.map(m => {
            let finalType = m.type;
            const req = m.rawRequest;
            if (!req) return m;

            const passengerIsConfirmedWithThisDriver = ['confirmed', 'completed', 'in_progress'].includes(volatilePassengerStateRef.current?.status) && volatilePassengerStateRef.current?.offeredByRideId === req.id;
            const driverIsConfirmedWithThisPassenger = ['confirmed', 'completed', 'in_progress'].includes(req.status) && req.requestedByRideId === ride?.id;

            if (passengerIsConfirmedWithThisDriver) {
                finalType = volatilePassengerStateRef.current?.status;
            } else if (driverIsConfirmedWithThisPassenger) {
                finalType = req.status;
            } else if ((req.requestedByPassengerIds || []).includes(ride?.id)) {
                finalType = 'request';
            } else if ((req.offeredToPassengerIds || []).includes(ride?.id)) {
                finalType = 'offered';
            } else {
                finalType = 'match';
            }
            return { ...m, type: finalType };
        });
        
        // Trigger browser notifications for important events securely tracked via session
        fullyFreshMatches.forEach(m => {
            if (m.type === 'match') {
                sendRideNotification(`new_match_${ride?.id}_${m.id}`, 'New ride match found!');
            } else if (m.type === 'offered') {
                sendRideNotification(`offer_${ride?.id}_${m.id}`, `You received a ride offer from ${m.name}`);
            } else if (m.type === 'confirmed') {
                sendRideNotification(`accepted_req_${ride?.id}_${m.id}`, `Your ride request was accepted by ${m.name}`);
            }
        });

        setMatches(fullyFreshMatches);
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
  }, [passengerRoute, passengerFrom, passengerTo, ride?.userId, ride?.id, ride?.date, ride?.time, refreshKey]);

  useEffect(() => {
    volatilePassengerStateRef.current = volatilePassengerState;
    
    // Failsafe UI cleanup: if passenger is locked into a ride natively, instantly hide all other drivers locally
    if (['confirmed', 'in_progress', 'completed'].includes(volatilePassengerState?.status) && volatilePassengerState?.offeredByRideId) {
        setMatches(prev => prev.filter(m => m.id === volatilePassengerState.offeredByRideId));
    }
  }, [volatilePassengerState]);

  useEffect(() => {
    if (!ride?.id) return;
    const unsub = onSnapshot(doc(db, 'rideRequests', ride.id), (docSnap) => {
        if (docSnap.exists()) {
            setVolatilePassengerState({ id: docSnap.id, ...docSnap.data() });
        }
    });
    return () => unsub();
  }, [ride?.id]);

  useEffect(() => {
      // Transition out of the matching phase instantaneously into active tracking if the driver initiates the trip
      // Note: Passenger state remains 'confirmed', but the Driver's rideOffers status switches to 'in_progress'
      if (volatilePassengerState?.status === 'active') { // Failsafe generic state
          navigate('/passenger-tracking', { replace: true, state: { ride: volatilePassengerState } });
      } else if (volatilePassengerState?.status === 'confirmed' && volatilePassengerState?.offeredByRideId) {
          const theHostDriver = matches.find(m => m.id === volatilePassengerState.offeredByRideId);
          if (theHostDriver && theHostDriver.rawRequest?.status === 'in_progress') {
              navigate('/passenger-tracking', { replace: true, state: { ride: volatilePassengerState } });
          }
      }
  }, [volatilePassengerState, matches, navigate]);

  // Synchronize matches when the passenger's own live database document updates
  useEffect(() => {
    if (!volatilePassengerState) return;
    setMatches(prev => {
        const filtered = prev.filter(m => {
            const req = m.rawRequest;
            if (!req) return true;
            if ((req.status === 'completed' || req.status === 'cancelled' || req.status === 'in_progress') && volatilePassengerState.offeredByRideId !== req.id) {
                return false;
            }
            // CRITICAL FIX: Ensure competing race condition drivers are completely purged from the UI if the passenger natively confirms!
            if (['confirmed', 'in_progress', 'completed'].includes(volatilePassengerState.status) && volatilePassengerState.offeredByRideId && volatilePassengerState.offeredByRideId !== req.id) {
                return false;
            }
            return true;
        });
        
        const mapped = filtered.map(m => {
            let newType = m.type;
            const req = m.rawRequest;
            if (!req) return m;

            const passengerIsConfirmedWithThisDriver = ['confirmed', 'completed', 'in_progress'].includes(volatilePassengerState.status) && volatilePassengerState.offeredByRideId === req.id;
            const driverIsConfirmedWithThisPassenger = ['confirmed', 'completed', 'in_progress'].includes(req.status) && req.requestedByRideId === ride?.id;

            if (passengerIsConfirmedWithThisDriver) {
                newType = volatilePassengerState.status;
            } else if (driverIsConfirmedWithThisPassenger) {
                newType = req.status;
            } else if ((req.requestedByPassengerIds || []).includes(ride?.id)) {
                newType = 'request';
            } else if ((req.offeredToPassengerIds || []).includes(ride?.id)) {
                newType = 'offered';
            } else {
                newType = 'match';
            }
            
            return m.type !== newType ? { ...m, type: newType } : m;
        });
        
        // Simple deep equality check to prevent infinite re-renders or unnecessary state updates
        if (prev.length === mapped.length && prev.every((m, i) => m.type === mapped[i].type && m.id === mapped[i].id)) {
            return prev;
        }
        return mapped;
    });
  }, [volatilePassengerState, ride?.id]);

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
  const activeDriverRoute = activeDriver?.meetPickup && activeDriver?.driverFullRoute?.length > 0
    ? activeDriver.driverFullRoute.slice(activeDriver.meetPickup.idx, activeDriver.meetDropoff.idx + 1)
    : [];

  const handleMessageContact = async (userId) => {
      if (!userId) return;
      try {
          const snap = await getDoc(doc(db, 'users', userId));
          if (snap.exists() && snap.data().phoneNumber) {
              window.location.href = `sms:${snap.data().phoneNumber}`;
          } else {
              alert("This user has not registered a phone number.");
          }
      } catch (err) {
          console.error(err);
          alert("Failed to retrieve phone number.");
      }
  };

  const handleRequestJoin = async (matchId) => {
    if (actionProcessingId) return;
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (['confirmed', 'in_progress', 'completed'].includes(volatilePassengerState?.status)) {
      setCapacityModalText("You already have a confirmed ride. Please cancel your confirmed ride before requesting to join another ride.");
      setShowCapacityFullModal(true);
      return;
    }

    const passengerSeats = parseInt(ride?.seats) || 1;
    const driverMaxSeats = parseInt(match.seats) || 4;
    const driverConfirmedCount = parseInt(match.confirmedCount || match.seatsTaken) || 0;

    if (driverConfirmedCount + passengerSeats > driverMaxSeats) {
        setCapacityModalText(`This ride is either full or does not have enough seat capacity for your request. The driver only has ${driverMaxSeats - driverConfirmedCount} seat(s) left, but you requested ${passengerSeats} seat(s).`);
        setShowCapacityFullModal(true);
        return;
    }

    setActionProcessingId(matchId);

    try {
      const driverDocRef = doc(db, 'rideOffers', matchId);
      const passengerDocRef = doc(db, 'rideRequests', ride.id);

      await runTransaction(db, async (transaction) => {
          const dSnap = await transaction.get(driverDocRef);
          if (!dSnap.exists()) throw new Error("Driver ride no longer exists.");
          
          const dData = dSnap.data();
          const dConfirmedCount = parseInt(dData.seatsTaken || 0);
          const dMaxSeats = parseInt(dData.seats || 4);
          
          // Verify capacity live on server
          if (dConfirmedCount + passengerSeats > dMaxSeats) {
              throw new Error("CAPACITY_FULL");
          }
          
          const currentRequestedBy = dData.requestedByPassengerIds || [];
          if (!currentRequestedBy.includes(ride.id)) {
              currentRequestedBy.push(ride.id);
          }

          transaction.update(passengerDocRef, { 
            status: 'request', 
            offeredByRideId: matchId 
          });

          transaction.update(driverDocRef, {
            requestedByPassengerIds: currentRequestedBy
          });
      });

      // Optimistic generic map transition
      setMatches((prev) => 
        prev.map((m) => m.id === matchId ? { ...m, type: 'request' } : m)
      );
    } catch (error) {
      console.error("Match request state synchronization failed:", error);
      if (error.message === "CAPACITY_FULL") {
          setCapacityModalText(`This ride has just reached maximum capacity and can no longer accept your request.`);
          setShowCapacityFullModal(true);
      }
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleAcceptOffer = async (matchId) => {
    if (actionProcessingId) return;
    if (['confirmed', 'in_progress', 'completed'].includes(volatilePassengerState?.status)) {
      setCapacityModalText("You already have a confirmed ride. Please cancel your existing confirmed ride before accepting another offer.");
      setShowCapacityFullModal(true);
      return;
    }

    const match = matches.find(m => m.id === matchId);
    if ((match?.confirmedCount || match?.seatsTaken || 0) >= (match?.seats || 4)) {
      setCapacityModalText("You cannot accept this offer because the driver's vehicle has already reached maximum seating capacity.");
      setShowCapacityFullModal(true);
      return;
    }
    
    setActionProcessingId(matchId);

    try {
      const passengerDocRef = doc(db, 'rideRequests', ride.id);
      const driverDocRef = doc(db, 'rideOffers', matchId);
      const passengerSeats = parseInt(ride?.seats) || 1;

      await runTransaction(db, async (transaction) => {
          const dSnap = await transaction.get(driverDocRef);
          if (!dSnap.exists()) throw new Error("Driver ride no longer exists.");
          
          const dData = dSnap.data();
          const dConfirmedCount = parseInt(dData.seatsTaken || 0);
          const dMaxSeats = parseInt(dData.seats || 4);
          
          // Verify capacity dynamically on server during lock
          if (dConfirmedCount + passengerSeats > dMaxSeats) {
              throw new Error("CAPACITY_FULL");
          }

          transaction.update(passengerDocRef, { 
            status: 'confirmed',
            offeredByRideId: matchId 
          });

          transaction.update(driverDocRef, {
            seatsTaken: increment(passengerSeats)
          });
      });

      setMatches((prev) => 
        prev.filter(m => m.id === matchId).map((m) => m.id === matchId ? { ...m, type: 'confirmed' } : m)
      );
    } catch (error) {
      console.error("Accept offer state synchronization failed:", error);
      if (error.message === "CAPACITY_FULL") {
          setCapacityModalText("You cannot accept this offer because the driver's vehicle has just reached maximum seating capacity.");
          setShowCapacityFullModal(true);
      }
    } finally {
      setActionProcessingId(null);
    }
  };

  const confirmedDrivers = matches.filter(m => m.type === 'confirmed');

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
    
    // Auto-remove the spinning animation class after 1 second
    setTimeout(() => {
        setIsRefreshing(false);
    }, 1000);
  };

  return (
    <div style={{ height: '100dvh', width: '100vw', position: 'relative', overflow: 'hidden', background: '#eaeaea' }}>
      
      {/* BACKGROUND MAP */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        {isLoadingMatches && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'white', padding: '15px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex' }}>
            <Loader2 size={32} color="#00b0f0" style={{ animation: 'spin 1.2s linear infinite' }} />
          </div>
        )}
        {isRouteLoading && (
          <div style={{ position: 'absolute', top: '100px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', padding: '8px 16px', borderRadius: '9999px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1010, border: '1px solid #f3f4f6' }}>
            <Loader2 size={16} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Loading route...</span>
          </div>
        )}
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
             <Polyline positions={passengerRoute} pathOptions={{ color: volatilePassengerState?.status === 'cancelled' ? '#888' : '#00b0f0', weight: 6, opacity: 0.8 }} />
             <Marker position={[passengerFrom.lat, passengerFrom.lon]} icon={getDriverStartIcon(volatilePassengerState?.status === 'cancelled' ? 'cancelled' : 'match')} />
             <Marker position={[passengerTo.lat, passengerTo.lon]} icon={getDriverEndIcon(volatilePassengerState?.status === 'cancelled' ? 'cancelled' : 'match')} />
          </>
        )}

        {/* PASSENGER OVERLAY & INTERCEPTS (Colored) */}
        {activeDriverRoute.length > 0 && (
          <>
            {/* Passenger endpoints rendered persistently for context */}
            <Marker position={[passengerFrom.lat, passengerFrom.lon]} icon={getDriverStartIcon(activeDriver.type)} />
            <Marker position={[passengerTo.lat, passengerTo.lon]} icon={getDriverEndIcon(activeDriver.type)} />

            {/* Main passenger transit overlap path (solid Color) */}
            <Polyline positions={activeDriverRoute} pathOptions={{ color: activeDriver.type === 'completed' ? '#9cc93a' : activeDriver.type === 'confirmed' ? '#9cc93a' : activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#ff0043' : activeDriver.type === 'request' ? '#eab308' : '#888', weight: 6, opacity: 1 }} />
            
            {/* Dotted theoretical intercept lines from Passenger Origin -> Nearest Driver node */}
            {passengerRoute.length > 0 && activeDriver?.meetPickup && (
               <Polyline 
                 positions={activeDriver?.interceptPaths?.pickupPath || [[passengerFrom.lat, passengerFrom.lon], [activeDriver.meetPickup.lat, activeDriver.meetPickup.lon]]} 
                 pathOptions={{ color: activeDriver.type === 'completed' ? '#9cc93a' : activeDriver.type === 'confirmed' ? '#9cc93a' : activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#ff0043' : activeDriver.type === 'request' ? '#eab308' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
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
                       <AvatarFallback src={activeDriver.profilePic} name={activeDriver.name} size={24} />
                     </div>
                     <span style={{ fontWeight: 600, color: '#333' }}>Meet around here</span>
                   </div>
                 </Tooltip>
              </Marker>
            )}

            {/* Dotted theoretical intercept line from Driver -> Dropoff */}
            {passengerRoute.length > 0 && activeDriver?.meetDropoff && (
               <Polyline 
                 positions={activeDriver?.interceptPaths?.dropoffPath || [[activeDriver.meetDropoff.lat, activeDriver.meetDropoff.lon], [passengerTo.lat, passengerTo.lon]]} 
                 pathOptions={{ color: activeDriver.type === 'completed' ? '#9cc93a' : activeDriver.type === 'confirmed' ? '#9cc93a' : activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#ff0043' : activeDriver.type === 'request' ? '#ea4335' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
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
      </div>

      {/* TOP OVERLAYS */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(40,45,50,0.9)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          {/* Dark Navbar */}
          <div style={{ padding: 'calc(1rem + env(safe-area-inset-top)) 1rem 1rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: '#fff' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => navigate('/my-rides', { state: { initialTab: location.state?.fromTab || location.state?.initialTab || 'Pending' } })} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                  {volatilePassengerState?.status === 'cancelled' ? 'Find Ride (Cancelled)' : 'Find Ride'}
                </h2>
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
              {![ 'completed', 'cancelled', 'expired' ].includes(volatilePassengerState?.status || ride?.computedStatus) && (
                <button disabled={isLoadingMatches} onClick={() => { setDrawerMode('request'); setIsBottomPanelExpanded(true); }} style={{ background: 'rgba(255,255,255,0.2)', height: 32, width: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: '#fff', cursor: isLoadingMatches ? 'not-allowed' : 'pointer', marginLeft: 4, transition: 'background 0.3s, opacity 0.3s', opacity: isLoadingMatches ? 0.5 : 1 }}>
                  <MoreHorizontal size={16} color="#fff" />
                </button>
              )}
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
          <div 
            onClick={handleManualRefresh}
            style={{ background: '#fff', width: 40, height: 40, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <RefreshCw 
              size={20} 
              color="#555" 
              style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            />
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
            <p style={{ margin: 0, color: '#555', fontWeight: 600, fontSize: '1.2rem' }}>
              {volatilePassengerState?.status === 'cancelled' ? 'Ride Cancelled 🚫' : 'No Matches Found 😢'}
            </p>
            <p style={{ margin: '8px 0 0', color: '#888', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {volatilePassengerState?.status === 'cancelled' ? 'This ride request has been officially cancelled.' : "We couldn't find any drivers offering a ride along your planned route right now."}
            </p>
          </div>
        ) : (
          matches.map((match, index) => (
          <div 
            key={match.id}
            onClick={() => {
               if (activeDriverId !== match.id) {
                  setActiveDriverId(match.id);
                  if (carouselRef.current) {
                      carouselRef.current.scrollTo({ left: index * (window.innerWidth * 0.85), behavior: 'smooth' });
                  }
               }
               setDrawerMode('driver');
               setIsBottomPanelExpanded(prev => activeDriverId === match.id ? !prev : true);
            }}
            style={{ 
              minWidth: '85vw', 
              maxWidth: '85vw',
              background: '#fff', 
              borderRadius: '8px', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              scrollSnapAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            {/* Top Info Row */}
            <div style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
               
               <div>
                 <AvatarFallback src={match.profilePic} name={match.name} size={45} />
               </div>
               
               <div style={{ flex: 1, minWidth: 0 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: match.type === 'completed' ? '#9cc93a' : match.type === 'confirmed' ? '#9cc93a' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#ff0043' : match.type === 'request' ? '#eab308' : '#888', fontWeight: 600 }}>
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
                      {[1, 2, 3, 4, 5].map(starNum => {
                         const ratingVal = parseFloat(match.rating) || 0;
                         const isFilled = starNum <= Math.round(ratingVal);
                         return <Star key={starNum} size={12} fill={isFilled ? "#ffb800" : "#eaeaea"} color={isFilled ? "#ffb800" : "#eaeaea"} />;
                      })}
                      <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px', fontWeight: 600 }}>{match.rating} <span style={{ fontWeight: 400 }}>({match.reviews})</span></span>
                    </div>
                 )}
                 {match.plateNumber && (
                    <div style={{ marginTop: '2px', fontSize: '0.7rem', color: '#777', whiteSpace: 'nowrap' }}>
                       <span style={{ fontWeight: 600 }}>{match.plateNumber}</span> | {match.carMake} {match.carModel} ({match.carColor})
                    </div>
                 )}
               </div>

               <div style={{ textAlign: 'right' }}>
                  {match.type === 'match' || match.type === 'offered' || match.type === 'request' || match.type === 'confirmed' || match.type === 'completed' ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        {Array.from({ length: match.seats || 4 }).map((_, i) => (
                           <User key={i} size={12} fill={match.type === 'completed' ? '#9cc93a' : match.type === 'confirmed' ? '#9cc93a' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#ff0043' : match.type === 'request' ? '#eab308' : '#888'} color={match.type === 'completed' ? '#9cc93a' : match.type === 'confirmed' ? '#9cc93a' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#ff0043' : match.type === 'request' ? '#eab308' : '#888'} />
                        ))}
                     </div>
                  ) : null}
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>{match.price}</p>
               </div>
            </div>

            {/* Bottom Button Row */}
            <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0', marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
               
               {/* State 1: Confirmed or Completed Match */}
               {(match.type === 'confirmed' || match.type === 'completed') && (
                 <>
                   <button 
                     onClick={() => handleMessageContact(match.rawRequest?.userId)}
                     style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button 
                     onClick={() => { if(match.type !== 'completed') { setConfirmedMatchToCancel(match.id); setShowCancelConfirmedModal(true); } }}
                     style={{ flex: 1, padding: '10px', background: match.type === 'completed' ? '#9cc93a' : '#9cc93a', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: match.type === 'completed' ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                     <span>{match.type === 'completed' ? 'Completed Ride' : 'Confirmed'}</span>
                     {match.type !== 'completed' && <span style={{ fontSize: '0.65rem', fontWeight: 500, opacity: 0.85, marginTop: '2px' }}>tap again to cancel</span>}
                   </button>
                 </>
               )}

               {/* State 2: Match -> Request to Join */}
               {match.type === 'match' && (
                 <>
                   <button 
                     onClick={() => handleMessageContact(match.rawRequest?.userId)}
                     disabled={!!actionProcessingId}
                     style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId ? 0.5 : 1 }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button 
                     onClick={() => handleRequestJoin(match.id)} 
                     disabled={!!actionProcessingId}
                     style={{ flex: 1, padding: '16px', background: '#00b0f0', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId && actionProcessingId !== match.id ? 0.5 : 1 }}
                   >
                     {actionProcessingId === match.id ? 'Processing...' : 'Request to Join'}
                   </button>
                 </>
               )}

               {/* State 3: Request -> Request Sent */}
               {match.type === 'request' && (
                 <>
                   <button 
                     onClick={() => handleMessageContact(match.rawRequest?.userId)}
                     style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button 
                     onClick={() => { setMatchToRetract(match.id); setShowRetractRequestModal(true); }}
                     style={{ flex: 1, padding: '10px', background: '#eab308', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                   >
                     <span>Sent Request</span>
                     <span style={{ fontSize: '0.65rem', fontWeight: 500, opacity: 0.85, marginTop: '2px' }}>tap again to cancel</span>
                   </button>
                 </>
               )}

               {/* State 4: Offered -> Accept Offer */}
               {match.type === 'offered' && (
                 <>
                   <button 
                     onClick={() => handleMessageContact(match.rawRequest?.userId)}
                     disabled={!!actionProcessingId}
                     style={{ position: 'relative', width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId ? 0.5 : 1 }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                     <div style={{ position: 'absolute', top: 8, right: 8, background: '#ff0043', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333' }}>1</div>
                   </button>
                   <button 
                     onClick={() => handleAcceptOffer(match.id)} 
                     disabled={!!actionProcessingId}
                     style={{ flex: 1, padding: '16px', background: '#ff0043', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId && actionProcessingId !== match.id ? 0.5 : 1 }}
                   >
                     {actionProcessingId === match.id ? 'Processing...' : 'Accept Offer'}
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

      {/* DRAWER BACKDROP OVERLAY */}
      <div 
        onClick={() => setIsBottomPanelExpanded(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1500,
          opacity: isBottomPanelExpanded ? 1 : 0,
          pointerEvents: isBottomPanelExpanded ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out'
        }}
      />

      {/* BOTTOM ACTION PANEL PULL-UP OVERLAY */}
      <div 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          background: isBottomPanelExpanded ? 'rgba(40,45,50,0.98)' : 'rgba(40,45,50,0.9)', 
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.5)',
          padding: isBottomPanelExpanded 
            ? '16px 24px calc(16px + env(safe-area-inset-bottom)) 24px' 
            : 'calc(40px + env(safe-area-inset-bottom)) 24px calc(16px + env(safe-area-inset-bottom)) 24px',
          zIndex: 2000,
          transform: isBottomPanelExpanded ? 'translateY(0)' : (matches.length > 0 ? 'translateY(calc(100% - 40px - env(safe-area-inset-bottom)))' : 'translateY(100%)'),
          transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background 0.3s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        {/* Drag Handle Top Bar */}
        <div 
          onClick={() => { setDrawerMode('driver'); setIsBottomPanelExpanded(!isBottomPanelExpanded); }}
          style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}
        >
           {/* Center Pill */}
           <ChevronUp size={28} color="#888" style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', opacity: isBottomPanelExpanded ? 0 : 1, transition: 'opacity 0.2s' }} />
           
           {/* Top Right Close Applet */}
           <div onClick={(e) => { e.stopPropagation(); setIsBottomPanelExpanded(false); }} style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center', opacity: isBottomPanelExpanded ? 1 : 0, transition: 'opacity 0.2s', cursor: 'pointer' }}>
             <X size={24} color="#888" strokeWidth={2} />
           </div>
        </div>

        {/* Content (only visible fully when expanded) */}
        <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', opacity: isBottomPanelExpanded ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isBottomPanelExpanded ? 'auto' : 'none' }}>
           <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '8px' }}>
           {drawerMode === 'request' ? (
             <div style={{ textAlign: 'center', width: '100%', padding: '24px 0' }}>
               <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                 {volatilePassengerState?.status === 'completed' ? 'This ride is completed.' : volatilePassengerState?.status === 'cancelled' ? 'This ride has been cancelled.' : 'Cancel your ride request?'}
               </h3>
               <p style={{ margin: '0 0 24px', color: '#ccc', fontSize: '0.9rem' }}>
                 {volatilePassengerState?.status === 'completed' ? 'Your historical records are safely stored.' : volatilePassengerState?.status === 'cancelled' ? 'This request is natively archived.' : 'You can retract your active request below.'}
               </p>
               
               {(volatilePassengerState?.status !== 'completed' && volatilePassengerState?.status !== 'cancelled') && (
                 <button 
                   onClick={() => setShowCancelModal(true)}
                   style={{ width: '100%', padding: '16px', background: '#333', border: 'none', borderRadius: '8px', color: '#ccc', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                 >
                   Cancel Ride
                 </button>
               )}
             </div>
           ) : activeDriver ? (
             <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', textAlign: 'center', paddingBottom: '0' }}>
                 <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '3px solid #444', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                     {activeDriver.profilePic ? (
                        <img src={activeDriver.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="driver" />
                     ) : (
                        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ccc' }}>{getInitials(activeDriver.name, 'D')}</span>
                     )}
                 </div>
                 <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 600, color: '#fff' }}>{activeDriver.name}</h2>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
                   {[1, 2, 3, 4, 5].map(starNum => {
                      const ratingVal = parseFloat(activeDriver.rating || '5.0') || 0;
                      const isFilled = starNum <= Math.round(ratingVal);
                      return <Star key={starNum} size={14} fill={isFilled ? "#ffb800" : "#444"} color={isFilled ? "#ffb800" : "#444"} />;
                   })}
                   <span style={{ fontSize: '0.9rem', color: '#eee', fontWeight: 600, marginLeft: '4px' }}>{activeDriver.rating || '5.0'} <span style={{ fontWeight: 400 }}>({activeDriver.reviews || '0'})</span></span>
                 </div>
                 
                 {activeDriver.plateNumber && (
                    <div style={{ marginBottom: '24px', fontSize: '0.9rem', color: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '16px' }}>
                       <Car size={16} color="#bbb" />
                       <span><span style={{ fontWeight: 700, color: '#fff' }}>{activeDriver.plateNumber}</span> • {activeDriver.carMake} {activeDriver.carModel} <span style={{ opacity: 0.8 }}>({activeDriver.carColor})</span></span>
                    </div>
                 )}

                 {/* "Ride Details" divider */}
                 <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <span style={{ padding: '0 16px', fontWeight: 700, fontSize: '1.1rem', color: '#f1f1f1' }}>Ride Details</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                 </div>

                 {/* Date, Time, Seats */}
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8da4bd' }}>
                          <Calendar size={14} />
                          <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>
                             {(activeDriver.rawRequest?.date || activeDriver.rawRequest?.time) ? dayjs(activeDriver.rawRequest?.date || activeDriver.rawRequest?.time).format('MMMM D, YYYY') : 'Unknown Date'}
                          </span>
                       </div>
                       <span style={{ color: '#444' }}>|</span>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8da4bd' }}>
                          <Clock size={14} />
                          <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>
                             {activeDriver.rawRequest?.time ? dayjs(activeDriver.rawRequest.time).format('h:mm A') : activeDriver.time}
                          </span>
                       </div>
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: activeDriver.type === 'completed' || activeDriver.type === 'confirmed' ? '#9cc93a' : activeDriver.type === 'match' ? '#00b0f0' : activeDriver.type === 'offered' ? '#ff0043' : activeDriver.type === 'request' ? '#eab308' : '#888' }}>{activeDriver.seats} seat{activeDriver.seats > 1 ? 's' : ''} available</span>
                 </div>

                 {/* Locations */}
                 <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                    {/* Origin */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                       <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#aaa', marginBottom: '4px' }}>From:</span>
                       {(() => {
                          const addrStr = activeDriver.rawRequest?.from?.address || 'Unknown Pickup Address';
                          const parts = addrStr.split(',');
                          const mainAddr = parts[0] ? parts[0].trim() : addrStr;
                          const subAddr = parts.length > 1 ? parts.slice(1).join(',').trim() : '';
                          return (
                             <>
                                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{mainAddr}</span>
                                {subAddr && <span style={{ fontSize: '0.9rem', color: '#bbb' }}>{subAddr}</span>}
                             </>
                          );
                       })()}
                    </div>

                    {/* Destination */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                       <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#aaa', marginBottom: '4px' }}>To:</span>
                       {(() => {
                          const addrStr = activeDriver.rawRequest?.to?.address || 'Unknown Dropoff Address';
                          const parts = addrStr.split(',');
                          const mainAddr = parts[0] ? parts[0].trim() : addrStr;
                          const subAddr = parts.length > 1 ? parts.slice(1).join(',').trim() : '';
                          return (
                             <>
                                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{mainAddr}</span>
                                {subAddr && <span style={{ fontSize: '0.9rem', color: '#bbb' }}>{subAddr}</span>}
                             </>
                          );
                       })()}
                    </div>
                 </div>

                 {activeDriver.rawRequest?.note && activeDriver.rawRequest.note.trim() !== '' && (
                   <p style={{ margin: '0', fontSize: '0.95rem', color: '#ddd', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', width: '100%', textAlign: 'left' }}>
                     <strong style={{ fontStyle: 'normal', color: '#aaa', fontWeight: 600, marginRight: '4px' }}>Note:</strong>"{activeDriver.rawRequest.note}"
                   </p>
                 )}
             </div>
           ) : (
             <div style={{ textAlign: 'center', width: '100%', padding: '24px 0' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  {volatilePassengerState?.status === 'cancelled' ? 'Ride Cancelled' : 'Driver Overlay'}
                </h3>
                <p style={{ margin: 0, color: '#ccc', fontSize: '0.9rem' }}>
                  {volatilePassengerState?.status === 'cancelled' ? 'This ride has been cancelled.' : 'No active driver overview.'}
                </p>
             </div>
           )}
           </div>

           {/* Collapse Drawer Button */}
           <div 
              onClick={() => setIsBottomPanelExpanded(false)} 
              style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', cursor: 'pointer', marginBottom: '-8px' }}
           >
              <ChevronDown size={32} color="#888" style={{ opacity: 0.8 }} />
           </div>
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
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel this request?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel this ride request? This action cannot be undone.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCancelModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep Ride
              </button>
              <button 
                onClick={async () => {
                  try {
                      if (ride?.id) {
                          await updateDoc(doc(db, 'rideRequests', ride.id), { status: 'cancelled', expiresAt: deleteField() });
                          
                          const matchingOffersRef = query(collection(db, 'rideOffers'), where('requestedByPassengerIds', 'array-contains', ride.id));
                          const offersSnap = await getDocs(matchingOffersRef);
                          
                          for (const offerDoc of offersSnap.docs) {
                             const data = offerDoc.data();
                             const updatePayload = { requestedByPassengerIds: arrayRemove(ride.id) };
                             if (data.status === 'confirmed' && data.requestedByRideId === ride.id) {
                                updatePayload.seatsTaken = increment(-Math.abs(parseInt(ride.seats) || 1));
                             }
                             try {
                                await updateDoc(doc(db, 'rideOffers', offerDoc.id), updatePayload);
                             } catch (err) { console.error("clean up fail", err); }
                          }
                      }
                      navigate('/my-rides', { state: { initialTab: 'History' } });
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

      {/* CUSTOM RETRACT JOIN REQUEST MODAL */}
      {showRetractRequestModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel join request?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel the request to join this driver's matched ride?</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowRetractRequestModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep Request
              </button>
              <button 
                onClick={async () => {
                  try {
                      if (matchToRetract) {
                         // Optimistic fallback mapped into container locally
                         setMatches(prev => prev.map(m => m.id === matchToRetract ? { ...m, type: 'match' } : m));
                         
                         // Clear the passenger's direct link structurally
                         await updateDoc(doc(db, 'rideRequests', ride.id), { status: 'open', offeredByRideId: null });
                         
                         // Remove the passenger from the Driver's queue natively
                         await updateDoc(doc(db, 'rideOffers', matchToRetract), { requestedByPassengerIds: arrayRemove(ride.id) });
                      }
                      setShowRetractRequestModal(false);
                      setMatchToRetract(null);
                  } catch (e) {
                      console.error("Join Retraction error:", e);
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
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel confirmed ride?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel this confirmed ride?</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCancelConfirmedModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep Ride
              </button>
              <button 
                onClick={async () => {
                  try {
                      if (confirmedMatchToCancel) {
                         setMatches(prev => prev.map(m => m.id === confirmedMatchToCancel ? { ...m, type: 'match' } : m));
                         
                         // Clear the passenger's direct link structurally
                         await updateDoc(doc(db, 'rideRequests', ride.id), { status: 'open', offeredByRideId: null });

                         // Extract the passenger natively AND restore driver capacity seamlessly resolving state
                         const passengerSeatCount = parseInt(ride?.seats) || 1;
                         await updateDoc(doc(db, 'rideOffers', confirmedMatchToCancel), { 
                           requestedByPassengerIds: arrayRemove(ride.id),
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
               {capacityModalText || "You cannot accept this offer because the driver's vehicle has already reached maximum seating capacity."}
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
