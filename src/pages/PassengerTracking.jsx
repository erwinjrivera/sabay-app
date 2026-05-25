import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, User, Phone, MessageCircle, Star, Loader2, CarFront, Check, X, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { doc, onSnapshot, getDoc, updateDoc, setDoc } from 'firebase/firestore';

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

// Icons
const getDriverCarIcon = (bearing, photoURL, name, themeColor = '#00b0f0') => {
  const initials = getInitials(name, 'D');
  const innerContent = photoURL 
    ? `<img src="${photoURL}" onerror="this.onerror=null; this.outerHTML='<div style=\\'width:34px;height:34px;border-radius:50%;background:#ccc;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#fff;border:2px solid #fff;transform:rotate(-315deg);\\'>${initials}</div>';" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #fff;transform:rotate(-315deg);background:#ccc;" />` 
    : `<div style="width:34px;height:34px;border-radius:50%;background:#ccc;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#fff;border:2px solid #fff;transform:rotate(-315deg);">${initials}</div>`;

  return new L.DivIcon({
    className: 'custom-driver-car',
    html: `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;position:relative; transform: rotate(180deg);">
             <div style="position:absolute;width:40px;height:40px;background:${themeColor};border-radius:50% 50% 50% 0;transform:rotate(135deg);box-shadow:0 4px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
                ${innerContent}
             </div>
           </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 52]
  });
};

const getPassengerStartIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-pass-start-dot',
  html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px ${color === '#9cc93a' ? 'rgba(156,201,58,0.6)' : 'rgba(0,176,240,0.6)'};"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getPassengerEndIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-end-pin',
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3.5" fill="#fff"></circle></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const getMeetSpotIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-meet-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${color};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getMeetDropSpotIcon = (color = '#00b0f0') => new L.DivIcon({
  className: 'custom-meet-drop-dot',
  html: `<div style="width:14px;height:14px;background:#fff;border-radius:50%;border:4px solid ${color};box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const getDriverEndIcon = () => new L.DivIcon({
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

function MapAdjuster({ route1, centerOnLoc }) {
  const map = useMap();
  const hasFittedRef = React.useRef(false);
  useEffect(() => {
    if (centerOnLoc) {
       map.setView([centerOnLoc.lat, centerOnLoc.lon], 16, { animate: true });
    } else if (route1 && route1.length > 0 && !hasFittedRef.current) {
       hasFittedRef.current = true;
       const bounds = L.latLngBounds(route1);
       map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [route1, centerOnLoc, map]);
  return null;
}

export default function PassengerTracking() {
  const navigate = useNavigate();
  const location = useLocation();
  const passengerRequest = location.state?.ride;
  
  const [driverRide, setDriverRide] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [passengerState, setPassengerState] = useState(passengerRequest);
  
  const [driverRoute, setDriverRoute] = useState([]);
  const [sharedPath, setSharedPath] = useState([]);
  const [intercepts, setIntercepts] = useState(null);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [panToCar, setPanToCar] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [hasRated, setHasRated] = useState(passengerRequest?.passengerRatedDriver || false);
  const [showDriverArrivedModal, setShowDriverArrivedModal] = useState(false);
  const [hasSeenArrivalModal, setHasSeenArrivalModal] = useState(() => {
      return !!sessionStorage.getItem(`seen_arrival_${passengerRequest?.id}`);
  });
  const [justRated, setJustRated] = useState(false);

  // 1. Subscribe to Local Passenger State
  useEffect(() => {
     if (!passengerRequest?.id) return;
     const unsub = onSnapshot(doc(db, 'rideRequests', passengerRequest.id), (docSnapshot) => {
         if (docSnapshot.exists()) {
             const data = docSnapshot.data();
             setPassengerState({ id: docSnapshot.id, ...data });
             if (data.passengerRatedDriver) {
                 setHasRated(true);
             }
         }
     });
     return () => unsub();
  }, [passengerRequest?.id]);

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

  // 2. Subscribe to Driver State
  useEffect(() => {
     if (!passengerState?.offeredByRideId) return;

     const isFinalState = passengerState.status === 'completed' || passengerState.status === 'cancelled';

     if (isFinalState) {
         // Pull once to guarantee payload but DO NOT hook a live watcher
         (async () => {
             const snap = await getDoc(doc(db, 'rideOffers', passengerState.offeredByRideId));
             if (snap.exists()) {
                 const data = snap.data();
                 setDriverRide(prev => prev ? prev : { id: snap.id, ...data });
                 if (!driverProfile && data.userId) {
                     const uSnap = await getDoc(doc(db, 'users', data.userId));
                     if (uSnap.exists()) setDriverProfile(uSnap.data());
                 }
             }
         })();
         return;
     }

     const unsub = onSnapshot(doc(db, 'rideOffers', passengerState.offeredByRideId), async (rideDoc) => {
         if (rideDoc.exists()) {
             const data = rideDoc.data();
             setDriverRide({ id: rideDoc.id, ...data });

             if (!driverProfile && data.userId) {
                 const uSnap = await getDoc(doc(db, 'users', data.userId));
                 if (uSnap.exists()) setDriverProfile(uSnap.data());
             }

             if (data.status === 'completed' || data.status === 'cancelled') {
                 unsub();
             }
         }
     });
     return () => unsub();
  }, [passengerState?.offeredByRideId, passengerState?.status, navigate, driverProfile]);

  useEffect(() => {
    if ((driverRide?.status === 'completed' || passengerState?.status === 'completed') && !hasRated) {
        setShowRatingModal(true);
    }
  }, [driverRide?.status, passengerState?.status, hasRated]);

  useEffect(() => {
    if (passengerState?.phase === 1 && passengerState?.status !== 'completed' && !hasSeenArrivalModal) {
        setShowDriverArrivedModal(true);
        setHasSeenArrivalModal(true);
        sessionStorage.setItem(`seen_arrival_${passengerRequest?.id}`, 'true');
    }
  }, [passengerState?.phase, passengerState?.status, hasSeenArrivalModal, passengerRequest?.id]);

  // 3. Compute Map Geometries once driver & passenger static routes exist
  useEffect(() => {
     if (!passengerRequest?.from?.lat || !driverRide?.from?.lat) return;
     if (driverRoute.length > 0) return; // already done

     const fetchRoutes = async () => {
         try {
             // Fetch Driver Route
             const resD = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverRide.from.lon},${driverRide.from.lat};${driverRide.to.lon},${driverRide.to.lat}?geometries=geojson&overview=full`);
             const dataD = await resD.json();
             const dRoute = dataD.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
             setDriverRoute(dRoute);

             const passengerFromPos = { lat: passengerRequest.from.lat, lon: passengerRequest.from.lon };
             const passengerToPos = { lat: passengerRequest.to.lat, lon: passengerRequest.to.lon };

             // Sub-function to find the true road-network driving distance optimal point on driver route
             const findBestNetworkNode = async (targetPos, minIdx = 0) => {
                const candidates = dRoute.map((pt, idx) => ({ pt, idx, dist: getDistanceKM(pt[0], pt[1], targetPos.lat, targetPos.lon) }))
                                                  .filter(c => c.dist <= 5.0 && c.idx >= minIdx);
                if (candidates.length === 0) return null;
     
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

             // 1. Find pickup and initial dropoff using road-network proximity
             const bestPickup = await findBestNetworkNode(passengerFromPos);
             const bestDropoff = await findBestNetworkNode(passengerToPos);

             let pickupIdx = bestPickup ? bestPickup.idx : 0;
             let dropIdx = bestDropoff ? bestDropoff.idx : dRoute.length - 1;
             let meetPickup = dRoute[pickupIdx];
             let meetDropoff = dRoute[dropIdx];

             if (pickupIdx >= dropIdx) {
                 const temp = pickupIdx; pickupIdx = dropIdx; dropIdx = temp;
                 meetPickup = dRoute[pickupIdx];
                 meetDropoff = dRoute[dropIdx];
             }

             let interceptPaths = {
                pickupPath: [[passengerFromPos.lat, passengerFromPos.lon], [meetPickup[0], meetPickup[1]]],
                dropoffPath: [[meetDropoff[0], meetDropoff[1]], [passengerToPos.lat, passengerToPos.lon]]
             };

             // Fetch road-following connector paths using foot profile + convergence detection
             try {
                 const controller = new AbortController();
                 const timeoutId = setTimeout(() => controller.abort(), 5000);

                 // PICKUP: Use FOOT profile
                 const pFetch = fetch(`https://router.project-osrm.org/route/v1/foot/${passengerFromPos.lon},${passengerFromPos.lat};${meetPickup[1]},${meetPickup[0]}?geometries=geojson&overview=full`, { signal: controller.signal });
                 // DROPOFF: Route from destination outward
                 const bestDropNet = await findBestNetworkNode(passengerToPos, pickupIdx + 1);
                 if (bestDropNet) {
                     meetDropoff = bestDropNet.pt;
                     dropIdx = bestDropNet.idx;
                 }
                 const dFetch = fetch(`https://router.project-osrm.org/route/v1/foot/${passengerToPos.lon},${passengerToPos.lat};${meetDropoff[1]},${meetDropoff[0]}?geometries=geojson&overview=full`, { signal: controller.signal });
                 const [pRes, dRes] = await Promise.all([pFetch, dFetch]);
                 clearTimeout(timeoutId);
                 const pData = await pRes.json();
                 const dData = await dRes.json();

                 // PICKUP: find where the passenger's route FIRST joins the driver's route
                 if (pData.routes?.length > 0) {
                     let pPath = pData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                     let convergenceIdx = pPath.length - 1;
                     for (let i = 0; i < pPath.length; i++) {
                         for (let j = 0; j < dRoute.length; j++) {
                             if (getDistanceKM(pPath[i][0], pPath[i][1], dRoute[j][0], dRoute[j][1]) < 0.015) {
                                 convergenceIdx = i;
                                 break;
                             }
                         }
                         if (convergenceIdx !== pPath.length - 1) break;
                     }
                     interceptPaths.pickupPath = pPath.slice(0, convergenceIdx + 1);
                     let bestMatchIdx = pickupIdx;
                     let bestMatchDist = Infinity;
                     for (let j = 0; j < dRoute.length; j++) {
                         const d = getDistanceKM(pPath[convergenceIdx][0], pPath[convergenceIdx][1], dRoute[j][0], dRoute[j][1]);
                         if (d < bestMatchDist) { bestMatchDist = d; bestMatchIdx = j; }
                     }
                     meetPickup = dRoute[bestMatchIdx];
                     pickupIdx = bestMatchIdx;
                     interceptPaths.pickupPath.push([meetPickup[0], meetPickup[1]]);
                     if (pickupIdx >= dropIdx) {
                         meetPickup = dRoute[bestPickup ? bestPickup.idx : 0];
                         pickupIdx = bestPickup ? bestPickup.idx : 0;
                         interceptPaths.pickupPath = [[passengerFromPos.lat, passengerFromPos.lon], [meetPickup[0], meetPickup[1]]];
                     }
                 }

                 // DROPOFF: find where the destination walking route FIRST joins the driver's route
                 if (dData.routes?.length > 0) {
                     let dPath = dData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                     let dropConvergenceIdx = dPath.length - 1;
                     for (let i = 0; i < dPath.length; i++) {
                         for (let j = Math.max(0, pickupIdx); j < dRoute.length; j++) {
                             if (getDistanceKM(dPath[i][0], dPath[i][1], dRoute[j][0], dRoute[j][1]) < 0.015) {
                                 dropConvergenceIdx = i;
                                 break;
                             }
                         }
                         if (dropConvergenceIdx !== dPath.length - 1) break;
                     }
                     let bestDropMatchIdx = dropIdx;
                     let bestDropMatchDist = Infinity;
                     for (let j = Math.max(0, pickupIdx); j < dRoute.length; j++) {
                         const d = getDistanceKM(dPath[dropConvergenceIdx][0], dPath[dropConvergenceIdx][1], dRoute[j][0], dRoute[j][1]);
                         if (d < bestDropMatchDist) { bestDropMatchDist = d; bestDropMatchIdx = j; }
                     }
                     meetDropoff = dRoute[bestDropMatchIdx];
                     dropIdx = bestDropMatchIdx;
                     let dropPath = dPath.slice(0, dropConvergenceIdx + 1).reverse();
                     interceptPaths.dropoffPath = [[meetDropoff[0], meetDropoff[1]], ...dropPath];
                 }
             } catch (e) {}

             setSharedPath(dRoute.slice(pickupIdx, dropIdx + 1));
             setIntercepts({
                pickupPath: interceptPaths.pickupPath,
                dropoffPath: interceptPaths.dropoffPath,
                meetPickup: { lat: meetPickup[0], lon: meetPickup[1] },
                meetDropoff: { lat: meetDropoff[0], lon: meetDropoff[1] }
             });

             setIsInitializing(false);
         } catch (e) {
             console.error("OSRM Routing Error", e);
             setIsInitializing(false);
         }
     };

     fetchRoutes();
  }, [driverRide?.from, passengerRequest?.from, driverRoute.length]);


  if (isInitializing || !driverRide || !passengerState) {
     return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eaeaea' }}>
           <Loader2 size={40} color="#00b0f0" className="spin" />
           <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
     );
  }

  const isRideCompleted = driverRide?.status === 'completed' || passengerState?.status === 'completed';
  const isRideCancelled = !isRideCompleted && (driverRide?.status === 'cancelled' || passengerState?.status === 'cancelled');
  const isFinalState = isRideCompleted || isRideCancelled;

  const driverLiveLat = isFinalState ? driverRide.from.lat : (driverRide.currentLat || driverRide.from.lat);
  const driverLiveLon = isFinalState ? driverRide.from.lon : (driverRide.currentLon || driverRide.from.lon);
  const driverLiveBearing = isFinalState ? 0 : (driverRide.currentHeading || 0);

  const activeColor = isRideCancelled ? '#888' : (isRideCompleted ? '#9cc93a' : '#00b0f0');

  let statusText = isRideCancelled ? "Ride Cancelled" : (isRideCompleted ? "Ride Completed" : "Driver is on their way");
  let statusSubtext = isRideCancelled ? "The driver has aborted the carpool." : (isRideCompleted ? "You've successfully reached your destination." : "Navigating to your pickup location");
  
  if (passengerState.phase === 1 && !isRideCompleted && !isRideCancelled) {
      statusText = "Heading to Drop-off";
      statusSubtext = "You are in the car.";
  }

  const targetPhotoURL = driverProfile?.photoURL || driverRide?.userProfilePic || '';
  const targetName = driverProfile?.displayName || driverRide?.userName || 'Your Driver';
  
  const ratingVal = driverProfile?.rating || driverRide?.rating;
  const targetRating = ratingVal ? parseFloat(ratingVal).toFixed(1) : '0.0';
  const targetReviews = driverProfile?.reviewsCount || driverRide?.reviewsCount || 0;
  
    const targetSeats = driverRide?.seats || 1;
    const targetPrice = `${parseFloat(driverRide?.price || passengerState?.price || 0).toFixed(2)} ₱`;

    const passPhoto = passengerState?.profilePic || passengerState?.userProfilePic || '';
    const passName = passengerState?.name || passengerState?.userName || 'Passenger';

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden', background: '#eaeaea' }}>
      <style>{`@keyframes pulseGlow { 0% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 0px rgba(119,119,119,0); } 50% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 8px rgba(119,119,119,0.7); } 100% { box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 0px rgba(119,119,119,0); } }`}</style>
      
      <MapContainer 
        center={[driverLiveLat, driverLiveLon]} 
        zoom={15} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        
        {driverRoute.length > 0 && (
           <Polyline positions={driverRoute} pathOptions={{ color: '#555', weight: 5, opacity: 0.5 }} />
        )}

        {driverRoute.length > 0 && (
           <>
             <Marker position={[passengerRequest.from.lat, passengerRequest.from.lon]} icon={getPassengerStartIcon(activeColor)} />
             <Marker position={[passengerRequest.to.lat, passengerRequest.to.lon]} icon={getPassengerEndIcon(activeColor)} />
           </>
        )}

        {sharedPath.length > 0 && (
           <Polyline positions={sharedPath} pathOptions={{ color: activeColor, weight: 6, opacity: 1 }} />
        )}

        {/* Driver End Marker */}
        <Marker position={[driverRide.to.lat, driverRide.to.lon]} icon={getDriverEndIcon()} />

        {/* Meet and Dropoff Intercepts */}
        {intercepts && (
           <>
             <Polyline positions={intercepts.pickupPath} pathOptions={{ color: activeColor, weight: 4, opacity: 1, dashArray: '5, 8' }} />
             <Marker position={[intercepts.meetPickup.lat, intercepts.meetPickup.lon]} icon={getMeetSpotIcon(activeColor)}>
                <Tooltip direction="right" offset={[10, 0]} opacity={1} permanent>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {passPhoto ? (
                      <>
                          <img 
                              src={passPhoto} 
                              alt="avatar" 
                              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} 
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                          <div style={{ display: 'none', width: 24, height: 24, borderRadius: '50%', background: '#ccc', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
                              {getInitials(passName, 'P')}
                          </div>
                      </>
                  ) : (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
                          {getInitials(passName, 'P')}
                      </div>
                  )}
                  <span style={{ fontWeight: 600, color: '#333' }}>Meet around here</span>
              </div>
                </Tooltip>
             </Marker>

             <Polyline positions={intercepts.dropoffPath} pathOptions={{ color: activeColor, weight: 4, opacity: 1, dashArray: '5, 8' }} />
             <Marker position={[intercepts.meetDropoff.lat, intercepts.meetDropoff.lon]} icon={getMeetDropSpotIcon(activeColor)}>
                <Tooltip direction="left" offset={[-10, 0]} opacity={1} permanent>
                   <span style={{ fontWeight: 600, color: '#333' }}>Drop-off point</span>
                </Tooltip>
             </Marker>
           </>
        )}

        {/* Real-time driver teardrop map marker */}
        <Marker position={[driverLiveLat, driverLiveLon]} icon={getDriverCarIcon(driverLiveBearing, targetPhotoURL, targetName, activeColor)} zIndexOffset={100} />

        <MapAdjuster route1={driverRoute} centerOnLoc={panToCar ? { lat: driverLiveLat, lon: driverLiveLon } : null} />
      </MapContainer>

      {/* Recenter Button */}
      {(!isRideCompleted && !isRideCancelled) && (
        <button 
          onClick={() => { setPanToCar(true); setTimeout(() => setPanToCar(false), 1000); }}           style={{ position: 'absolute', bottom: '220px', right: '20px', background: '#fff', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000 }}
        >
           <CarFront size={22} color={activeColor} />
        </button>
      )}

      {/* TOP HEADER */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(40,45,50,0.95)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
          <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', color: '#fff' }}>
            <button onClick={() => navigate('/my-rides', { state: { initialTab: location.state?.fromTab || location.state?.initialTab || 'Active' } })} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, marginRight: '1rem' }}>
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{statusText}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>{statusSubtext}</p>
            </div>
          </div>
          
          {/* Collapsible Address Strip */}
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
                       {passengerRequest?.from?.address || 'Your Pickup Location'}
                     </span>
                     <span style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: '1.3' }}>
                       {passengerRequest?.to?.address || 'Your Dropoff Location'}
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
                     {passengerRequest?.to?.address || 'Your Dropoff Location'}
                   </span>
                 </div>
                 <svg style={{ minWidth: 16, flexShrink: 0, marginLeft: '8px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM CARD HUD */}
      <div style={{ 
          position: 'absolute', bottom: '68px', left: 0, width: '100%', 
          display: 'flex', justifyContent: 'center', zIndex: 1000,
          opacity: isBottomPanelExpanded ? 0 : 1, transition: 'opacity 0.2s',
          pointerEvents: isBottomPanelExpanded ? 'none' : 'auto'
      }}>
          <div 
              onClick={() => setIsBottomPanelExpanded(true)}
              style={{ 
              width: '90vw', maxWidth: '400px',
              background: '#fff', 
              borderRadius: '8px', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: justRated ? 'pulseGlow 1.2s ease-in-out 1' : 'none',
              cursor: 'pointer'
          }}>
            {/* Top Detail Row - aligned with FindMatches card layout */}
            <div style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
               <div>
                 <img 
                   src={targetPhotoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"}
                   alt="Driver Profile" 
                   onError={(e) => { e.target.onerror = null; e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"; }}
                   style={{ width: 45, height: 45, borderRadius: '50%', objectFit: 'cover' }} 
                 />
               </div>
               
               <div style={{ flex: 1, minWidth: 0 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: activeColor, fontWeight: 600 }}>
                   {driverRide?.time ? dayjs(driverRide.time).format('h:mma') : dayjs().format('h:mma')}
                 </p>
                 <h3 style={{ margin: '2px 0', fontSize: '1rem', fontWeight: 600, color: '#222' }}>
                   {targetName}
                 </h3>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(starNum => {
                        const isFilled = starNum <= Math.round(parseFloat(targetRating)); 
                        return <Star key={starNum} size={12} fill={isFilled ? "#ffb800" : "#eaeaea"} color={isFilled ? "#ffb800" : "#eaeaea"} />;
                    })}
                    <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px', fontWeight: 600 }}>
                        {targetRating === '0.0' ? 'New' : `${targetRating}`} <span style={{ fontWeight: 400 }}>({targetReviews})</span>
                    </span>
                 </div>
                 {driverProfile?.plateNumber && (
                    <div style={{ marginTop: '2px', fontSize: '0.7rem', color: '#777', whiteSpace: 'nowrap' }}>
                       <span style={{ fontWeight: 600 }}>{driverProfile.plateNumber}</span> | {driverProfile.carMake} {driverProfile.carModel} ({driverProfile.carColor})
                    </div>
                 )}
               </div>

               <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                     {Array.from({ length: targetSeats }).map((_, i) => {
                        const seatsTaken = parseInt(driverRide?.seatsTaken || driverRide?.confirmedCount || 0);
                        const isTaken = i < seatsTaken;
                        return <User key={i} size={12} fill={isTaken ? activeColor : '#e0e0e0'} color={isTaken ? activeColor : '#e0e0e0'} />;
                     })}
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>
                      {targetPrice}
                  </p>
               </div>
            </div>

            {/* Bottom Interactivity Row */}
            <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0', marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
               <button 
                 onClick={() => handleMessageContact(driverRide?.userId)}
                 style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
               >
                 <MessageCircle size={20} fill="#fff" color="#fff" />
               </button>
               {isRideCompleted && (
                  <button onClick={() => { setTempRating(passengerState?.ratingGivenToDriver || 0); setShowRatingModal(true); }} style={{ width: '60px', padding: '16px 0', background: '#ffb800', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.3s' }}>
                    <Star size={20} fill="#fff" color="#fff" />
                  </button>
               )}
               <button 
                 style={{ flex: 1, padding: '16px', background: activeColor, border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: isRideCancelled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
               >
                 {isRideCancelled ? "Cancelled" : (isRideCompleted ? "Completed Ride" : "In Transit")}
               </button>
            </div>
          </div>
      </div>

      {/* DRAWER BACKDROP OVERLAY */}
      <div 
        onClick={() => setIsBottomPanelExpanded(false)}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', zIndex: 1500,
          opacity: isBottomPanelExpanded ? 1 : 0, pointerEvents: isBottomPanelExpanded ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out'
        }}
      />

      {/* BOTTOM ACTION PANEL PULL-UP OVERLAY */}
      <div 
        style={{
          position: 'absolute', bottom: 0, left: 0, width: '100%',
          background: isBottomPanelExpanded ? 'rgba(40,45,50,0.98)' : 'rgba(40,45,50,0.9)', 
          borderTopLeftRadius: '8px', borderTopRightRadius: '8px',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.5)', padding: '16px 24px calc(16px + env(safe-area-inset-bottom)) 24px', zIndex: 2000,
          transform: isBottomPanelExpanded ? 'translateY(0)' : 'translateY(calc(100% - 34px - env(safe-area-inset-bottom)))',
          transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background 0.3s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box'
        }}
      >
        <div 
          onClick={() => setIsBottomPanelExpanded(!isBottomPanelExpanded)}
          style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}
        >
           <ChevronUp size={28} color="#888" style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', opacity: isBottomPanelExpanded ? 0 : 1, transition: 'opacity 0.2s' }} />
           <div onClick={(e) => { e.stopPropagation(); setIsBottomPanelExpanded(false); }} style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center', opacity: isBottomPanelExpanded ? 1 : 0, transition: 'opacity 0.2s', cursor: 'pointer' }}>
             <X size={24} color="#888" strokeWidth={2.5} />
           </div>
        </div>

        <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', opacity: isBottomPanelExpanded ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isBottomPanelExpanded ? 'auto' : 'none' }}>
           <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', textAlign: 'center', paddingBottom: '0' }}>
                 <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '3px solid #444', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                     {targetPhotoURL ? (
                        <img src={targetPhotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="driver" />
                     ) : (
                        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ccc' }}>{getInitials(targetName, 'D')}</span>
                     )}
                 </div>
                 <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 600, color: '#fff' }}>{targetName}</h2>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                   {[1, 2, 3, 4, 5].map(starNum => {
                      const ratingVal = parseFloat(targetRating) || 0;
                      const isFilled = starNum <= Math.round(ratingVal);
                      return <Star key={starNum} size={14} fill={isFilled ? "#ffb800" : "#444"} color={isFilled ? "#ffb800" : "#444"} />;
                   })}
                   <span style={{ fontSize: '0.9rem', color: '#eee', fontWeight: 600, marginLeft: '4px' }}>{targetRating === '0.0' ? 'New' : targetRating} <span style={{ fontWeight: 400 }}>({targetReviews})</span></span>
                 </div>
                 {driverProfile?.plateNumber && (
                    <div style={{ marginTop: '2px', fontSize: '0.85rem', color: '#ccc', marginBottom: '24px' }}>
                       <span style={{ fontWeight: 700, color: '#fff' }}>{driverProfile.plateNumber}</span> | {driverProfile.carMake} {driverProfile.carModel} <span style={{ opacity: 0.8 }}>({driverProfile.carColor})</span>
                    </div>
                 )}
                 {!driverProfile?.plateNumber && <div style={{ marginBottom: '24px' }}></div>}

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
                              {(driverRide?.date || driverRide?.time) ? dayjs(driverRide?.date || driverRide?.time).format('MMMM D, YYYY') : 'Unknown Date'}
                           </span>
                        </div>
                        <span style={{ color: '#444' }}>|</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8da4bd' }}>
                           <Clock size={14} />
                           <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>
                              {driverRide?.time ? dayjs(driverRide.time).format('h:mm A') : dayjs().format('h:mm A')}
                           </span>
                        </div>
                     </div>
                     <span style={{ fontSize: '1rem', fontWeight: 700, color: activeColor }}>{targetSeats} seat{targetSeats > 1 ? 's' : ''} offering</span>
                  </div>

                  {/* Locations */}
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
                     {/* Origin */}
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#aaa', marginBottom: '4px' }}>From:</span>
                        {(() => {
                           const addrStr = driverRide?.from?.address || 'Unknown Pickup Address';
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
                           const addrStr = driverRide?.to?.address || 'Unknown Dropoff Address';
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

                  {driverRide?.note && driverRide.note.trim() !== '' && (
                    <p style={{ margin: '0', fontSize: '0.95rem', color: '#ddd', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', width: '100%', textAlign: 'left' }}>
                      <strong style={{ fontStyle: 'normal', color: '#aaa', fontWeight: 600, marginRight: '4px' }}>Note:</strong>"{driverRide.note}"
                    </p>
                  )}
              </div>
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

      {/* DRIVER ARRIVED MODAL */}
      {showDriverArrivedModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative' }}>
             <button onClick={() => setShowDriverArrivedModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#555' }}>
                <X size={24} />
             </button>
             <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#ccc', margin: '0 auto 16px', overflow: 'hidden', border: '3px solid #00b0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
               {targetPhotoURL ? (
                 <img src={targetPhotoURL} alt="Driver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
               ) : null}
               <div style={{ display: targetPhotoURL ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                 {getInitials(targetName, 'D')}
               </div>
             </div>
             <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800, color: '#111' }}>Driver is here!</h3>
             <p style={{ margin: '0 0 24px', color: '#666', fontSize: '1rem', lineHeight: 1.4 }}>
               {targetName.split(' ')[0]} has arrived at the pickup point. Please proceed to the meeting area.
             </p>
             <button onClick={() => setShowDriverArrivedModal(false)} style={{ width: '100%', padding: '14px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
               Got it
             </button>
          </div>
        </div>
      )}

      {/* COMPLETED DRAWER MODAL FOR PASSENGER */}
      <div 
        onClick={() => {
           setShowRatingModal(false);
           navigate('/my-rides', { state: { initialTab: 'History' } });
        }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10000, opacity: showRatingModal ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: showRatingModal ? 'auto' : 'none' }}
      ></div>
      
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#282d32', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', boxShadow: showRatingModal ? '0 -4px 20px rgba(0,0,0,0.5)' : 'none', padding: '16px 24px calc(32px + env(safe-area-inset-bottom)) 24px', zIndex: 10001, transform: showRatingModal ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}
      >
        <div onClick={() => {
           setShowRatingModal(false);
           navigate('/my-rides', { state: { initialTab: 'History' } });
        }} style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
           <div style={{ width: '48px', height: '6px', background: '#555', borderRadius: '3px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', opacity: showRatingModal ? 0 : 1, transition: 'opacity 0.2s' }}></div>
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center' }}>
             <X size={24} color="#ccc" strokeWidth={2.5} />
           </div>
        </div>

        <div style={{ width: '100%', marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
           <img 
             src={targetPhotoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
             alt="" 
             style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
           />
           <p style={{ margin: '0 0 8px', color: '#aaa', fontSize: '0.95rem', fontWeight: 800 }}>Ride Completed</p>
           <h3 style={{ margin: '0 0 24px', fontSize: '1.4rem', fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: '1.3' }}>
             How was your carpool with {targetName.split(' ')[0]}?
           </h3>
           
           <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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
                 if (driverRide?.userId) {
                    try {
                       const userRef = doc(db, 'users', driverRide.userId);
                       const uSnap = await getDoc(userRef);
                       const userDoc = uSnap.exists() ? uSnap.data() : {};
                       
                       const currentTotalRating = userDoc.rating ? parseFloat(userDoc.rating) : 5.0;
                       const currentReviews = userDoc.reviews || userDoc.reviewsCount || 0;
                       
                       let newReviewsCount = currentReviews;
                       let newAverageRating = currentTotalRating;

                       if (passengerState.passengerRatedDriver && passengerState.ratingGivenToDriver !== undefined) {
                           // Update existing rating
                           const oldTotalSum = currentTotalRating * currentReviews;
                           const sumWithoutOld = oldTotalSum - passengerState.ratingGivenToDriver;
                           newAverageRating = currentReviews > 0 ? ((sumWithoutOld + tempRating) / currentReviews) : tempRating;
                       } else {
                           // Add new rating
                           newReviewsCount = currentReviews + 1;
                           newAverageRating = ((currentTotalRating * currentReviews) + tempRating) / newReviewsCount;
                       }
                       
                       await setDoc(userRef, { 
                          rating: newAverageRating.toFixed(1), 
                          reviews: newReviewsCount,
                          reviewsCount: newReviewsCount // fallback for backwards compat
                       }, { merge: true });
                       
                       await updateDoc(doc(db, 'rideRequests', passengerState.id), { 
                          passengerRatedDriver: true,
                          ratingGivenToDriver: tempRating
                       });
                       
                       setDriverProfile(prev => prev ? { 
                           ...prev, 
                           rating: newAverageRating.toFixed(1), 
                           reviews: newReviewsCount,
                           reviewsCount: newReviewsCount
                       } : prev);
                    } catch (err) { console.error("Rating save error", err); }
                 }
                 setHasRated(true);
                 setShowRatingModal(false);
                 setJustRated(true);
                 setTimeout(() => {
                     setJustRated(false);
                     navigate('/my-rides', { state: { initialTab: 'History' } });
                 }, 1200);
              }}
              style={{ width: '100%', padding: '16px', background: '#00b0f0', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
           >
             Save Rating
           </button>
        </div>
      </div>

    </div>
  );
}
