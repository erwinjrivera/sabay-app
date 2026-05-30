import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, User, List, Star, Navigation2, MapPin, MessageCircle, X, Check, Loader2, Play, Calendar, Clock, ChevronDown, ChevronUp, Compass, Layers } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, getDoc, setDoc, increment, deleteField } from 'firebase/firestore';
import { Geolocation } from '@capacitor/geolocation';
import SwipeButton from '../components/SwipeButton';
import { useAuth } from '../contexts/AuthContext';
import useWakeLock from '../hooks/useWakeLock';

const FALLBACK_MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 }]
};
function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

const getInitials = (nameStr, defaultChar = 'U') => {
  if (!nameStr) return defaultChar;
  const parts = nameStr.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return nameStr.substring(0, 2).toUpperCase();
};

function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function getClosestPointOnPath(lat, lon, path) {
    let minDist = Infinity;
    let closestPt = null;
    let bestSegmentIdx = -1;

    for (let i = 0; i < path.length - 1; i++) {
        const aLat = path[i][0];
        const aLon = path[i][1];
        const bLat = path[i+1][0];
        const bLon = path[i+1][1];
        
        // Project (lat, lon) onto segment (aLat, aLon) -> (bLat, bLon)
        // Treating as a flat 2D plane is sufficient for short road segments
        const dx = bLon - aLon;
        const dy = bLat - aLat;
        
        let projLat, projLon;
        if (dx === 0 && dy === 0) {
            projLat = aLat;
            projLon = aLon;
        } else {
            const t = ((lon - aLon) * dx + (lat - aLat) * dy) / (dx * dx + dy * dy);
            const clampedT = Math.max(0, Math.min(1, t));
            projLat = aLat + clampedT * dy;
            projLon = aLon + clampedT * dx;
        }
        
        const d = getDistanceKM(lat, lon, projLat, projLon);
        if (d < minDist) {
            minDist = d;
            closestPt = { lat: projLat, lon: projLon };
            bestSegmentIdx = i;
        }
    }
    
    return { pt: closestPt, dist: minDist, idx: bestSegmentIdx };
}

// Icons
const DriverCarIcon = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'drop-shadow(0px 3px 6px rgba(0,0,0,0.25))' }}>
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" fill="white" />
      <path d="M24 10 L36 34 L24 28 L12 34 Z" fill="#1b72e8" />
    </svg>
  </div>
);

