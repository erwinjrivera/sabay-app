import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, User, List, Star, Navigation, MapPin, MessageCircle, X, Check, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, getDoc, setDoc, increment, deleteField } from 'firebase/firestore';
import SwipeButton from '../components/SwipeButton';
import { useAuth } from '../contexts/AuthContext';

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

// Icons
const getDriverCarIcon = (bearing, photoURL) => new L.DivIcon({
  className: 'custom-driver-car',
  html: `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;position:relative; transform: rotate(${bearing}deg); transition: transform 0.5s ease-out;">
           <div style="position:absolute;width:40px;height:40px;background:#ff0043;border-radius:50% 50% 50% 0;transform:rotate(135deg);box-shadow:0 4px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
              <img src="${photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fff'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #fff;transform:rotate(${ -135 - bearing }deg);background:#ccc;" />
           </div>
         </div>`,
  iconSize: [50, 50],
  iconAnchor: [25, 25]
});

// Other Map Icons
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

const driverStartIcon = new L.DivIcon({
  className: 'custom-driver-start-dot',
  html: `<div style="width:16px;height:16px;background:#555;border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px rgba(85,85,85,0.6);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getPassengerStartIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-pass-start-dot',
  html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px ${color === '#28ec33' ? 'rgba(40,236,51,0.6)' : 'rgba(0,176,240,0.6)'};"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getPassengerEndIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-end-pin',
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const getMeetDropSpotIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-meet-drop-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${color};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getMeetSpotIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-meet-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${color};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});


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

export default function ActiveRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const carouselRef = useRef(null);
  const { currentUser } = useAuth();
  
  const ride = location.state?.ride;
  
  const [driverRoute, setDriverRoute] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activePassengerId, setActivePassengerId] = useState(null);
  const [passengerStates, setPassengerStates] = useState({}); // id -> 0 (arrive), 1 (complete), 2 (completed)
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [showCancelAllModal, setShowCancelAllModal] = useState(false);
  const [showCompleteAllModal, setShowCompleteAllModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingPassenger, setRatingPassenger] = useState(null);
  const [tempRating, setTempRating] = useState(4);
  const [isFetchingMatches, setIsFetchingMatches] = useState(true);
  const [isGlobalCancelled, setIsGlobalCancelled] = useState(false);

  const handleCancelAllPassengers = async () => {
    try {
      const updates = matches.map(async (m) => {
          const currentPhase = passengerStates[m.id] || 0;
          if (currentPhase < 2) {
              await updateDoc(doc(db, 'rideRequests', m.id), { 
                  status: 'open',
                  offeredByRideId: deleteField(),
                  phase: deleteField()
              });
          }
      });
      await Promise.all(updates);

      if (ride?.id) {
          await updateDoc(doc(db, 'rideOffers', ride.id), { status: 'cancelled' });
      }
      setIsGlobalCancelled(true);
      setShowCancelAllModal(false);
      setTimeout(() => setIsDrawerExpanded(true), 300);
    } catch (err) { console.error(err); }
  };

  const handleFinishCarpool = async () => {
    try {
      if (ride?.id) {
          await updateDoc(doc(db, 'rideOffers', ride.id), { status: isGlobalCancelled ? 'cancelled' : 'completed' });
      }
      navigate('/my-rides');
    } catch (err) { console.error(err); }
  };

  const handleCompleteAllPassengers = async () => {
    try {
      const updates = matches.map(async (m) => {
         if ((passengerStates[m.id] || 0) < 2) {
             await updateDoc(doc(db, 'rideRequests', m.id), { status: 'completed' });
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

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error watching position", error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const driverFrom = ride?.from ? { lat: ride.from.lat, lon: ride.from.lon } : { lat: 14.5552, lon: 121.0535 };
  const driverTo = ride?.to ? { lat: ride.to.lat, lon: ride.to.lon } : { lat: 14.5547, lon: 121.0244 };
  
  const rideTimeStr = ride?.time ? dayjs(ride.time).format('h:mma') : 'Time';
  const rideDateStr = ride?.date ? dayjs(ride.date).format('MMM. D') : 'Date';

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
  }, [driverFrom.lon, driverFrom.lat, driverTo.lon, driverTo.lat]);

  useEffect(() => {
    if (driverRoute.length === 0 || !ride?.id) return;

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
                 if (pickupIdx > dropIdx) dropIdx = pickupIdx;
                 meetPickup = passRoute[pickupIdx];
                 meetDropoff = passRoute[dropIdx];
                 
                 interceptPaths.pickupPath = passRoute.slice(0, pickupIdx + 1);
                 interceptPaths.dropoffPath = passRoute.slice(dropIdx);
              }
              
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

              return {
                 id: req.id,
                 userId: req.userId,
                 name: req.userName || 'Passenger',
                 time: req.time ? dayjs(req.time).format('h:mma') : 'Any time',
                 rating: userRating ? parseFloat(userRating).toFixed(1) : (req.userRating || '0.0'),
                 reviews: userReviews ? userReviews : parseInt(req.userReviews || 0),
                 completedRides: userCompletedRides,
                 driverRatedPassenger: req.driverRatedPassenger || false,
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
                 sharedPath: passRoute.slice(pickupIdx, dropIdx + 1),
                 distanceToDriverStart
              };

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
  }, [driverRoute, ride?.id]);

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
                await updateDoc(doc(db, 'rideRequests', passengerId), { status: 'completed' });
                
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
          setTempRating(4);
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
  const activeColor = activePassengerPhase === 2 ? '#28ec33' : '#00b0f0';

  const currentLat = currentLocation ? currentLocation.lat : driverFrom.lat;
  const currentLon = currentLocation ? currentLocation.lon : driverFrom.lon;
  const currentBearing = getBearing(currentLat, currentLon, driverTo.lat, driverTo.lon);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden', background: '#eaeaea' }}>
      
      <MapContainer 
        center={[driverFrom.lat, driverFrom.lon]} 
        zoom={14} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        
        {driverRoute.length > 0 && (
          <>
            <Polyline positions={driverRoute} pathOptions={{ color: '#555', weight: 5, opacity: 0.8 }} />
            <Marker position={[driverFrom.lat, driverFrom.lon]} icon={driverStartIcon} />
            <Marker position={[driverTo.lat, driverTo.lon]} icon={driverIcon} />
          </>
        )}
        
        {/* Real-time driver teardrop map marker indicator */}
        <Marker position={[currentLat, currentLon]} icon={getDriverCarIcon(currentBearing, currentUser?.photoURL)} zIndexOffset={100} />

        {/* Passenger Route (Dynamic Color based on Status) */}
        {activePassRoute.length > 0 && (
          <>
            <Polyline positions={activePassRoute} pathOptions={{ color: activeColor, weight: 6, opacity: 1 }} />
            
            <Marker position={[activePassenger.pickup.lat, activePassenger.pickup.lon]} icon={getPassengerStartIcon(activeColor)} />
            <Marker position={[activePassenger.dropoff.lat, activePassenger.dropoff.lon]} icon={getPassengerEndIcon(activeColor)} />
            
            {/* Dotted theoretical intercept lines from Passenger Origin -> Nearest Driver node */}
            {driverRoute.length > 0 && activePassenger?.meetPickup && (
               <Polyline 
                 positions={activePassenger?.interceptPaths?.pickupPath || [[activePassenger.pickup.lat, activePassenger.pickup.lon], [activePassenger.meetPickup.lat, activePassenger.meetPickup.lon]]} 
                 pathOptions={{ color: activeColor, weight: 4, opacity: 1, dashArray: '5, 8' }}
               />
            )}

            {activePassenger?.meetPickup && (
              <Marker position={[activePassenger.meetPickup.lat, activePassenger.meetPickup.lon]} icon={getMeetSpotIcon(activeColor)}>
                 <Tooltip direction="right" offset={[10, 0]} opacity={1} permanent>
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
                 pathOptions={{ color: activeColor, weight: 4, opacity: 1, dashArray: '5, 8' }}
               />
            )}

            {activePassenger?.meetDropoff && (
               <Marker position={[activePassenger.meetDropoff.lat, activePassenger.meetDropoff.lon]} icon={getMeetDropSpotIcon(activeColor)}>
                 <Tooltip direction="left" offset={[-10, 0]} opacity={1} permanent>
                   <span style={{ fontWeight: 600, color: '#333' }}>Drop-off point</span>
                 </Tooltip>
               </Marker>
            )}
          </>
        )}

        <MapAdjuster route1={driverRoute} route2={activePassRoute} />
      </MapContainer>

      {/* MAP OVERLAY SPINNER */}
      {isFetchingMatches && (
         <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1200, background: 'rgba(255,255,255,0.9)', padding: '16px', borderRadius: '50%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={32} color="#00b0f0" className="spin" />
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
         </div>
      )}

      {/* TOP HEADER */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(40,45,50,0.95)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={() => navigate('/my-rides')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, marginRight: '16px' }}>
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Live Tracking</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>Active Ride</p>
            </div>
          </div>
        </div>
      </div>

      {/* HORIZONTAL MATCH CAROUSEL */}
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        style={{ 
          position: 'absolute', 
          bottom: '38px', 
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
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } @keyframes pulseGlow { 0% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 0px rgba(0,176,240,0); } 50% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 4px rgba(0,176,240,0.6); } 100% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 0px rgba(0,176,240,0); } }`}</style>
        
        {isFetchingMatches ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', width: '90%', margin: '0 auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}>
             <p style={{ margin: 0, color: '#888', fontWeight: 600 }}>Fetching ride details...</p>
          </div>
        ) : matches.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', width: '90%', margin: '0 auto', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}>
             <p style={{ margin: 0, color: '#888', fontWeight: 600 }}>No active passengers.</p>
          </div>
        ) : (
          matches.map((match) => {
            const phase = passengerStates[match.id] || 0;
            
            return (
              <div 
                key={match.id}
                style={{ 
                  minWidth: '85vw', 
                  maxWidth: '85vw',
                  background: '#fff', 
                  borderRadius: '12px', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  animation: phase === 1 ? 'pulseGlow 1.2s ease-in-out 3' : 'none',
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
                     <p style={{ margin: 0, fontSize: '0.8rem', color: phase === 2 ? '#28ec33' : '#00b0f0', fontWeight: 600, transition: 'color 0.3s' }}>
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

                   <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                         {Array.from({ length: match.seats || 4 }).map((_, i) => (
                            <User key={i} size={12} fill={phase === 2 ? '#28ec33' : '#00b0f0'} color={phase === 2 ? '#28ec33' : '#00b0f0'} style={{ transition: 'all 0.3s' }} />
                         ))}
                      </div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>{match.price}</p>
                   </div>
                </div>

                {/* Bottom Button Row - Matching OfferMatches layout but with Slider integrated */}
                <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0', marginTop: 'auto', background: '#fcfcfc' }}>
                   <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '0 0 0 12px' }}>
                     <MessageCircle size={20} fill="#fff" color="#fff" />
                   </button>
                   {phase === 2 && !match.driverRatedPassenger && (
                      <button onClick={() => { setRatingPassenger(match); setTempRating(4); setShowRatingModal(true); }} style={{ width: '60px', padding: '16px 0', background: '#ffb800', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.3s' }}>
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
                             text="Complete Ride" 
                             color="#28ec33" 
                             onSwipe={() => handleSwipe(match.id)} 
                             customBorderRadius="0 0 12px 0"
                          />
                       )}
                       {phase === 2 && (
                          <SwipeButton 
                             text="Completed Ride" 
                             color="#28ec33" 
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
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 1500, opacity: isDrawerExpanded ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: isDrawerExpanded ? 'auto' : 'none' }}
      ></div>
      
      {/* Drawer Surface */}
      <div 
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#f2f4f7', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', boxShadow: '0 -4px 15px rgba(0,0,0,0.1)', padding: '16px 24px 32px 24px', zIndex: 2000, transform: isDrawerExpanded ? 'translateY(0)' : 'translateY(calc(100% - 40px))', transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}
      >
        <div onClick={() => setIsDrawerExpanded(!isDrawerExpanded)} style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
           <div style={{ width: '48px', height: '6px', background: '#ccc', borderRadius: '3px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', opacity: isDrawerExpanded ? 0 : 1, transition: 'opacity 0.2s' }}></div>
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center', opacity: isDrawerExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>
             <X size={24} color="#555" strokeWidth={2.5} />
           </div>
        </div>

        <div style={{ width: '100%', marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isDrawerExpanded ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isDrawerExpanded ? 'auto' : 'none' }}>
           {(() => {
              const allCompleted = matches.length > 0 && matches.every(m => (passengerStates[m.id] || 0) === 2);
              
              const passengerAvatars = (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
                    {matches.length > 0 ? (
                       matches.map((cp, idx) => (
                          <div key={cp.id} style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #f2f4f7', marginLeft: idx > 0 ? '-16px' : 0, overflow: 'hidden', background: '#e0e0e0', zIndex: 10 - idx }}>
                              <img src={cp.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} alt="passenger" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                       ))
                    ) : (
                       <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #f2f4f7', background: '#dbdbdb', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={28} color="#fff" strokeWidth={2.5} />
                       </div>
                    )}
                 </div>
              );

              if (allCompleted || isGlobalCancelled) {
                 return (
                    <>
                       <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#111' }}>
                         {isGlobalCancelled ? 'Ride Cancelled' : 'Ride Completed'}
                       </h3>
                       <p style={{ margin: '0 0 24px', color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
                         {isGlobalCancelled ? 'All active passenger routes have been aborted.' : 'All passengers have been safely dropped off.'}
                       </p>
                       {passengerAvatars}
                       <button onClick={handleFinishCarpool} style={{ width: '100%', padding: '16px', background: isGlobalCancelled ? '#dbdbdb' : '#00b0f0', border: 'none', borderRadius: '8px', color: isGlobalCancelled ? '#555' : '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: 'none' }}>
                         Finish Carpool
                       </button>
                    </>
                 );
              }
              return (
                 <>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#111' }}>Manage Active Ride</h3>
                    <p style={{ margin: '0 0 24px', color: '#888', fontSize: '0.9rem' }}>You are tracking {matches.length} passenger(s).</p>
                    {passengerAvatars}
                    <button onClick={() => { setIsDrawerExpanded(false); setTimeout(() => setShowCancelAllModal(true), 300); }} style={{ width: '100%', padding: '16px', background: '#dbdbdb', border: 'none', borderRadius: '8px', color: '#555', fontWeight: 700, fontSize: '1rem', marginBottom: '16px', cursor: 'pointer' }}>
                      Cancel Carpool
                    </button>
                    <button onClick={() => { setIsDrawerExpanded(false); setTimeout(() => setShowCompleteAllModal(true), 300); }} style={{ width: '100%', padding: '16px', background: '#28ec33', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                      Complete Carpool (All Users)
                    </button>
                 </>
              );
           })()}
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

      {/* RATING DRAWER MODAL */}
      <div 
        onClick={() => setShowRatingModal(false)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10000, opacity: showRatingModal ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: showRatingModal ? 'auto' : 'none' }}
      ></div>
      
      <div 
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '16px 24px 32px 24px', zIndex: 10001, transform: showRatingModal ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}
      >
        <div onClick={() => setShowRatingModal(false)} style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
           <div style={{ width: '48px', height: '6px', background: '#ccc', borderRadius: '3px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', opacity: showRatingModal ? 0 : 1, transition: 'opacity 0.2s' }}></div>
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center' }}>
             <X size={24} color="#555" strokeWidth={2.5} />
           </div>
        </div>

        {ratingPassenger && (
          <div style={{ width: '100%', marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
             <img 
               src={ratingPassenger.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
               alt="" 
               style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
             />
             <h3 style={{ margin: '0 0 24px', fontSize: '1.4rem', fontWeight: 800, color: '#111', textAlign: 'center' }}>
               How was your carpool with {ratingPassenger.name.split(' ')[0]}?
             </h3>
             
             <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
               {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={40} 
                    fill={star <= tempRating ? "#ffb800" : "#eaeaea"} 
                    color={star <= tempRating ? "#ffb800" : "#eaeaea"} 
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
                         
                         const newReviewsCount = currentReviews + 1;
                         const newAverageRating = ((currentTotalRating * currentReviews) + tempRating) / newReviewsCount;
                         
                         await setDoc(userRef, { 
                            rating: newAverageRating.toFixed(1), 
                            reviews: newReviewsCount 
                         }, { merge: true });
                         
                         await updateDoc(doc(db, 'rideRequests', ratingPassenger.id), { driverRatedPassenger: true });
                         
                         // Update local match state slightly so user sees the new rating instantly without refetching all logic
                         setMatches(old => old.map(m => m.id === ratingPassenger.id ? { ...m, rating: newAverageRating.toFixed(1), reviews: newReviewsCount, driverRatedPassenger: true } : m));
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
