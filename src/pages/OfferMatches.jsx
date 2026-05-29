import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MessageCircle, MoreHorizontal, User, Check, List, Star, Phone, X, Loader2, Play, Calendar, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, getDoc, increment, arrayRemove, arrayUnion, where, deleteField, runTransaction } from 'firebase/firestore';
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
  html: `<div style="width:16px;height:16px;background:${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'};border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px ${type === 'completed' ? 'rgba(156,201,58,0.6)' : type === 'confirmed' ? 'rgba(156,201,58,0.6)' : type === 'match' ? 'rgba(0,176,240,0.6)' : type === 'offered' ? 'rgba(234,179,8,0.6)' : type === 'request' ? 'rgba(255,0,67,0.6)' : 'rgba(136,136,136,0.6)'};"></div>`,
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
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>`,
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
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getMeetDropSpotIcon = (type) => new L.DivIcon({
  className: 'custom-meet-drop-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${type === 'completed' ? '#9cc93a' : type === 'confirmed' ? '#9cc93a' : type === 'match' ? '#00b0f0' : type === 'offered' ? '#eab308' : type === 'request' ? '#ff0043' : '#888'};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
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


export default function OfferMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const carouselRef = useRef(null);
  const geometryCache = useRef({});
  
  const ride = location.state?.ride;
  
  const [driverRoute, setDriverRoute] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [actionProcessingId, setActionProcessingId] = useState(null);
  const [activePassengerId, setActivePassengerId] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const [drawerMode, setDrawerMode] = useState('passenger');
  const [rideStatus, setRideStatus] = useState(ride?.status || 'open');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRetractOfferModal, setShowRetractOfferModal] = useState(false);
  const [matchToRetract, setMatchToRetract] = useState(null);
  const [showCapacityFullModal, setShowCapacityFullModal] = useState(false);
  const [capacityModalText, setCapacityModalText] = useState("");
  const [showCancelConfirmedModal, setShowCancelConfirmedModal] = useState(false);
  const [confirmedMatchToCancel, setConfirmedMatchToCancel] = useState(null);
  const [showStartRideModal, setShowStartRideModal] = useState(false);
  const [showActiveRideWarningModal, setShowActiveRideWarningModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [dynamicRideState, setDynamicRideState] = useState(ride);
  const dynamicRideStateRef = useRef(ride);

  useEffect(() => {
    if (!ride?.id) return;
    const unsub = onSnapshot(doc(db, 'rideOffers', ride.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setDynamicRideState(data);
        dynamicRideStateRef.current = data;
      }
    });
    return () => unsub();
  }, [ride?.id]);

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverFrom.lon},${driverFrom.lat};${driverTo.lon},${driverTo.lat}?geometries=geojson&overview=full`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`OSRM Error: ${res.status}`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setDriverRoute(coords);
      } catch (err) {
        if (err.name !== 'AbortError') console.error("OSRM Driver Route Error", err);
        setDriverRoute([[driverFrom.lat, driverFrom.lon], [driverTo.lat, driverTo.lon]]);
      }
    };
    fetchDriverRoute();
  }, [driverFrom.lat, driverFrom.lon, driverTo.lat, driverTo.lon]);

  // Matching Engine: Fetch and filter passengers dynamically
  useEffect(() => {
    if (driverRoute.length === 0) return;
    if (['cancelled', 'expired'].includes(dynamicRideStateRef.current?.status)) {
        setIsLoadingMatches(false);
        setMatches([]);
        return;
    }

    setIsLoadingMatches(true);
    let reqRef;
    if (dynamicRideStateRef.current?.status === 'completed') {
        reqRef = query(collection(db, 'rideRequests'), where('offeredByRideId', '==', dynamicRideStateRef.current.id));
    } else {
        reqRef = query(collection(db, 'rideRequests'), where('status', 'in', ['open', 'request', 'offered', 'matched', 'confirmed', 'in_progress']));
    }
    
    const unsubscribe = onSnapshot(reqRef, async (snap) => {
        const reqDocs = [];
        snap.forEach(doc => reqDocs.push({ id: doc.id, ...doc.data() }));

        const matchPromises = reqDocs.map(async (req) => {
           if (!req.from?.lat || !req.to?.lat) return null;
           if (ride?.userId && req.userId === ride.userId) return null; // Prevent self-matching
           
           // TEMPORAL CHECK LAUNCH
           if (!dynamicRideStateRef.current?.date || !req.date || !dynamicRideStateRef.current?.time || !req.time) return null;
           const dRide = dayjs(dynamicRideStateRef.current.date).format('YYYY-MM-DD');
           const dReq = dayjs(req.date).format('YYYY-MM-DD');
           if (dRide !== dReq) return null;
           const isLinkedMatch = req.offeredByRideId === dynamicRideStateRef.current?.id || 
                                 (dynamicRideStateRef.current?.requestedByPassengerIds || []).includes(req.id) || 
                                 (dynamicRideStateRef.current?.offeredToPassengerIds || []).includes(req.id);
           if (!isLinkedMatch && dRide < dayjs().subtract(1, 'day').format('YYYY-MM-DD')) return null;
           const mRide = dayjs(dynamicRideStateRef.current.time).hour() * 60 + dayjs(dynamicRideStateRef.current.time).minute();
           const mReq = dayjs(req.time).hour() * 60 + dayjs(req.time).minute();
           const timeDiff = mRide - mReq;
           if (!isLinkedMatch && (timeDiff < -60 || timeDiff > 180)) return null;
           // CRITICAL FIX: Hide passengers who are already locked into other drivers' carpools natively!
           if (['confirmed', 'in_progress', 'completed'].includes(req.status) && req.offeredByRideId && req.offeredByRideId !== dynamicRideStateRef.current?.id) return null;

           // CRITICAL FIX: Hide passengers who structurally completely cancelled their own ride requests globally!
           if (req.status === 'cancelled') return null;

           // CRITICAL FIX: If the driver's OWN ride is already historically completed or cancelled, do not evaluate or show any new unrelated open passenger requests!
           if ((dynamicRideStateRef.current?.status === 'completed' || dynamicRideStateRef.current?.status === 'cancelled' || dynamicRideStateRef.current?.status === 'in_progress') && req.offeredByRideId !== dynamicRideStateRef.current?.id) return null;

           let typeStatus = 'match';
           const driverIsConfirmedWithThisPassenger = ['confirmed', 'completed', 'in_progress'].includes(req.status) && req.offeredByRideId === dynamicRideStateRef.current?.id;

           if (driverIsConfirmedWithThisPassenger) {
               typeStatus = req.status;
           } else if ((dynamicRideStateRef.current?.offeredToPassengerIds || []).includes(req.id)) {
               typeStatus = 'offered';
           } else if ((dynamicRideStateRef.current?.requestedByPassengerIds || []).includes(req.id)) {
               typeStatus = 'request';
           }
           const nameParams = req.userName || 'Passenger';
           const timeParams = req.time ? dayjs(req.time).format('h:mma') : 'Any time';
           let userRating = req.userRating || '0.0';
           let userReviews = req.userReviews || 0;

           if (req.userId) {
              try {
                  const uSnap = await getDoc(doc(db, 'users', req.userId));
                  if (uSnap.exists()) {
                     const uData = uSnap.data();
                     if (uData.rating) userRating = parseFloat(uData.rating).toFixed(1);
                     if (uData.reviews) userReviews = uData.reviews;
                     if (uData.photoURL) req.userProfilePic = uData.photoURL;
                  }
              } catch (e) {}
           }

           // PREVENT API SPAM - INSTANT CACHE YIELDING LOCALLY
           if (geometryCache.current[req.id]) {
               return {
                   ...geometryCache.current[req.id],
                   type: typeStatus,
                   name: nameParams,
                   time: timeParams,
                   rating: userRating,
                   reviews: userReviews,
                   seats: req.seats || 1,
                   profilePic: req.userProfilePic || '',
                   rawRequest: req
               };
           }

           const pLat = req.from.lat; const pLon = req.from.lon;
           const dLat = req.to.lat;   const dLon = req.to.lon;
           
           try {
              // Extract passenger route dynamically!
              const passengerFromPos = { lat: pLat, lon: pLon };
              const passengerToPos = { lat: dLat, lon: dLon };

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
              const bestPickup = await findBestNetworkNode(passengerFromPos);
              const bestDropoff = await findBestNetworkNode(passengerToPos);

              if (!isLinkedMatch && (!bestPickup || !bestDropoff || bestPickup.idx >= bestDropoff.idx)) return null;

              let pickupIdx = bestPickup?.idx || 0;
              let dropIdx = bestDropoff?.idx || (driverRoute.length - 1);
              if (isLinkedMatch && pickupIdx >= dropIdx) {
                  pickupIdx = 0;
                  dropIdx = Math.max(0, driverRoute.length - 1);
              }
              let meetPickup = driverRoute[pickupIdx] || [driverFrom.lat, driverFrom.lon];
              let meetDropoff = driverRoute[dropIdx] || [driverTo.lat, driverTo.lon];
              
              let interceptPaths = {
                 pickupPath: [[passengerFromPos.lat, passengerFromPos.lon], [meetPickup[0], meetPickup[1]]],
                 dropoffPath: [[meetDropoff[0], meetDropoff[1]], [passengerToPos.lat, passengerToPos.lon]]
              };
              
              // Segment 1 & 3: Connector routes mapped natively to exactly the OSRM geometric paths!
              try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 2000);
                  const pFetch = fetch(`https://router.project-osrm.org/route/v1/driving/${passengerFromPos.lon},${passengerFromPos.lat};${meetPickup[1]},${meetPickup[0]}?geometries=geojson`, { signal: controller.signal });
                  const dFetch = fetch(`https://router.project-osrm.org/route/v1/driving/${meetDropoff[1]},${meetDropoff[0]};${passengerToPos.lon},${passengerToPos.lat}?geometries=geojson`, { signal: controller.signal });
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
                 sharedPath: driverRoute.slice(pickupIdx, dropIdx + 1),
                 rawRequest: req
              };

              // Map to local logical memory
              geometryCache.current[req.id] = geometricPayload;

              return {
                 ...geometricPayload,
                 type: typeStatus,
                 name: nameParams,
                 time: timeParams,
                 rating: userRating,
                 reviews: userReviews,
                 seats: req.seats || 1,
                 profilePic: req.userProfilePic || '',
                 userId: req.userId
              };

           } catch (e) {
              console.error("OSRM Pass fetch failure", e);
              return null;
           }
        });
        
        const results = await Promise.all(matchPromises);
        const validMatches = results.filter(m => m !== null);
        
        // Re-apply the absolute freshest dynamicRideStateRef synchronously before commit to prevent async stale overwrites
        const fullyFreshMatches = validMatches.map(m => {
            let finalType = m.type;
            const req = m.rawRequest;
            if (!req) return m;

            const driverIsConfirmedWithThisPassenger = ['confirmed', 'completed', 'in_progress'].includes(req.status) && req.offeredByRideId === dynamicRideStateRef.current?.id;
            if (driverIsConfirmedWithThisPassenger) {
                finalType = req.status;
            } else if ((dynamicRideStateRef.current?.offeredToPassengerIds || []).includes(m.id)) {
                finalType = 'offered';
            } else if ((dynamicRideStateRef.current?.requestedByPassengerIds || []).includes(m.id)) {
                finalType = 'request';
            } else {
                finalType = 'match';
            }
            
            return { ...m, type: finalType };
        });
        
        // Trigger browser notifications for important events securely tracked via session
        fullyFreshMatches.forEach(m => {
            if (m.type === 'match') {
                sendRideNotification(`new_match_${ride?.id}_${m.id}`, 'New ride match found!');
            } else if (m.type === 'request') {
                sendRideNotification(`request_${ride?.id}_${m.id}`, `${m.name} requested to join your ride.`);
            } else if (m.type === 'confirmed') {
                sendRideNotification(`accepted_offer_${ride?.id}_${m.id}`, `${m.name} accepted your ride offer.`);
            }
        });

        setMatches(fullyFreshMatches);
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
  }, [driverRoute, driverFrom.lat, driverFrom.lon, driverTo.lat, driverTo.lon, ride?.userId, ride?.id, refreshKey]);

  // Synchronize matches when the driver's own live database document updates
  useEffect(() => {
    if (!dynamicRideState) return;
    setMatches(prev => prev.map(m => {
        let newType = m.type;
        const req = m.rawRequest;
        if (!req) return m;

        const driverIsConfirmedWithThisPassenger = ['confirmed', 'completed', 'in_progress'].includes(req.status) && req.offeredByRideId === dynamicRideState.id;
        
        if (driverIsConfirmedWithThisPassenger) {
            newType = req.status;
        } else if ((dynamicRideState.offeredToPassengerIds || []).includes(m.id)) {
            newType = 'offered';
        } else if ((dynamicRideState.requestedByPassengerIds || []).includes(m.id)) {
            newType = 'request';
        } else {
            newType = 'match';
        }
        
        return m.type !== newType ? { ...m, type: newType } : m;
    }));
  }, [dynamicRideState]);

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
    if (actionProcessingId) return;
    const requestedPassenger = matches.find(m => m.id === matchId);
    if (!requestedPassenger) return;

    if (['confirmed', 'in_progress', 'completed'].includes(requestedPassenger?.rawRequest?.status)) {
      setCapacityModalText("This passenger already has an active or confirmed booking. You cannot offer them a ride.");
      setShowCapacityFullModal(true);
      return;
    }

    const passengerSeats = parseInt(requestedPassenger?.seats) || 1;
    const currentTakenSeats = confirmedPassengers.reduce((acc, m) => acc + (parseInt(m.seats)||1), 0);
    const driverMaxSeats = parseInt(ride?.seats) || 4;

    if (currentTakenSeats + passengerSeats > driverMaxSeats) {
      setCapacityModalText(`You cannot offer a ride to this passenger. You only have ${driverMaxSeats - currentTakenSeats} seat(s) left, but the passenger requested ${passengerSeats} seat(s).`);
      setShowCapacityFullModal(true);
      return;
    }

    setActionProcessingId(matchId);

    try {
      const matchDocRef = doc(db, 'rideRequests', matchId);
      
      await runTransaction(db, async (transaction) => {
          const pSnap = await transaction.get(matchDocRef);
          if (!pSnap.exists()) throw new Error("Passenger request no longer exists.");
          
          const pData = pSnap.data();
          if (['confirmed', 'in_progress', 'completed'].includes(pData.status)) {
              throw new Error("PASSENGER_UNAVAILABLE");
          }

          if (ride?.id) {
              const driverDocRef = doc(db, 'rideOffers', ride.id);
              const dSnap = await transaction.get(driverDocRef);
              if (dSnap.exists()) {
                  const dData = dSnap.data();
                  const currentOfferedTo = dData.offeredToPassengerIds || [];
                  if (!currentOfferedTo.includes(matchId)) {
                      currentOfferedTo.push(matchId);
                  }
                  transaction.update(driverDocRef, {
                      offeredToPassengerIds: currentOfferedTo
                  });
              }
          }

          transaction.update(matchDocRef, { 
            status: 'offered', 
            offeredByRideId: ride?.id || 'unknown' 
          });
      });

      // Optimistic generic map transition
      setMatches((prev) => 
        prev.map((m) => m.id === matchId ? { ...m, type: 'offered' } : m)
      );
    } catch (error) {
      console.error("Offered request state synchronization failed:", error);
      if (error.message === "PASSENGER_UNAVAILABLE") {
          setCapacityModalText("This passenger has just confirmed a ride with someone else.");
          setShowCapacityFullModal(true);
      }
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleAcceptRequest = async (matchId) => {
    if (actionProcessingId) return;
    const requestedPassenger = matches.find(m => m.id === matchId);
    
    if (['confirmed', 'in_progress', 'completed'].includes(requestedPassenger?.rawRequest?.status)) {
      setCapacityModalText("This passenger already has an active or confirmed booking. You cannot accept this request.");
      setShowCapacityFullModal(true);
      return;
    }
    
    const passengerSeats = parseInt(requestedPassenger?.seats) || 1;
    const currentTakenSeats = confirmedPassengers.reduce((acc, m) => acc + (parseInt(m.seats)||1), 0);
    const driverMaxSeats = parseInt(ride?.seats) || 4;

    if (currentTakenSeats + passengerSeats > driverMaxSeats) {
      setCapacityModalText(`You cannot accept this request. You only have ${driverMaxSeats - currentTakenSeats} seat(s) left, but the passenger requested ${passengerSeats} seat(s).`);
      setShowCapacityFullModal(true);
      return;
    }
    
    setActionProcessingId(matchId);

    try {
      const matchDocRef = doc(db, 'rideOffers', ride.id);
      const passDocRef = doc(db, 'rideRequests', matchId);

      await runTransaction(db, async (transaction) => {
          const dSnap = await transaction.get(matchDocRef);
          if (!dSnap.exists()) throw new Error("Driver ride no longer exists.");
          
          const dData = dSnap.data();
          const dConfirmedCount = parseInt(dData.seatsTaken || 0);
          const dMaxSeats = parseInt(dData.seats || 4);
          
          if (dConfirmedCount + passengerSeats > dMaxSeats) {
              throw new Error("CAPACITY_FULL");
          }

          transaction.update(matchDocRef, { 
            status: 'confirmed',
            seatsTaken: increment(passengerSeats)
          });
          
          transaction.update(passDocRef, {
            status: 'confirmed',
            offeredByRideId: ride.id
          });
      });

      setMatches((prev) => 
        prev.map((m) => m.id === matchId ? { ...m, type: 'confirmed' } : m)
      );
    } catch (error) {
      console.error("Accept request state synchronization failed:", error);
      if (error.message === "CAPACITY_FULL") {
          setCapacityModalText("You cannot accept this request because your vehicle has just reached maximum capacity.");
          setShowCapacityFullModal(true);
      }
    } finally {
      setActionProcessingId(null);
    }
  };

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

  const confirmedPassengers = matches.filter(m => m.type === 'confirmed' || m.type === 'completed');

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
      {isLoadingMatches && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'white', padding: '15px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex' }}>
          <Loader2 size={32} color="#00b0f0" style={{ animation: 'spin 1.2s linear infinite' }} />
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
            <Polyline positions={activePassRoute} pathOptions={{ color: activePassenger.type === 'completed' ? '#9cc93a' : activePassenger.type === 'confirmed' ? '#9cc93a' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888', weight: 6, opacity: 1 }} />
            
            {/* Dotted theoretical intercept lines from Passenger Origin -> Nearest Driver node */}
            {driverRoute.length > 0 && activePassenger?.meetPickup && (
               <Polyline 
                 positions={activePassenger?.interceptPaths?.pickupPath || [[activePassenger.pickup.lat, activePassenger.pickup.lon], [activePassenger.meetPickup.lat, activePassenger.meetPickup.lon]]} 
                 pathOptions={{ color: activePassenger.type === 'completed' ? '#9cc93a' : activePassenger.type === 'confirmed' ? '#9cc93a' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
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
                       <AvatarFallback src={activePassenger.profilePic} name={activePassenger.name} size={24} />
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
                 pathOptions={{ color: activePassenger.type === 'completed' ? '#9cc93a' : activePassenger.type === 'confirmed' ? '#9cc93a' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888', weight: 4, opacity: 1, dashArray: '5, 8' }}
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
          <div style={{ padding: 'calc(1rem + env(safe-area-inset-top)) 1rem 1rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: '#fff' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => navigate('/my-rides', { state: { initialTab: location.state?.fromTab || location.state?.initialTab || 'Pending' } })} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{rideStatus === 'completed' ? 'Offer Ride (Completed)' : rideStatus === 'in_progress' ? 'Offer Ride (Active)' : 'Offer Ride'}</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>{rideTimeStr}, {rideDateStr}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: ride?.seats || 4 }).map((_, i) => {
                   const absoluteConfirmedCount = matches.filter(m => m.type === 'confirmed' || m.type === 'completed').reduce((acc, m) => acc + (parseInt(m.seats) || 1), 0);
                   const isTaken = i < absoluteConfirmedCount;
                   return (
                     <User key={i} size={16} color={isTaken ? '#9cc93a' : '#ccc'} fill={isTaken ? '#9cc93a' : '#ccc'} />
                   );
                })}
              </div>
              {![ 'completed', 'cancelled', 'expired' ].includes(dynamicRideState?.status || ride?.computedStatus || rideStatus) && (
                <button disabled={isLoadingMatches} onClick={() => { setDrawerMode('ride'); setIsBottomPanelExpanded(true); }} style={{ background: 'rgba(255,255,255,0.2)', height: 32, width: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: '#fff', cursor: isLoadingMatches ? 'not-allowed' : 'pointer', marginLeft: 4, transition: 'background 0.3s, opacity 0.3s', opacity: isLoadingMatches ? 0.5 : 1 }}>
                  <Play size={16} fill="#fff" style={{ marginLeft: 2 }} />
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
        
        {/* Floating Menu Button */}
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
            <p style={{ margin: 0, color: '#555', fontWeight: 600, fontSize: '1.2rem' }}>No Matches Found 😢</p>
            <p style={{ margin: '8px 0 0', color: '#888', fontSize: '0.9rem', lineHeight: '1.4' }}>We couldn't find any passengers looking for a ride along your planned route right now.</p>
          </div>
        ) : (
          matches.map((match, index) => (
          <div 
            key={match.id}
            onClick={() => {
               if (activePassengerId !== match.id) {
                  setActivePassengerId(match.id);
                  if (carouselRef.current) {
                      carouselRef.current.scrollTo({ left: index * (window.innerWidth * 0.85), behavior: 'smooth' });
                  }
               }
               setDrawerMode('passenger');
               setIsBottomPanelExpanded(prev => activePassengerId === match.id ? !prev : true);
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
            <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', position: 'relative' }}>
               
               <div>
                 <AvatarFallback src={match.profilePic} name={match.name} size={50} />
               </div>
               
               <div style={{ flex: 1 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: match.type === 'confirmed' ? '#9cc93a' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : match.type === 'request' ? '#ff0043' : '#888', fontWeight: 600 }}>
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
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{[1, 2, 3, 4, 5].map(starNum => {const ratingVal = parseFloat(match.rating) || 0; const isFilled = starNum <= Math.round(ratingVal); return <Star key={starNum} size={12} fill={isFilled ? "#ffb800" : "#eaeaea"} color={isFilled ? "#ffb800" : "#eaeaea"} />;})}<span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px' }}>{match.rating} ({match.reviews})</span></div>
                 )}
               </div>

               <div style={{ textAlign: 'right' }}>
                  {match.type === 'completed' || match.type === 'confirmed' || match.type === 'match' || match.type === 'offered' || match.type === 'request' ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        {Array.from({ length: match.seats || 4 }).map((_, i) => (
                           <User key={i} size={12} fill={match.type === 'completed' ? '#9cc93a' : match.type === 'confirmed' ? '#9cc93a' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : '#ff0043'} color={match.type === 'completed' ? '#9cc93a' : match.type === 'confirmed' ? '#9cc93a' : match.type === 'match' ? '#00b0f0' : match.type === 'offered' ? '#eab308' : '#ff0043'} />
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
                     onClick={() => handleMessageContact(match.userId)}
                     style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   <button 
                     onClick={() => { if (match.type !== 'completed') { setConfirmedMatchToCancel(match.id); setShowCancelConfirmedModal(true); } }}
                     style={{ flex: 1, padding: '16px', background: match.type === 'completed' ? '#9cc93a' : '#9cc93a', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: match.type === 'completed' ? 'default' : 'pointer' }}>
                     {match.type === 'completed' ? 'Completed Ride' : 'Confirmed'}
                   </button>
                 </>
               )}

               {/* State 2: Match -> Offer Ride */}
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
                     onClick={() => handleOfferRide(match.id)} 
                     disabled={!!actionProcessingId}
                     style={{ flex: 1, padding: '16px', background: '#00b0f0', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId && actionProcessingId !== match.id ? 0.5 : 1 }}
                   >
                     {actionProcessingId === match.id ? 'Processing...' : 'Offer Ride'}
                   </button>
                 </>
               )}

               {/* State 5: Offered -> Pending Accept */}
               {match.type === 'offered' && (
                 <>
                   <button 
                     onClick={() => handleMessageContact(match.userId)}
                     style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                   >
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
                   <button 
                     onClick={() => handleMessageContact(match.rawRequest?.userId)}
                     disabled={!!actionProcessingId}
                     style={{ position: 'relative', width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId ? 0.5 : 1 }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                     <div style={{ position: 'absolute', top: 8, right: 8, background: '#ff0043', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333' }}>1</div>
                   </button>
                   <button 
                     onClick={() => handleAcceptRequest(match.id)} 
                     disabled={!!actionProcessingId}
                     style={{ flex: 1, padding: '16px', background: '#ff0043', border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: actionProcessingId ? 'default' : 'pointer', opacity: actionProcessingId && actionProcessingId !== match.id ? 0.5 : 1 }}
                   >
                     {actionProcessingId === match.id ? 'Processing...' : 'Accept Request'}
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
          onClick={() => { setDrawerMode('passenger'); setIsBottomPanelExpanded(!isBottomPanelExpanded); }}
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
              {drawerMode === 'ride' ? (
                 <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                      {rideStatus === 'completed' ? 'This ride has gracefully concluded.' : 'Ready to start your ride?'}
                    </h3>
                    
                    {rideStatus === 'completed' ? (
                       <p style={{ margin: 0, color: '#ccc', fontSize: '0.9rem' }}>
                         Your historical records are stored permanently.
                       </p>
                    ) : (
                       <p style={{ margin: '0 0 24px', color: '#ccc', fontSize: '0.9rem' }}>
                         {confirmedPassengers.length === 0 
                           ? "You don't have any confirmed passenger yet."
                           : `You have ${confirmedPassengers.length} confirmed passenger(s).`}
                       </p>
                    )}

                    {rideStatus !== 'completed' && (
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                          {confirmedPassengers.length > 0 ? (
                             confirmedPassengers.map((cp, idx) => (
                                <div key={cp.id} style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(28,32,36,0.98)', marginLeft: idx > 0 ? '-16px' : 0, overflow: 'hidden', background: '#333', zIndex: 10 - idx }}>
                                    <img src={cp.profilePic} alt="confirmed user" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                             ))
                          ) : (
                             <>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(28,32,36,0.98)', background: '#444', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <User size={28} color="#bbb" strokeWidth={2.5} />
                                </div>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(28,32,36,0.98)', marginLeft: '-20px', background: '#444', zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                   <User size={28} color="#bbb" strokeWidth={2.5} />
                                </div>
                             </>
                          )}
                       </div>
                    )}
                 </div>
              ) : activePassenger ? (
                 <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', textAlign: 'center', paddingBottom: '0' }}>
                     <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '3px solid #444', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                         {activePassenger.profilePic ? (
                            <img src={activePassenger.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="passenger" />
                         ) : (
                            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ccc' }}>{getInitials(activePassenger.name, 'P')}</span>
                         )}
                     </div>
                     <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 600, color: '#fff' }}>{activePassenger.name}</h2>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '24px' }}>
                       {[1, 2, 3, 4, 5].map(starNum => {
                          const ratingVal = parseFloat(activePassenger.rating || '5.0') || 0;
                          const isFilled = starNum <= Math.round(ratingVal);
                          return <Star key={starNum} size={14} fill={isFilled ? "#ffb800" : "#444"} color={isFilled ? "#ffb800" : "#444"} />;
                       })}
                       <span style={{ fontSize: '0.9rem', color: '#eee', fontWeight: 600, marginLeft: '4px' }}>{activePassenger.rating || '5.0'} <span style={{ fontWeight: 400 }}>({activePassenger.reviews || '0'})</span></span>
                     </div>

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
                                 {(activePassenger.rawRequest?.date || activePassenger.rawRequest?.time) ? dayjs(activePassenger.rawRequest?.date || activePassenger.rawRequest?.time).format('MMMM D, YYYY') : 'Unknown Date'}
                              </span>
                           </div>
                           <span style={{ color: '#444' }}>|</span>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8da4bd' }}>
                              <Clock size={14} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>
                                 {activePassenger.rawRequest?.time ? dayjs(activePassenger.rawRequest.time).format('h:mm A') : activePassenger.time}
                              </span>
                           </div>
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: activePassenger.type === 'completed' ? '#9cc93a' : activePassenger.type === 'confirmed' ? '#9cc93a' : activePassenger.type === 'match' ? '#00b0f0' : activePassenger.type === 'offered' ? '#eab308' : activePassenger.type === 'request' ? '#ff0043' : '#888' }}>{activePassenger.seats} seat{activePassenger.seats > 1 ? 's' : ''} requested</span>
                     </div>

                     {/* Locations */}
                     <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                        {/* Origin */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                           <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#aaa', marginBottom: '4px' }}>From:</span>
                           {(() => {
                              const addrStr = activePassenger.rawRequest?.from?.address || 'Unknown Pickup Address';
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
                              const addrStr = activePassenger.rawRequest?.to?.address || 'Unknown Dropoff Address';
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

                     {activePassenger.rawRequest?.note && activePassenger.rawRequest.note.trim() !== '' && (
                       <p style={{ margin: '0', fontSize: '0.95rem', color: '#ddd', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', width: '100%', textAlign: 'left' }}>
                         <strong style={{ fontStyle: 'normal', color: '#aaa', fontWeight: 600, marginRight: '4px' }}>Note:</strong>"{activePassenger.rawRequest.note}"
                       </p>
                     )}
                 </div>
              ) : (
                 <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                      Passenger Overlay
                    </h3>
                    <p style={{ margin: 0, color: '#ccc', fontSize: '0.9rem' }}>No active passenger overlay.</p>
                 </div>
              )}
           </div>

           {/* Buttons */}
           {drawerMode === 'ride' && rideStatus !== 'completed' && rideStatus !== 'cancelled' && (
             <>
               <button 
                 onClick={() => setShowCancelModal(true)}
                 style={{ width: '100%', padding: '16px', background: '#333', border: 'none', borderRadius: '8px', color: '#ccc', fontWeight: 700, fontSize: '1rem', marginBottom: '16px', cursor: 'pointer' }}
               >
                 Cancel Carpool
               </button>
               {rideStatus === 'in_progress' ? (
                 <button 
                   onClick={() => navigate('/active-ride', { state: { ride: { ...ride, status: 'in_progress' } } })}
                   style={{ width: '100%', padding: '16px', background: '#9cc93a', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                 >
                   Active (go to Live Tracking)
                 </button>
               ) : (
                 <button 
                   onClick={async () => {
                      try {
                         if (!ride || !ride.userId) {
                            setShowStartRideModal(true);
                            return;
                         }
                         const q = query(collection(db, 'rideOffers'), where('userId', '==', ride.userId), where('status', '==', 'in_progress'));
                         const snap = await getDocs(q);
                         if (!snap.empty) {
                            setShowActiveRideWarningModal(true);
                            return;
                         }
                         setShowStartRideModal(true);
                      } catch (err) {
                         console.error(err);
                         setShowStartRideModal(true); 
                      }
                   }}
                   style={{ width: '100%', padding: '16px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                 >
                   Start Ride
                 </button>
               )}
             </>
           )}

           {/* Collapse Drawer Button */}
           <div 
              onClick={() => setIsBottomPanelExpanded(false)} 
              style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', cursor: 'pointer', marginBottom: '-8px' }}
           >
              <ChevronDown size={32} color="#888" style={{ opacity: 0.8 }} />
           </div>
        </div>
      </div>

      {/* ACTIVE RIDE WARNING MODAL */}
      {showActiveRideWarningModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff3cd', color: '#cca000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Active Ride Exists</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>You already have a carpool formally marked as active. You must definitively complete or cancel your prior tracked ride before starting a new one.</p>
            
            <button 
              onClick={() => setShowActiveRideWarningModal(false)}
              style={{ width: '100%', padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM START RIDE MODAL */}
      {showStartRideModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e0f6ff', color: '#00b0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Start this ride?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you ready to begin? You will be transitioned to the live tracking map.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowStartRideModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Not yet
              </button>
              <button 
                onClick={async () => {
                   setShowStartRideModal(false);
                   try {
                     await updateDoc(doc(db, 'rideOffers', ride.id), { status: 'in_progress' });
                     setRideStatus('in_progress');
                     setTimeout(() => {
                       navigate('/active-ride', { state: { ride: { ...ride, status: 'in_progress' } } });
                     }, 500);
                   } catch (err) {
                     console.error("Failed to start ride", err);
                     alert("Failed to start ride. Please check network.");
                   }
                }}
                style={{ flex: 1, padding: '14px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Let's go!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CANCEL MODAL */}
      {showCancelModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel this Carpool?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you sure you want to cancel this carpool offer? This action cannot be undone.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCancelModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Keep
              </button>
              <button 
                onClick={async () => {
                   try {
                     await updateDoc(doc(db, 'rideOffers', ride.id), { status: 'cancelled', expiresAt: deleteField() });

                     const tiedPassengers = matches.filter(m => m.rawRequest?.offeredByRideId === ride.id);
                     const promises = tiedPassengers.map(m => 
                        updateDoc(doc(db, 'rideRequests', m.id), { 
                           status: 'open', 
                           offeredByRideId: null 
                        })
                     );
                     await Promise.all(promises);

                     navigate('/my-rides');
                   } catch (err) {
                     console.error("Cancellation error:", err);
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
                         
                         if (ride?.id) {
                            await updateDoc(doc(db, 'rideOffers', ride.id), {
                                offeredToPassengerIds: arrayRemove(matchToRetract)
                            });
                         }

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