const DriverFlagIcon = () => (
  <div style={{ background: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ddd', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
      <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  </div>
);

const DriverStartDotIcon = () => (
  <div style={{ width: 16, height: 16, background: '#555', borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 0 8px rgba(85,85,85,0.6)' }}></div>
);

const PassengerStartDotIcon = ({ color = '#8ab528' }) => (
  <div style={{ width: 16, height: 16, background: color, borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 0 8px rgba(138,181,40,0.6)' }}></div>
);

const PassengerEndPinIcon = ({ color = '#8ab528' }) => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill={color} stroke="#fff" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>
);

const MeetSpotIcon = ({ color = '#00b0f0' }) => (
  <div style={{ width: 14, height: 14, background: '#fff', borderRadius: '50%', border: `4px solid ${color}`, boxShadow: '0 0 6px rgba(0,0,0,0.3)' }}></div>
);

import { useMap as useMapLibre } from 'react-map-gl/maplibre';

function AutoFollower({ currentLat, currentLon, currentBearing, isAutoFollowing, setIsAutoFollowing, setMapBearing, is3DMode, setIs3DMode }) {
  const { current: map } = useMapLibre();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!map) return;
    const handleInteract = (e) => {
        if (e && e.originalEvent) {
            setIsAutoFollowing(false);
        }
    };
    
    // MapLibre events for interaction
    map.on('dragstart', handleInteract);
    map.on('zoomstart', handleInteract);
    map.on('pitchstart', handleInteract);
    map.on('rotatestart', handleInteract);
    
    const handleRotate = () => setMapBearing(map.getBearing());
    map.on('rotate', handleRotate);

    const handlePitch = () => setIs3DMode(map.getPitch() > 30);
    map.on('pitch', handlePitch);

    return () => {
      map.off('dragstart', handleInteract);
      map.off('zoomstart', handleInteract);
      map.off('pitchstart', handleInteract);
      map.off('rotatestart', handleInteract);
      map.off('rotate', handleRotate);
      map.off('pitch', handlePitch);
    };
  }, [map, setIsAutoFollowing, setMapBearing, setIs3DMode]);

  useEffect(() => {
    if (isAutoFollowing && currentLat && currentLon && map) {
       map.easeTo({
           center: [currentLon, currentLat],
           bearing: currentBearing || 0,
           pitch: is3DMode ? 60 : 0,
           zoom: 18.5,
           duration: isFirstRender.current ? 0 : 1000
       });
       isFirstRender.current = false;
    }
  }, [currentLat, currentLon, currentBearing, isAutoFollowing, map, is3DMode]);
  return null;
}

export default function ActiveRide() {
  useWakeLock();
  const navigate = useNavigate();
  const location = useLocation();
  const carouselRef = useRef(null);
  const { currentUser } = useAuth();
  
  const ride = location.state?.ride;
  
  const [driverRoute, setDriverRoute] = useState([]);
  const [recalculatedRoute, setRecalculatedRoute] = useState(null);
  const isRecalculatingRef = useRef(false);
  const [matches, setMatches] = useState([]);
  const [activePassengerId, setActivePassengerId] = useState(null);
  const [passengerStates, setPassengerStates] = useState({}); // id -> 0 (arrive), 1 (complete), 2 (completed)
  const [currentLocation, setCurrentLocation] = useState(null);
  const [snappedLocation, setSnappedLocation] = useState(null);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [drawerMode, setDrawerMode] = useState('ride');
  const [showCancelAllModal, setShowCancelAllModal] = useState(false);
  const [showCompleteAllModal, setShowCompleteAllModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [ratingPassenger, setRatingPassenger] = useState(null);
  const [tempRating, setTempRating] = useState(0);
  const [isFetchingMatches, setIsFetchingMatches] = useState(true);
  const [isGlobalCancelled, setIsGlobalCancelled] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showFinishCarpoolPrompt, setShowFinishCarpoolPrompt] = useState(false);
  const [isAutoFollowing, setIsAutoFollowing] = useState(true);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapRef, setMapRef] = useState(null);
  const finishCarpoolPromptFiredRef = useRef(false);
  const geometryCache = useRef({});

  useEffect(() => {
    if (matches.length > 0 && !isFetchingMatches) {
        const allDone = matches.every(m => (passengerStates[m.id] || 0) === 2);
        const allRated = matches.every(m => m.driverRatedPassenger === true);
        if (allDone && allRated && !finishCarpoolPromptFiredRef.current && !isGlobalCancelled) {
             finishCarpoolPromptFiredRef.current = true;
             setTimeout(() => setShowFinishCarpoolPrompt(true), 1500);
        }
    }
  }, [passengerStates, matches, isFetchingMatches, isGlobalCancelled]);

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

  const handleCancelAllPassengers = async () => {
    try {
      const updates = matches.map(async (m) => {
          const currentPhase = passengerStates[m.id] || 0;
          if (currentPhase < 2) {
              await updateDoc(doc(db, 'rideRequests', m.id), { 
                  status: 'cancelled',
                  expiresAt: deleteField()
              });
          }
      });
      await Promise.all(updates);

      if (ride?.id) {
          await updateDoc(doc(db, 'rideOffers', ride.id), { status: 'cancelled', expiresAt: deleteField() });
      }
      setIsGlobalCancelled(true);
      setShowCancelAllModal(false);
      setTimeout(() => setIsDrawerExpanded(true), 300);
    } catch (err) { console.error(err); }
  };

  const handleFinishCarpool = async () => {
    try {
      if (ride?.id) {
          await updateDoc(doc(db, 'rideOffers', ride.id), { status: isGlobalCancelled ? 'cancelled' : 'completed', expiresAt: deleteField() });
      }
      navigate('/my-rides', { state: { initialTab: 'History' } });
    } catch (err) { console.error(err); }
  };

  const handleCompleteAllPassengers = async () => {
    try {
      const updates = matches.map(async (m) => {
         if ((passengerStates[m.id] || 0) < 2) {
             await updateDoc(doc(db, 'rideRequests', m.id), { status: 'completed', expiresAt: deleteField() });
             if (m.userId) {
                 await setDoc(doc(db, 'users', m.userId), { completedRides: increment(1) }, { merge: true });
             }
         }
      });
      await Promise.all(updates);

      // Force local states to 2 instantly
      setPassengerStates(prev => {
          let updated = { ...prev };
          matches.forEach(m => { updated[m.id] = 2; });
          return updated;
      });
      
      setShowCompleteAllModal(false);
      setTimeout(() => setIsDrawerExpanded(true), 300);
    } catch (err) { console.error(err); }
  };

  const watchIdRef = useRef(null);
  const prevLocationRef = useRef(null);
  const computedHeadingRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const startTracking = async () => {
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
           await Geolocation.requestPermissions();
        }

        if (!isMounted) return;

        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          async (position, err) => {
            if (position && !err && isMounted) {
              const lat = position.coords.latitude;
              const lon = position.coords.longitude;
              let heading = position.coords.heading;
              
              if (prevLocationRef.current) {
                  const dist = getDistanceKM(prevLocationRef.current.lat, prevLocationRef.current.lon, lat, lon);
                  if (dist > 0.005) { // 5 meters
                      const computed = getBearing(prevLocationRef.current.lat, prevLocationRef.current.lon, lat, lon);
                      computedHeadingRef.current = computed;
                      heading = computed;
                      prevLocationRef.current = { lat, lon };
                  } else {
                      heading = computedHeadingRef.current || heading;
                  }
              } else {
                  prevLocationRef.current = { lat, lon };
              }

              setCurrentLocation({ lat, lon, heading });

              // Broadcast Live Location to Firestore
              if (ride?.id) {
                 try {
                    await updateDoc(doc(db, 'rideOffers', ride.id), {
                       currentLat: lat,
                       currentLon: lon,
                       currentHeading: heading ?? null,
                       lastLocationUpdate: new Date().toISOString()
                    });
                 } catch(err) { console.error("Broadcast failed:", err); }
              }
            }
          }
        );
      } catch (err) {
        console.error("Capacitor Tracking Error:", err);
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (watchIdRef.current) Geolocation.clearWatch({ id: watchIdRef.current });
    };
  }, [ride?.id]);

  useEffect(() => {
     const allCompleted = matches.length > 0 && matches.every(m => (passengerStates[m.id] || 0) === 2);
     if (isGlobalCancelled || allCompleted) {
        if (watchIdRef.current) {
           Geolocation.clearWatch({ id: watchIdRef.current });
           watchIdRef.current = null;
        }
     }
  }, [isGlobalCancelled, matches, passengerStates]);

  const driverFrom = ride?.from ? { lat: ride.from.lat, lon: ride.from.lon } : { lat: 14.5552, lon: 121.0535 };
  const driverTo = ride?.to ? { lat: ride.to.lat, lon: ride.to.lon } : { lat: 14.5547, lon: 121.0244 };
  const driverToLat = driverTo.lat;
  const driverToLon = driverTo.lon;
  
  const rideTimeStr = ride?.time ? dayjs(ride.time).format('h:mma') : 'Time';
  const rideDateStr = ride?.date ? dayjs(ride.date).format('MMM. D') : 'Date';

  useEffect(() => {
    const fetchDriverRoute = async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverFrom.lon},${driverFrom.lat};${driverTo.lon},${driverTo.lat}?geometries=geojson&overview=full`);
        if (!res.ok) throw new Error(`OSRM Error: ${res.status}`);
        const data = await res.json();
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setDriverRoute(coords);
      } catch (err) {
        console.error("OSRM Driver Route Error", err);
      }
    };
    fetchDriverRoute();
  }, [driverFrom.lon, driverFrom.lat, driverTo.lon, driverTo.lat]);

  // Dynamic Route Deviation Recalculation
  useEffect(() => {
    if (!currentLocation || driverRoute.length === 0) return;
    
    // Find closest point on ORIGINAL route to bridge the gap visually
    let minDistToOriginal = Infinity;
    let closestPointOnOriginal = null;
    for (let i = 0; i < driverRoute.length; i++) {
        const d = getDistanceKM(currentLocation.lat, currentLocation.lon, driverRoute[i][0], driverRoute[i][1]);
        if (d < minDistToOriginal) {
            minDistToOriginal = d;
            closestPointOnOriginal = driverRoute[i];
        }
    }

    // Auto-cleanup if driver merges back to the original route
    if (recalculatedRoute && minDistToOriginal < 0.040) {
        setRecalculatedRoute(null);
        return;
    }

    // Find closest point on active route (using true point-to-line segment projection)
    const activeRoute = recalculatedRoute || driverRoute;
    const snapResult = getClosestPointOnPath(currentLocation.lat, currentLocation.lon, activeRoute);
    
    if (snapResult.dist <= 0.075 && snapResult.pt) {
        let snappedHeading = currentLocation.heading;
        if (snapResult.idx !== -1 && snapResult.idx < activeRoute.length - 1) {
            snappedHeading = getBearing(activeRoute[snapResult.idx][0], activeRoute[snapResult.idx][1], activeRoute[snapResult.idx + 1][0], activeRoute[snapResult.idx + 1][1]);
        }
        setSnappedLocation({ lat: snapResult.pt.lat, lon: snapResult.pt.lon, heading: snappedHeading });
    } else {
        setSnappedLocation(null);
    }
    
    if (snapResult.dist > 0.075 && !isRecalculatingRef.current) {
        // Trigger recalculation!
        isRecalculatingRef.current = true;
        const fetchNewRoute = async () => {
            try {
                let bearingsQuery = '';
                if (typeof currentLocation.heading === 'number') {
                    bearingsQuery = `&bearings=${Math.round(currentLocation.heading)},90;`;
                }
                const getRoute = async (bQuery) => {
                    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${currentLocation.lon},${currentLocation.lat};${driverToLon},${driverToLat}?geometries=geojson&overview=full${bQuery}`);
                    if (!res.ok) throw new Error(`OSRM Error: ${res.status}`);
                    return await res.json();
                };
                
                let data;
                try {
                    data = await getRoute(bearingsQuery);
                    if (data.code !== 'Ok') throw new Error(data.code);
                } catch (e) {
                    if (bearingsQuery) {
                        data = await getRoute('');
                    } else {
                        throw e;
                    }
                }

                if (data.routes && data.routes.length > 0) {
                    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    setRecalculatedRoute(coords);
                }
            } catch (err) {
                console.error("OSRM Recalculation Error", err);
            } finally {
                // allow another recalculation later if they deviate again
                setTimeout(() => {
                    isRecalculatingRef.current = false;
                }, 5000); 
            }
        };
        fetchNewRoute();
    }
  }, [currentLocation, driverRoute, recalculatedRoute, driverToLat, driverToLon]);

  useEffect(() => {
    if (driverRoute.length === 0 || !ride?.id) return;
    geometryCache.current = {}; // Clear cache when driver route changes

    const reqRef = collection(db, 'rideRequests');
    const unsubscribe = onSnapshot(reqRef, async (snap) => {
        const reqDocs = [];
        snap.forEach(doc => reqDocs.push({ id: doc.id, ...doc.data() }));

        const matchPromises = reqDocs.map(async (req) => {
           if (!req.from?.lat || !req.to?.lat) return null;
           
           // SECURELY EVALUATE COMPLETED AND CONFIRMED METRICS IDENTICALLY
           if (!['confirmed', 'completed'].includes(req.status) || req.offeredByRideId !== ride?.id) return null;

           const pLat = req.from.lat; const pLon = req.from.lon;
           const dLat = req.to.lat;   const dLon = req.to.lon;
           
            try {
              // Use cached geometry if available (prevents recalculation on every Firestore snapshot)
              if (geometryCache.current[req.id]) {
                 const cached = geometryCache.current[req.id];
                 return {
                    ...cached,
                    name: req.userName || 'Passenger',
                    time: req.time ? dayjs(req.time).format('h:mma') : 'Any time',
                    status: req.status,
                    phaseFlag: req.phase || 0,
                    seats: req.seats || 1,
                    profilePic: req.userProfilePic || '',
                    driverRatedPassenger: req.driverRatedPassenger || false,
                    ratingGivenByDriver: req.ratingGivenByDriver,
                 };
              }

              // Driver route is PRIMARY constraint. Project passenger onto it.
              const passengerFromPos = { lat: pLat, lon: pLon };
              const passengerToPos = { lat: dLat, lon: dLon };

              // --- PICKUP: Road-network distance via OSRM Table API ---
              // Sample ~15 candidates along the driver route, ask OSRM for driving
              // distance from the passenger to each, pick the shortest.
              // Then refine to sub-segment precision in the winning neighbourhood.
              let pickupIdx = -1;

              try {
                  const NUM_SAMPLES = 15;
                  const routeLen = driverRoute.length;
                  const sampleStep = Math.max(1, Math.floor(routeLen / NUM_SAMPLES));
                  const candidates = [];
                  for (let i = 0; i < routeLen; i += sampleStep) {
                      candidates.push({ idx: i, pt: driverRoute[i] });
                  }
                  if (candidates[candidates.length - 1].idx !== routeLen - 1) {
                      candidates.push({ idx: routeLen - 1, pt: driverRoute[routeLen - 1] });
                  }

                  let coords = `${pLon},${pLat}`;
                  candidates.forEach(c => { coords += `;${c.pt[1]},${c.pt[0]}`; });

                  const tblRes = await fetch(
                      `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance`
                  );
                  if (!tblRes.ok) throw new Error(`OSRM Error: ${tblRes.status}`);
                  const tblData = await tblRes.json();

                  if (tblData.code === 'Ok' && tblData.distances?.[0]) {
                      let minDist = Infinity;
                      let bestCandIdx = 0;
                      for (let i = 0; i < candidates.length; i++) {
                          const d = tblData.distances[0][i + 1];
                          if (d !== null && d !== undefined && d < minDist) {
                              minDist = d;
                              bestCandIdx = i;
                          }
                      }
                      // Refine: Euclidean closest in the neighbourhood of the winner
                      const winner = candidates[bestCandIdx];
                      const halfStep = Math.floor(sampleStep / 2);
                      const refStart = Math.max(0, winner.idx - halfStep);
                      const refEnd = Math.min(routeLen - 1, winner.idx + halfStep);
                      let bestRefDist = Infinity;
                      for (let i = refStart; i <= refEnd; i++) {
                          const dist = getDistanceKM(driverRoute[i][0], driverRoute[i][1], pLat, pLon);
                          if (dist < bestRefDist) { bestRefDist = dist; pickupIdx = i; }
                      }
                  }
              } catch (e) {}

              // Fallback: Euclidean with departure-zone skip
              if (pickupIdx < 0) {
                 let bestPickDist = Infinity;
                 let cumDist = 0;
                 for (let i = 0; i < driverRoute.length; i++) {
                    if (i > 0) cumDist += getDistanceKM(driverRoute[i][0], driverRoute[i][1], driverRoute[i-1][0], driverRoute[i-1][1]);
                    if (cumDist < 0.5) continue;
                    const dist = getDistanceKM(driverRoute[i][0], driverRoute[i][1], passengerFromPos.lat, passengerFromPos.lon);
                    if (dist < bestPickDist) { bestPickDist = dist; pickupIdx = i; }
                 }
                 if (pickupIdx < 0) {
                    driverRoute.forEach((pt, idx) => {
                       const dist = getDistanceKM(pt[0], pt[1], passengerFromPos.lat, passengerFromPos.lon);
                       if (dist < bestPickDist) { bestPickDist = dist; pickupIdx = idx; }
                    });
                 }
              }

              // --- DROP-OFF: Road-network distance via OSRM Table API ---
              // Same approach as pickup but uses destinations=0:
              // driving distance FROM each candidate ON the route TO passenger destination.
              let dropIdx = -1;

              try {
                  const NUM_DROP_SAMPLES = 15;
                  const dropRouteLen = driverRoute.length;
                  const dropStep = Math.max(1, Math.floor(dropRouteLen / NUM_DROP_SAMPLES));
                  const dropCandidates = [];
                  for (let i = 0; i < dropRouteLen; i += dropStep) {
                      dropCandidates.push({ idx: i, pt: driverRoute[i] });
                  }
                  if (dropCandidates[dropCandidates.length - 1].idx !== dropRouteLen - 1) {
                      dropCandidates.push({ idx: dropRouteLen - 1, pt: driverRoute[dropRouteLen - 1] });
                  }

                  let dropCoords = `${dLon},${dLat}`;
                  dropCandidates.forEach(c => { dropCoords += `;${c.pt[1]},${c.pt[0]}`; });

                  const dropTblRes = await fetch(
                      `https://router.project-osrm.org/table/v1/driving/${dropCoords}?destinations=0&annotations=distance`
                  );
                  if (!dropTblRes.ok) throw new Error(`OSRM Error: ${dropTblRes.status}`);
                  const dropTblData = await dropTblRes.json();

                  if (dropTblData.code === 'Ok' && dropTblData.distances) {
                      let minDropDist = Infinity;
                      let bestDropCandIdx = 0;
                      for (let i = 0; i < dropCandidates.length; i++) {
                          const d = dropTblData.distances[i + 1]?.[0];
                          if (d !== null && d !== undefined && d < minDropDist) {
                              minDropDist = d;
                              bestDropCandIdx = i;
                          }
                      }
                      // Refine: Euclidean closest in the neighbourhood of the winner
                      const dropWinner = dropCandidates[bestDropCandIdx];
                      const dropHalfStep = Math.floor(dropStep / 2);
                      const dropRefStart = Math.max(0, dropWinner.idx - dropHalfStep);
                      const dropRefEnd = Math.min(dropRouteLen - 1, dropWinner.idx + dropHalfStep);
                      let bestDropRefDist = Infinity;
                      for (let i = dropRefStart; i <= dropRefEnd; i++) {
                          const dist = getDistanceKM(driverRoute[i][0], driverRoute[i][1], dLat, dLon);
                          if (dist < bestDropRefDist) { bestDropRefDist = dist; dropIdx = i; }
                      }
                  }
              } catch (e) {}

              // Fallback: Euclidean closest
              if (dropIdx < 0) {
                 let bestDropDist = Infinity;
                 driverRoute.forEach((pt, idx) => {
                    const dist = getDistanceKM(pt[0], pt[1], passengerToPos.lat, passengerToPos.lon);
                    if (dist < bestDropDist) { bestDropDist = dist; dropIdx = idx; }
                 });
              }

              // Ensure forward progress along driver's route
              if (pickupIdx >= dropIdx) {
                 const temp = pickupIdx; pickupIdx = dropIdx; dropIdx = temp;
              }

              let meetPickup = driverRoute[pickupIdx];
              let meetDropoff = driverRoute[dropIdx];
              
              let interceptPaths = {
                 pickupPath: [[passengerFromPos.lat, passengerFromPos.lon], [meetPickup[0], meetPickup[1]]],
                 dropoffPath: [[meetDropoff[0], meetDropoff[1]], [passengerToPos.lat, passengerToPos.lon]]
              };
              
              // Connector routes: road-network paths for visual accuracy
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
              } catch (e) {}

              const dynamicSharedPath = driverRoute.slice(pickupIdx, dropIdx + 1);

              const distanceToDriverStart = getDistanceKM(pLat, pLon, driverFrom.lat, driverFrom.lon);

              // Pull realtime dynamic users statistics natively
              let userCompletedRides = 0;
              let userRating = 0.0;
              let userReviews = 0;
              if (req.userId) {
                 const uSnap = await getDoc(doc(db, 'users', req.userId));
                 if (uSnap.exists()) {
                    const uData = uSnap.data();
                    if (uData.completedRides) userCompletedRides = uData.completedRides;
                    if (uData.rating) userRating = uData.rating;
                    if (uData.reviews) userReviews = uData.reviews;
                 }
              }

              const result = {
                 id: req.id,
                 userId: req.userId,
                 rawRequest: req,
                 name: req.userName || 'Passenger',
                 time: req.time ? dayjs(req.time).format('h:mma') : 'Any time',
                 rating: userRating ? parseFloat(userRating).toFixed(1) : (req.userRating || '0.0'),
                 reviews: userReviews ? userReviews : parseInt(req.userReviews || 0),
                 completedRides: userCompletedRides,
                 driverRatedPassenger: req.driverRatedPassenger || false,
                 ratingGivenByDriver: req.ratingGivenByDriver,
                 status: req.status,
                 phaseFlag: req.phase || 0,
                 seats: req.seats || 1,
                 profilePic: req.userProfilePic || '',
                 price: '0.00 ₱',
                 pickup: { lat: pLat, lon: pLon, address: req.from.address },
                 dropoff: { lat: dLat, lon: dLon, address: req.to.address },
                 meetPickup: { lat: meetPickup[0], lon: meetPickup[1] },
                 meetDropoff: { lat: meetDropoff[0], lon: meetDropoff[1] },
                 interceptPaths,
                 sharedPath: dynamicSharedPath,
                 distanceToDriverStart
              };

              // Cache the geometry so it's stable across Firestore snapshots
              geometryCache.current[req.id] = result;
              return result;

           } catch (e) {
              return null;
           }
        });
        
        const results = await Promise.all(matchPromises);
        let validMatches = results.filter(m => m !== null);
        
        // Sync local memory phases dynamically preventing DOM dropoffs!
        setPassengerStates(prev => {
           let updated = { ...prev };
           let changed = false;
           validMatches.forEach(m => {
              if (m.status === 'completed' && updated[m.id] !== 2) {
                 updated[m.id] = 2;
                 changed = true;
              } else if (m.status !== 'completed' && m.phaseFlag === 1 && updated[m.id] !== 1) {
                 updated[m.id] = 1;
                 changed = true;
              }
           });
           return changed ? updated : prev;
        });
        
        // Sort by physical distance of passenger pickup to driver origin
        validMatches.sort((a, b) => a.distanceToDriverStart - b.distanceToDriverStart);
        
        setMatches(validMatches);
        setIsFetchingMatches(false);
        
        setActivePassengerId(currentId => {
           if (validMatches.length > 0 && !validMatches.find(m => m.id === currentId)) {
               return validMatches[0].id;
           }
           return currentId || null;
        });

    }, (error) => {});

    return () => unsubscribe();
  }, [driverRoute, driverFrom.lat, driverFrom.lon, ride?.id]);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = window.innerWidth * 0.85;
    const activeIndex = Math.round(scrollLeft / cardWidth);
    if (matches[activeIndex]) {
      setActivePassengerId(matches[activeIndex].id);
    }
  };

  const handleSwipe = async (passengerId) => {
    const passenger = matches.find(m => m.id === passengerId);
    
    setPassengerStates(prev => {
       const currentPhase = prev[passengerId] || 0;
       
       if (currentPhase === 1) { 
          // Phase 1 -> 2 (Complete Ride Slider executed)
          (async () => {
             try {
                await updateDoc(doc(db, 'rideRequests', passengerId), { status: 'completed', expiresAt: deleteField() });
                
                if (passenger?.userId) {
                    await setDoc(doc(db, 'users', passenger.userId), {
                        completedRides: increment(1)
                    }, { merge: true });
                    
                    // Visually increment without DOM bounce
                    setMatches(old => old.map(m => m.id === passengerId ? { ...m, completedRides: (m.completedRides || 0) + passenger.seats } : m));
                }
             } catch (err) { console.error("Passenger Complete Error", err); }
          })();
          setRatingPassenger(passenger);
          setTempRating(0);
          setShowRatingModal(true);
          return { ...prev, [passengerId]: 2 };
       }

       if (currentPhase === 0) {
          (async () => {
             try {
                await updateDoc(doc(db, 'rideRequests', passengerId), { phase: 1 });
             } catch (err) { console.error("Passenger Arrive Error", err); }
          })();
          return { ...prev, [passengerId]: 1 };
       }

       if (currentPhase < 2) {
          return { ...prev, [passengerId]: currentPhase + 1 };
       }
       return prev;
    });
  };

  const activePassenger = matches.find(m => m.id === activePassengerId);
  const activePassRoute = activePassenger?.sharedPath || [];
  const activePassengerPhase = activePassenger ? (passengerStates[activePassenger.id] || 0) : 0;
  const activeColor = '#8ab528';
  const effectiveLocation = snappedLocation || currentLocation;
  const currentLat = effectiveLocation ? effectiveLocation.lat : driverFrom.lat;
  const currentLon = effectiveLocation ? effectiveLocation.lon : driverFrom.lon;
  
  const currentBearing = (effectiveLocation && effectiveLocation.heading !== null && effectiveLocation.heading !== undefined) ? effectiveLocation.heading : getBearing(currentLat, currentLon, driverTo.lat, driverTo.lon);

  const toGeoJSON = (coords) => {
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
        return { type: 'FeatureCollection', features: [] };
    }
    const coordinates = coords.map(c => {
      if (Array.isArray(c)) return [c[1], c[0]];
      if (c.lat !== undefined && c.lon !== undefined) return [c.lon, c.lat];
      return [0, 0];
    });
    return { type: 'Feature', geometry: { type: 'LineString', coordinates } };
  };

  const driverRouteGeoJSON = useMemo(() => toGeoJSON(driverRoute), [driverRoute]);
  const recalcRouteGeoJSON = useMemo(() => recalculatedRoute ? toGeoJSON(recalculatedRoute) : null, [recalculatedRoute]);
  const activePassRouteGeoJSON = useMemo(() => toGeoJSON(activePassRoute), [activePassRoute]);
  
  const interceptPickupGeoJSON = useMemo(() => {
    if (!activePassenger) return toGeoJSON([]);
    const path = activePassenger.interceptPaths?.pickupPath;
    if (path) return toGeoJSON(path);
    if (activePassenger.pickup && activePassenger.meetPickup) {
      return toGeoJSON([{lat: activePassenger.pickup.lat, lon: activePassenger.pickup.lon}, {lat: activePassenger.meetPickup.lat, lon: activePassenger.meetPickup.lon}]);
    }
    return toGeoJSON([]);
  }, [activePassenger]);

  const interceptDropoffGeoJSON = useMemo(() => {
    if (!activePassenger) return toGeoJSON([]);
    const path = activePassenger.interceptPaths?.dropoffPath;
    if (path) return toGeoJSON(path);
    if (activePassenger.meetDropoff && activePassenger.dropoff) {
      return toGeoJSON([{lat: activePassenger.meetDropoff.lat, lon: activePassenger.meetDropoff.lon}, {lat: activePassenger.dropoff.lat, lon: activePassenger.dropoff.lon}]);
    }
    return toGeoJSON([]);
  }, [activePassenger]);

  const driverRoutePaint = useMemo(() => ({
    'line-color': recalculatedRoute ? '#94a3b8' : '#00b0f0',
    'line-width': recalculatedRoute ? 4 : 5,
    'line-opacity': recalculatedRoute ? 0.6 : 0.8,
    'line-dasharray': recalculatedRoute ? [1, 2] : [1]
  }), [recalculatedRoute]);

  const recalcRoutePaint = useMemo(() => ({ 'line-color': '#00b0f0', 'line-width': 5, 'line-opacity': 0.8 }), []);
  const passRoutePaint = useMemo(() => ({ 'line-color': activeColor, 'line-width': 6, 'line-opacity': 1 }), [activeColor]);
  const interceptPaint = useMemo(() => ({ 'line-color': activeColor, 'line-width': 4, 'line-dasharray': [2, 2] }), [activeColor]);

  return (
    <div style={{ height: '100dvh', width: '100vw', position: 'relative', overflow: 'hidden', background: '#eaeaea' }}>
      
      <Map
        ref={setMapRef}
        initialViewState={{
          longitude: driverFrom.lon,
          latitude: driverFrom.lat,
          zoom: 18.5,
          pitch: is3DMode ? 60 : 0,
          bearing: 0
        }}
        mapStyle={
          import.meta.env.VITE_MAPTILER_API_KEY 
            ? `https://api.maptiler.com/maps/basic-v2/style.json?key=${import.meta.env.VITE_MAPTILER_API_KEY}`
            : FALLBACK_MAP_STYLE
        }
        style={{ width: '100%', height: '100%' }}
      >
        
        {driverRoute.length > 0 && (
          <>
            <Source id="driver-route" type="geojson" data={driverRouteGeoJSON}>
              <Layer id="driver-route-line" type="line" paint={driverRoutePaint} />
            </Source>
            {recalculatedRoute && (
              <Source id="recalc-route" type="geojson" data={recalcRouteGeoJSON}>
                <Layer id="recalc-route-line" type="line" paint={recalcRoutePaint} />
              </Source>
            )}
            <Marker longitude={driverFrom.lon} latitude={driverFrom.lat} anchor="center">
              <DriverStartDotIcon />
            </Marker>
            <Marker longitude={driverTo.lon} latitude={driverTo.lat} anchor="center">
              <DriverFlagIcon />
            </Marker>
          </>
        )}
        
        {/* Real-time driver teardrop map marker indicator */}
        <Marker longitude={currentLon} latitude={currentLat} anchor="bottom" style={{ zIndex: 100 }}>
          <div style={{ transform: `rotate(${currentBearing - mapBearing}deg)`, transition: 'transform 1s linear', transformOrigin: 'bottom center' }}>
            <DriverCarIcon photoURL={currentUser?.photoURL} />
          </div>
        </Marker>

        {/* Passenger Route */}
        {activePassRoute.length > 0 && (
          <>
            <Source id="pass-route" type="geojson" data={activePassRouteGeoJSON}>
              <Layer id="pass-route-line" type="line" paint={passRoutePaint} />
            </Source>
            
            <Marker longitude={activePassenger.pickup.lon} latitude={activePassenger.pickup.lat} anchor="center">
              <PassengerStartDotIcon color={activeColor} />
            </Marker>
            <Marker longitude={activePassenger.dropoff.lon} latitude={activePassenger.dropoff.lat} anchor="bottom">
              <PassengerEndPinIcon color={activeColor} />
            </Marker>
            
            {/* Dotted theoretical intercept lines */}
            {driverRoute.length > 0 && activePassenger?.meetPickup && (
               <Source id="intercept-pickup" type="geojson" data={interceptPickupGeoJSON}>
                 <Layer id="intercept-pickup-line" type="line" paint={interceptPaint} />
               </Source>
            )}

            {activePassenger?.meetPickup && (
              <Marker longitude={activePassenger.meetPickup.lon} latitude={activePassenger.meetPickup.lat} anchor="center">
                 <div style={{ position: 'relative' }}>
                   <MeetSpotIcon color={activeColor} />
                   <div style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '10px', background: '#fff', padding: '6px 10px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                     <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
                       {activePassenger.profilePic ? (
                          <img 
                            src={activePassenger.profilePic} 
                            alt="avatar" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                       ) : (
                          getInitials(activePassenger.name, 'P')
                       )}
                     </div>
                     <span style={{ fontWeight: 600, color: '#333' }}>Meet around here</span>
                     {/* Triangle arrow */}
                     <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '5px solid #fff' }}></div>
                   </div>
                 </div>
              </Marker>
            )}

            {/* Dotted theoretical intercept line from Driver -> Dropoff */}
            {driverRoute.length > 0 && activePassenger?.meetDropoff && (
               <Source id="intercept-dropoff" type="geojson" data={interceptDropoffGeoJSON}>
                 <Layer id="intercept-dropoff-line" type="line" paint={interceptPaint} />
               </Source>
            )}

            {activePassenger?.meetDropoff && (
               <Marker longitude={activePassenger.meetDropoff.lon} latitude={activePassenger.meetDropoff.lat} anchor="center">
                 <div style={{ position: 'relative' }}>
                   <MeetSpotIcon color={activeColor} />
                   <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '10px', background: '#fff', padding: '6px 10px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
                     <span style={{ fontWeight: 600, color: '#333' }}>Drop-off point</span>
                     <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #fff' }}></div>
                   </div>
                 </div>
               </Marker>
            )}
          </>
        )}

        <AutoFollower currentLat={currentLat} currentLon={currentLon} currentBearing={currentBearing} isAutoFollowing={isAutoFollowing} setIsAutoFollowing={setIsAutoFollowing} setMapBearing={setMapBearing} is3DMode={is3DMode} setIs3DMode={setIs3DMode} />
      </Map>

      {/* Map Mode Toggle (2D/3D) */}
      <button 
        onClick={() => {
          setIs3DMode(prev => !prev);
          if (mapRef && typeof mapRef.easeTo === 'function') {
            mapRef.easeTo({ pitch: !is3DMode ? 60 : 0 });
          } else if (mapRef && typeof mapRef.getMap === 'function') {
            mapRef.getMap().easeTo({ pitch: !is3DMode ? 60 : 0 });
          }
        }}
        style={{ position: 'absolute', bottom: '230px', right: '20px', background: '#fff', border: 'none', borderRadius: '4px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1000 }}
      >
        <Layers size={20} color={is3DMode ? "#00b0f0" : "#555"} />
      </button>

      {/* Reset Orientation Button */}
      {Math.abs(mapBearing) > 0.1 && (
        <button 
          onClick={() => {
            if (mapRef && typeof mapRef.easeTo === 'function') {
               mapRef.easeTo({ bearing: 0, pitch: 0 });
               setMapBearing(0);
               setIs3DMode(false);
            } else if (mapRef && typeof mapRef.getMap === 'function') {
               mapRef.getMap().easeTo({ bearing: 0, pitch: 0 });
               setMapBearing(0);
               setIs3DMode(false);
            }
          }}
          style={{ position: 'absolute', bottom: !isAutoFollowing ? '330px' : '280px', right: '20px', background: '#fff', border: 'none', borderRadius: '4px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1000, animation: 'scaleIn 0.3s ease-out', transition: 'bottom 0.3s ease-out' }}
        >
           <Compass size={20} color="#555" />
        </button>
      )}

      {/* Re-center Map Button */}
      {!isAutoFollowing && (
        <button 
          onClick={() => setIsAutoFollowing(true)}
          style={{ position: 'absolute', bottom: '280px', right: '20px', background: '#fff', border: 'none', borderRadius: '4px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1000, animation: 'scaleIn 0.3s ease-out' }}
        >
           <Navigation2 size={20} color="#555" />
        </button>
      )}

      {/* MAP OVERLAY SPINNER */}
      {isFetchingMatches && (
         <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1200, background: 'rgba(255,255,255,0.9)', padding: '16px', borderRadius: '50%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={32} color="#00b0f0" className="spin" />
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
         </div>
      )}

      {/* TOP HEADER */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(40,45,50,0.95)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
          {/* Dark Navbar */}
          <div style={{ padding: 'calc(1rem + env(safe-area-inset-top)) 1rem 1rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: '#fff' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => navigate('/my-rides', { state: { initialTab: location.state?.fromTab || location.state?.initialTab || 'Active' } })} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Live Tracking</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>Active Ride</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: ride?.seats || 4 }).map((_, i) => {
                   const absoluteConfirmedCount = matches.reduce((acc, m) => acc + (parseInt(m.seats) || 1), 0);
                   const isTaken = i < absoluteConfirmedCount;
                   return (
                     <User key={i} size={16} color={isTaken ? '#00b0f0' : '#ccc'} fill={isTaken ? '#00b0f0' : '#ccc'} />
                   );
                })}
              </div>
               <button disabled={isFetchingMatches} onClick={() => { setDrawerMode('ride'); setIsDrawerExpanded(true); }} style={{ background: 'rgba(255,255,255,0.2)', height: 32, width: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: '#fff', cursor: isFetchingMatches ? 'not-allowed' : 'pointer', transition: 'background 0.3s', opacity: isFetchingMatches ? 0.5 : 1, pointerEvents: isFetchingMatches ? 'none' : 'auto' }}>
                  <Play size={16} fill="#fff" style={{ marginLeft: 2 }} />
               </button>
            </div>
          </div>
          
          {/* Address Overlay Strip representing the Target Passenger */}
          {activePassenger && (
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
                          {ride?.to?.address || 'Unknown Destination'}
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
                        {ride?.to?.address || 'Unknown Destination'}
                      </span>
                    </div>
                    <svg style={{ minWidth: 16, flexShrink: 0, marginLeft: '8px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                 </div>
               )}
             </div>
          )}
        </div>
      </div>

      {/* HORIZONTAL MATCH CAROUSEL */}
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        style={{ 
          position: 'absolute', 
          bottom: '48px', 
          width: '100%', 
          display: 'flex', 
          overflowX: 'auto', 
          scrollSnapType: 'x mandatory',
          padding: '12px 20px',
          boxSizing: 'border-box',
          gap: '12px',
          zIndex: 1000,
          scrollbarWidth: 'none',
          MsOverflowStyle: 'none'
        }}
        className="hide-scrollbar"
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } @keyframes pulseGlow { 0% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 0px rgba(119,119,119,0); } 50% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 8px rgba(119,119,119,0.7); } 100% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 0px rgba(119,119,119,0); } }`}</style>
        
        {isFetchingMatches ? (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '30px 20px', textAlign: 'center', width: '90%', margin: '0 auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}>
             <p style={{ margin: 0, color: '#888', fontWeight: 600 }}>Fetching ride details...</p>
          </div>
        ) : matches.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '30px 20px', textAlign: 'center', width: '90%', margin: '0 auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}>
             <p style={{ margin: 0, color: '#888', fontWeight: 600 }}>No active passengers.</p>
          </div>
        ) : (
          matches.map((match, index) => {
            const phase = passengerStates[match.id] || 0;
            
            return (
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
                   setIsDrawerExpanded(prev => activePassengerId === match.id ? !prev : true);
                }}
                style={{ 
                  minWidth: '85vw', 
                  maxWidth: '85vw',
                  background: '#fff', 
                  borderRadius: '8px', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  animation: phase === 1 ? 'pulseGlow 1.2s ease-in-out 1' : (phase === 2 && !showRatingModal && ratingPassenger?.id === match.id) ? 'pulseGlow 1.2s ease-in-out 1' : 'none',
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
                     <img 
                       src={match.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
                       alt="" 
                       onError={(e) => { e.target.onerror = null; e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"; }}
                       style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                     />
                   </div>
                   
                   <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: phase === 2 ? '#9cc93a' : '#00b0f0', fontWeight: 600, transition: 'color 0.3s' }}>
                        {match.time}
                      </p>
                      <h3 style={{ margin: '2px 0', fontSize: '1rem', fontWeight: 600, color: '#222' }}>
                        {match.name}
                      </h3>
                     
                     {/* Rating Line */}
                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                       {[1, 2, 3, 4, 5].map(starNum => {
                          const ratingVal = parseFloat(match.rating) || 0;
                          const isFilled = starNum <= Math.round(ratingVal);
                          return <Star key={starNum} size={12} fill={isFilled ? "#ffb800" : "#eaeaea"} color={isFilled ? "#ffb800" : "#eaeaea"} />
                       })}
                       <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px' }}>{match.rating} ({match.completedRides})</span>
                     </div>
                   </div>

                   <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                         {Array.from({ length: match.seats || 4 }).map((_, i) => (
                            <User key={i} size={12} fill="#888" color="#888" style={{ transition: 'all 0.3s' }} />
                         ))}
                      </div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>{match.price}</p>
                   </div>
                </div>

                {/* Bottom Button Row - Matching OfferMatches layout but with Slider integrated */}
                <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0', marginTop: 'auto', background: '#fcfcfc' }} onClick={(e) => e.stopPropagation()}>
                   <button 
                     onClick={() => handleMessageContact(match.userId)}
                     style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                   >
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   {phase === 2 && (
                      <button onClick={() => { setRatingPassenger(match); setTempRating(match.driverRatedPassenger ? (match.ratingGivenByDriver !== undefined ? match.ratingGivenByDriver : 5) : 0); setShowRatingModal(true); }} style={{ width: '60px', padding: '16px 0', background: '#ffb800', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.3s' }}>
                        <Star size={20} fill="#fff" color="#fff" />
                      </button>
                   )}
                   <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                     {/* We use a wrapper to force the slider to perfectly fill the space */}
                     <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                       {phase === 0 && (
                          <SwipeButton 
                             text="Arrived at Pickup" 
                             color="#00b0f0" 
                             onSwipe={() => handleSwipe(match.id)} 
                             customBorderRadius="0 0 12px 0"
                          />
                       )}
                       {phase === 1 && (
                          <SwipeButton 
                             text="Mark as Complete" 
                             color="#00b0f0" 
                             onSwipe={() => handleSwipe(match.id)} 
                             customBorderRadius="0 0 12px 0"
                          />
                       )}
                       {phase === 2 && (
                          <SwipeButton 
                             text="Completed Ride" 
                             color="#9cc93a" 
                             isCompleted={true}
                             customBorderRadius="0 0 12px 0"
                          />
                       )}
                     </div>
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PULL-UP UI DRAWER FOR GLOBAL ACTIONS */}
      {/* Grey Background Overlay */}
      <div 
        onClick={() => setIsDrawerExpanded(false)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'transparent', zIndex: 1500, pointerEvents: isDrawerExpanded ? 'auto' : 'none' }}
      ></div>
      
      {/* Drawer Surface */}
      <div 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          background: isDrawerExpanded ? 'rgba(40,45,50,0.98)' : 'rgba(40,45,50,0.9)', 
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.5)',
          padding: isDrawerExpanded 
            ? '16px 24px calc(16px + env(safe-area-inset-bottom)) 24px' 
            : 'calc(40px + env(safe-area-inset-bottom)) 24px calc(16px + env(safe-area-inset-bottom)) 24px',
          zIndex: 2000,
          transform: isDrawerExpanded ? 'translateY(0)' : 'translateY(calc(100% - 40px - env(safe-area-inset-bottom)))',
          transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background 0.3s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        <div onClick={() => { if(!isFetchingMatches) { setDrawerMode('passenger'); setIsDrawerExpanded(!isDrawerExpanded); } }} style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: isFetchingMatches ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
           <ChevronUp size={28} color="#888" style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', opacity: isDrawerExpanded ? 0 : (isFetchingMatches ? 0.3 : 1), transition: 'opacity 0.2s' }} />
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center', opacity: isDrawerExpanded ? 1 : 0, transition: 'opacity 0.2s', cursor: 'pointer' }}>
             <X size={24} color="#888" strokeWidth={2.5} />
           </div>
        </div>

        <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', opacity: isDrawerExpanded ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isDrawerExpanded ? 'auto' : 'none' }}>
           <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '8px' }}>
           {(() => {
              if (drawerMode === 'passenger' && activePassenger) {
                 return (
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
                       <span style={{ fontSize: '0.9rem', color: '#eee', fontWeight: 600, marginLeft: '4px' }}>{activePassenger.rating || '5.0'} <span style={{ fontWeight: 400 }}>({activePassenger.completedRides || '0'})</span></span>
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
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: (passengerStates[activePassenger.id] || 0) === 2 ? '#9cc93a' : '#00b0f0' }}>{activePassenger.seats} seat{activePassenger.seats > 1 ? 's' : ''} requested</span>
                     </div>

                     {/* Locations */}
                     <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                        {/* Origin */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                           <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#aaa', marginBottom: '4px' }}>From:</span>
                           {(() => {
                              const addrStr = activePassenger.pickup?.address || 'Unknown Pickup Address';
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
                              const addrStr = activePassenger.dropoff?.address || 'Unknown Dropoff Address';
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
                 );
              } else if (drawerMode === 'passenger') {
                 return (
                 <div style={{ textAlign: 'center', padding: '24px 0', width: '100%' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                      Passenger Overlay
                    </h3>
                    <p style={{ margin: 0, color: '#ccc', fontSize: '0.9rem' }}>No active passenger currently selected.</p>
                 </div>
                 );
              }

              const allCompleted = matches.length > 0 && matches.every(m => (passengerStates[m.id] || 0) === 2);
              
              const passengerAvatars = (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
                    {matches.length > 0 ? (
                       matches.map((cp, idx) => (
                          <div key={cp.id} style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(28,32,36,0.98)', marginLeft: idx > 0 ? '-16px' : 0, overflow: 'hidden', background: '#333', zIndex: 10 - idx }}>
                              <img src={cp.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} alt="passenger" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                       ))
                    ) : (
                       <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(28,32,36,0.98)', background: '#444', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={28} color="#bbb" strokeWidth={2.5} />
                       </div>
                    )}
                 </div>
              );

              if (allCompleted || isGlobalCancelled) {
                 return (
                    <div style={{ textAlign: 'center', width: '100%', padding: '24px 0' }}>
                       <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                         {isGlobalCancelled ? 'Ride Cancelled' : 'Ride Completed'}
                       </h3>
                       <p style={{ margin: '0 0 24px', color: '#ccc', fontSize: '0.9rem', textAlign: 'center' }}>
                         {isGlobalCancelled ? 'All active passenger routes have been aborted.' : 'All passengers have been dropped off.'}
                       </p>
                       {!isGlobalCancelled && passengerAvatars}
                       <button onClick={handleFinishCarpool} style={{ width: '100%', padding: '16px', background: isGlobalCancelled ? '#333' : '#00b0f0', border: 'none', borderRadius: '8px', color: isGlobalCancelled ? '#ccc' : '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: 'none' }}>
                         Finish Carpool
                       </button>
                    </div>
                 );
              }
              return (
                 <div style={{ textAlign: 'center', width: '100%' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Manage Active Ride</h3>
                    <p style={{ margin: '0 0 24px', color: '#ccc', fontSize: '0.9rem' }}>You are tracking {matches.length} passenger(s).</p>
                    {passengerAvatars}
                    <button onClick={() => { setIsDrawerExpanded(false); setTimeout(() => setShowCancelAllModal(true), 300); }} style={{ width: '100%', padding: '16px', background: '#333', border: 'none', borderRadius: '8px', color: '#ccc', fontWeight: 700, fontSize: '1rem', marginBottom: '16px', cursor: 'pointer' }}>
                      Cancel Carpool
                    </button>
                    <button onClick={() => { setIsDrawerExpanded(false); setTimeout(() => setShowCompleteAllModal(true), 300); }} style={{ width: '100%', padding: '16px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                      Complete Carpool (All Users)
                    </button>
                 </div>
              );
           })()}
           </div>

           {/* Collapse Drawer Button */}
           <div 
              onClick={() => setIsDrawerExpanded(false)} 
              style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', cursor: 'pointer', marginBottom: '-8px' }}
           >
              <ChevronDown size={32} color="#888" style={{ opacity: 0.8 }} />
           </div>
        </div>
      </div>

      {/* CUSTOM COMPLETE ALL MODAL */}
      {showCompleteAllModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e0f6ff', color: '#00b0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} strokeWidth={3} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Complete Carpool?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>This will instantly mark all remaining transit legs as completed and apply passenger statistics.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowCompleteAllModal(false)} style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Go Back
              </button>
              <button onClick={handleCompleteAllPassengers} style={{ flex: 1, padding: '14px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Complete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CANCEL ALL MODAL */}
      {showCancelAllModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <X size={24} strokeWidth={3} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>Cancel Carpool?</h3>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: '0.95rem', lineHeight: 1.4 }}>Are you absolutely sure you want to cancel this carpool? Passengers will be severely disrupted.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowCancelAllModal(false)} style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Go Back
              </button>
              <button onClick={handleCancelAllPassengers} style={{ flex: 1, padding: '14px', background: '#ff2744', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM FINISH CARPOOL PROMPT MODAL */}
      {showFinishCarpoolPrompt && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0, 176, 240, 0.15)', color: '#00b0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} strokeWidth={3} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>All Passengers Dropped Off!</h3>
            <p style={{ margin: '0 0 24px', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.4 }}>You have successfully completed all passenger routes. Would you like to finish this carpool session now?</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowFinishCarpoolPrompt(false)} 
                style={{ flex: 1, padding: '14px', background: '#334155', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Not Yet
              </button>
              <button 
                onClick={() => {
                  setShowFinishCarpoolPrompt(false);
                  handleFinishCarpool();
                }} 
                style={{ flex: 1, padding: '14px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                Finish Carpool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING DRAWER MODAL */}
      <div 
        onClick={() => setShowRatingModal(false)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10000, opacity: showRatingModal ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: showRatingModal ? 'auto' : 'none' }}
      ></div>
      
      <div 
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#282d32', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', padding: '16px 24px calc(32px + env(safe-area-inset-bottom)) 24px', zIndex: 10001, transform: showRatingModal ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}
      >
        <div onClick={() => setShowRatingModal(false)} style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
           <div style={{ width: '48px', height: '6px', background: '#555', borderRadius: '3px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', opacity: showRatingModal ? 0 : 1, transition: 'opacity 0.2s' }}></div>
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center' }}>
             <X size={24} color="#ccc" strokeWidth={2.5} />
           </div>
        </div>

        {ratingPassenger && (
          <div style={{ width: '100%', marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
             <img 
               src={ratingPassenger.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
               alt="" 
               style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
             />
             <h3 style={{ margin: '0 0 24px', fontSize: '1.4rem', fontWeight: 800, color: '#fff', textAlign: 'center' }}>
               How was your carpool with {ratingPassenger.name.split(' ')[0]}?
             </h3>
             
             <div style={{ display: 'flex', gap: '8px', marginBottom: ratingPassenger?.driverRatedPassenger ? '8px' : '12px' }}>
               {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={40} 
                    fill={star <= tempRating ? "#ffb800" : "#444"} 
                    color={star <= tempRating ? "#ffb800" : "#444"} 
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => setTempRating(star)}
                  />
               ))}
             </div>
             
             <div style={{ marginBottom: '32px' }}></div>
             
             <button 
                  onClick={async () => {
                   if (ratingPassenger?.userId) {
                      try {
                         const userRef = doc(db, 'users', ratingPassenger.userId);
                         const uSnap = await getDoc(userRef);
                         const userDoc = uSnap.exists() ? uSnap.data() : {};
                         
                         const currentTotalRating = userDoc.rating ? parseFloat(userDoc.rating) : 5.0;
                         const currentReviews = userDoc.reviews || 0;
                         
                         let newReviewsCount = currentReviews;
                         let newAverageRating = currentTotalRating;

                         if (ratingPassenger.driverRatedPassenger && ratingPassenger.ratingGivenByDriver !== undefined) {
                             const oldTotalRatingSum = currentTotalRating * currentReviews;
                             const sumWithoutOld = oldTotalRatingSum - ratingPassenger.ratingGivenByDriver;
                             newAverageRating = currentReviews > 0 ? (sumWithoutOld + tempRating) / currentReviews : tempRating;
                         } else {
                             newReviewsCount = currentReviews + 1;
                             newAverageRating = ((currentTotalRating * currentReviews) + tempRating) / newReviewsCount;
                         }
                         
                         await setDoc(userRef, { 
                            rating: newAverageRating.toFixed(1), 
                            reviews: newReviewsCount 
                         }, { merge: true });
                         
                         await updateDoc(doc(db, 'rideRequests', ratingPassenger.id), { 
                            driverRatedPassenger: true,
                            ratingGivenByDriver: tempRating
                         });
                         
                         // Update local match state slightly so user sees the new rating instantly without refetching all logic
                         setMatches(old => old.map(m => m.id === ratingPassenger.id ? { ...m, rating: newAverageRating.toFixed(1), reviews: newReviewsCount, driverRatedPassenger: true, ratingGivenByDriver: tempRating } : m));
                      } catch (err) { console.error("Rating save error", err); }
                   }
                   setShowRatingModal(false);
                }}
                style={{ width: '100%', padding: '16px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
             >
               Save Rating
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
