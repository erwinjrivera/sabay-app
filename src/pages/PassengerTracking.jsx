import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, User, Phone, MessageCircle, Star, Loader2, Navigation, Check, X } from 'lucide-react';
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
const getDriverCarIcon = (bearing, photoURL, name) => {
  const initials = getInitials(name, 'D');
  const innerContent = photoURL 
    ? `<img src="${photoURL}" onerror="this.onerror=null; this.outerHTML='<div style=\\'width:34px;height:34px;border-radius:50%;background:#ccc;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#fff;border:2px solid #fff;transform:rotate(${ -135 - (bearing || 0) }deg);\\'>${initials}</div>';" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #fff;transform:rotate(${ -135 - (bearing || 0) }deg);background:#ccc;" />` 
    : `<div style="width:34px;height:34px;border-radius:50%;background:#ccc;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#fff;border:2px solid #fff;transform:rotate(${ -135 - (bearing || 0) }deg);">${initials}</div>`;

  return new L.DivIcon({
    className: 'custom-driver-car',
    html: `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;position:relative; transform: rotate(${bearing || 0}deg); transition: transform 1s ease-out;">
             <div style="position:absolute;width:40px;height:40px;background:#ff0043;border-radius:50% 50% 50% 0;transform:rotate(135deg);box-shadow:0 4px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
                ${innerContent}
             </div>
           </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 25]
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
  useEffect(() => {
    if (centerOnLoc) {
       map.setView([centerOnLoc.lat, centerOnLoc.lon], 16, { animate: true });
    } else if (route1 && route1.length > 0) {
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
  const [passengerRoute, setPassengerRoute] = useState([]);
  const [sharedPath, setSharedPath] = useState([]);
  const [intercepts, setIntercepts] = useState(null);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [panToCar, setPanToCar] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [hasRated, setHasRated] = useState(passengerRequest?.passengerRatedDriver || false);
  const [showDriverArrivedModal, setShowDriverArrivedModal] = useState(false);
  const [hasSeenArrivalModal, setHasSeenArrivalModal] = useState(() => {
      return !!sessionStorage.getItem(`seen_arrival_${passengerRequest?.id}`);
  });

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

  // 2. Subscribe to Driver State
  useEffect(() => {
     if (!passengerState?.offeredByRideId) return;
     const unsub = onSnapshot(doc(db, 'rideOffers', passengerState.offeredByRideId), async (rideDoc) => {
         if (rideDoc.exists()) {
             const data = rideDoc.data();
             setDriverRide({ id: rideDoc.id, ...data });
             
             if (data.status === 'cancelled') {
                 navigate('/my-rides', { replace: true });
             }

             if (!driverProfile && data.userId) {
                 const uSnap = await getDoc(doc(db, 'users', data.userId));
                 if (uSnap.exists()) setDriverProfile(uSnap.data());
             }
         }
     });
     return () => unsub();
  }, [passengerState?.offeredByRideId, navigate, driverProfile]);

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
             // Fetch Passenger
             const resP = await fetch(`https://router.project-osrm.org/route/v1/driving/${passengerRequest.from.lon},${passengerRequest.from.lat};${passengerRequest.to.lon},${passengerRequest.to.lat}?geometries=geojson&overview=full`);
             const dataP = await resP.json();
             const pRoute = dataP.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
             setPassengerRoute(pRoute);

             // Fetch Driver
             const resD = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverRide.from.lon},${driverRide.from.lat};${driverRide.to.lon},${driverRide.to.lat}?geometries=geojson&overview=full`);
             const dataD = await resD.json();
             const dRoute = dataD.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
             setDriverRoute(dRoute);

             // Find exact overlaps against Driver Route using geometric nodes
             let globalMin = Infinity;
             const distProfile = pRoute.map((ptP, idxP) => {
                let minDist = Infinity;
                let closestDIdx = -1;
                dRoute.forEach((ptD, idxD) => {
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

             let pickupIdx = -1, dropoffIdx = -1, meetPickup = null, meetDropoff = null;
             
             if (overlaps.length > 0) {
                 const minPassOverlap = overlaps.reduce((min, o) => o.passIdx < min.passIdx ? o : min, overlaps[0]);
                 const maxPassOverlap = overlaps.reduce((max, o) => o.passIdx > max.passIdx ? o : max, overlaps[0]);

                 if (minPassOverlap.driverIdx > maxPassOverlap.driverIdx) {
                     pickupIdx = maxPassOverlap.passIdx;
                     dropoffIdx = minPassOverlap.passIdx;
                 } else {
                     pickupIdx = minPassOverlap.passIdx;
                     dropoffIdx = maxPassOverlap.passIdx;
                 }

                 meetPickup = pRoute[pickupIdx];
                 meetDropoff = pRoute[dropoffIdx];
                 
                 const dPickIdx = Math.min(minPassOverlap.driverIdx, maxPassOverlap.driverIdx);
                 const dDropIdx = Math.max(minPassOverlap.driverIdx, maxPassOverlap.driverIdx);
                 setSharedPath(dRoute.slice(dPickIdx, dDropIdx + 1));
                 
                 setIntercepts({
                    pickupPath: pRoute.slice(0, pickupIdx + 1),
                    dropoffPath: pRoute.slice(dropoffIdx),
                    meetPickup: { lat: meetPickup[0], lon: meetPickup[1] },
                    meetDropoff: { lat: meetDropoff[0], lon: meetDropoff[1] }
                 });
             } else {
                 let minOriginDist = Infinity;
                 let minDestDist = Infinity;
                 let fallbackPickIdx = 0, fallbackDropIdx = dRoute.length - 1;

                 dRoute.forEach((ptD, idx) => {
                     const distOrigin = getDistanceKM(ptD[0], ptD[1], passengerRequest.from.lat, passengerRequest.from.lon);
                     if (distOrigin < minOriginDist) { minOriginDist = distOrigin; fallbackPickIdx = idx; }
                     const distDest = getDistanceKM(ptD[0], ptD[1], passengerRequest.to.lat, passengerRequest.to.lon);
                     if (distDest < minDestDist) { minDestDist = distDest; fallbackDropIdx = idx; }
                 });

                 if (fallbackPickIdx > fallbackDropIdx) { const temp = fallbackPickIdx; fallbackPickIdx = fallbackDropIdx; fallbackDropIdx = temp; }
                 
                 meetPickup = dRoute[fallbackPickIdx];
                 meetDropoff = dRoute[fallbackDropIdx];

                 setSharedPath(dRoute.slice(fallbackPickIdx, fallbackDropIdx + 1));
                 
                 setIntercepts({
                    pickupPath: [ [passengerRequest.from.lat, passengerRequest.from.lon], meetPickup ],
                    dropoffPath: [ meetDropoff, [passengerRequest.to.lat, passengerRequest.to.lon] ],
                    meetPickup: { lat: meetPickup[0], lon: meetPickup[1] },
                    meetDropoff: { lat: meetDropoff[0], lon: meetDropoff[1] }
                 });
             }
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

  const driverLiveLat = driverRide.currentLat || driverRide.from.lat;
  const driverLiveLon = driverRide.currentLon || driverRide.from.lon;
  const driverLiveBearing = driverRide.currentHeading || 0;

  const isRideCompleted = driverRide?.status === 'completed' || passengerState?.status === 'completed';
  const activeColor = isRideCompleted ? '#9cc93a' : '#00b0f0';

  let statusText = isRideCompleted ? "Ride Completed" : "Driver is on their way";
  let statusSubtext = isRideCompleted ? "You've successfully reached your destination." : "Navigating to your pickup location";
  
  if (passengerState.phase === 1 && !isRideCompleted) {
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

        {sharedPath.length > 0 && (
           <Polyline positions={sharedPath} pathOptions={{ color: activeColor, weight: 6, opacity: 1 }} />
        )}

        {/* Driver End Marker */}
        <Marker position={[driverRide.to.lat, driverRide.to.lon]} icon={getDriverEndIcon()} />

        {/* Passenger Origin/Dest Markers */}
        <Marker position={[passengerRequest.from.lat, passengerRequest.from.lon]} icon={getPassengerStartIcon(activeColor)} />
        <Marker position={[passengerRequest.to.lat, passengerRequest.to.lon]} icon={getPassengerEndIcon(activeColor)} />

        {/* Meet and Dropoff Intercepts */}
        {intercepts && (
           <>
             <Polyline positions={intercepts.pickupPath} pathOptions={{ color: activeColor, weight: 4, opacity: 1, dashArray: '5, 8' }} />
             <Marker position={[intercepts.meetPickup.lat, intercepts.meetPickup.lon]} icon={getMeetSpotIcon(activeColor)}>
                <Tooltip direction="right" offset={[10, 0]} opacity={1} permanent>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {passPhoto ? (
                      <img src={passPhoto} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
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
        <Marker position={[driverLiveLat, driverLiveLon]} icon={getDriverCarIcon(driverLiveBearing, targetPhotoURL, targetName)} zIndexOffset={100} />

        <MapAdjuster route1={driverRoute} centerOnLoc={panToCar ? { lat: driverLiveLat, lon: driverLiveLon } : null} />
      </MapContainer>

      {/* Recenter Button */}
      <button 
        onClick={() => { setPanToCar(true); setTimeout(() => setPanToCar(false), 1000); }} 
        style={{ position: 'absolute', bottom: '260px', right: '20px', background: '#fff', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000 }}
      >
         <Navigation size={22} color="#00b0f0" fill="#00b0f0" />
      </button>

      {/* TOP HEADER */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(40,45,50,0.95)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
          <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', color: '#fff' }}>
            <button onClick={() => navigate('/my-rides')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, marginRight: '1rem' }}>
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
          position: 'absolute', bottom: '24px', left: 0, width: '100%', 
          display: 'flex', justifyContent: 'center', zIndex: 1000 
      }}>
          <div style={{ 
              width: '90vw', maxWidth: '400px',
              background: '#fff', 
              borderRadius: '8px', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
          }}>
            {/* Top Detail Row */}
            <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
               <div>
                 <img 
                   src={targetPhotoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"}
                   alt="Driver Profile" 
                   onError={(e) => { e.target.onerror = null; e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"; }}
                   style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} 
                 />
               </div>
               
               <div style={{ flex: 1 }}>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: activeColor, fontWeight: 600 }}>
                   {driverRide?.time ? dayjs(driverRide.time).format('h:mm A') : dayjs().format('h:mm A')}
                 </p>
                 <h3 style={{ margin: '2px 0', fontSize: '1rem', fontWeight: 600, color: '#222' }}>
                   {targetName}
                 </h3>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(starNum => {
                        const isFilled = starNum <= Math.round(parseFloat(targetRating)); 
                        return <Star key={starNum} size={12} fill={isFilled ? "#ffb800" : "#eaeaea"} color={isFilled ? "#ffb800" : "#eaeaea"} />;
                    })}
                    <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '4px' }}>
                        {targetRating === '0.0' ? 'New' : `${targetRating} (${targetReviews})`}
                    </span>
                 </div>
                 {/* Removed vehicle specifics per review request */}
               </div>

               <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '4px' }}>
                     {Array.from({ length: targetSeats }).map((_, i) => (
                        <User key={i} size={12} fill={activeColor} color={activeColor} />
                     ))}
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>
                      {targetPrice}
                  </p>
               </div>
            </div>

            {/* Bottom Interactivity Row */}
            <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0', marginTop: 'auto' }}>
               <button style={{ width: '60px', padding: '16px 0', background: '#333', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                 <MessageCircle size={20} fill="#fff" color="#fff" />
               </button>
               {isRideCompleted && (
                  <button onClick={() => { setTempRating(passengerState?.ratingGivenToDriver || 0); setShowRatingModal(true); }} style={{ width: '60px', padding: '16px 0', background: '#ffb800', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.3s' }}>
                    <Star size={20} fill="#fff" color="#fff" />
                  </button>
               )}
               <button 
                 style={{ flex: 1, padding: '16px', background: activeColor, border: 'none', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
               >
                 {!isRideCompleted && <Phone size={18} fill="#fff" />}
                 {isRideCompleted ? "Completed Ride" : "Call Driver"}
               </button>
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
        }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10000, opacity: showRatingModal ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: showRatingModal ? 'auto' : 'none' }}
      ></div>
      
      <div 
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#fff', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '16px 24px 32px 24px', zIndex: 10001, transform: showRatingModal ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}
      >
        <div onClick={() => {
           setShowRatingModal(false);
        }} style={{ width: '100%', height: '40px', position: 'absolute', top: 0, left: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
           <div style={{ width: '48px', height: '6px', background: '#ccc', borderRadius: '3px', position: 'absolute', left: '50%', transform: 'translateX(-50%)', opacity: showRatingModal ? 0 : 1, transition: 'opacity 0.2s' }}></div>
           <div style={{ position: 'absolute', top: '20px', right: '16px', display: 'flex', alignItems: 'center' }}>
             <X size={24} color="#555" strokeWidth={2.5} />
           </div>
        </div>

        <div style={{ width: '100%', marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
           <img 
             src={targetPhotoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23a0d2ff'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%235bb1ff'/%3E%3C/svg%3E"} 
             alt="" 
             style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
           />
           <p style={{ margin: '0 0 8px', color: '#111', fontSize: '0.95rem', fontWeight: 800 }}>Ride Completed</p>
           <h3 style={{ margin: '0 0 24px', fontSize: '1.4rem', fontWeight: 800, color: '#111', textAlign: 'center', lineHeight: '1.3' }}>
             How was your carpool with {targetName.split(' ')[0]}?
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
                 if (driverRide?.userId) {
                    try {
                       const userRef = doc(db, 'users', driverRide.userId);
                       const uSnap = await getDoc(userRef);
                       const userDoc = uSnap.exists() ? uSnap.data() : {};
                       
                       const currentTotalRating = userDoc.rating ? parseFloat(userDoc.rating) : 5.0;
                       const currentReviews = userDoc.reviews || 0;
                       
                       let newReviewsCount = currentReviews + 1;
                       let newAverageRating = ((currentTotalRating * currentReviews) + tempRating) / newReviewsCount;
                       
                       await setDoc(userRef, { 
                          rating: newAverageRating.toFixed(1), 
                          reviewsCount: newReviewsCount 
                       }, { merge: true });
                       
                       await updateDoc(doc(db, 'rideRequests', passengerState.id), { 
                          passengerRatedDriver: true,
                          ratingGivenToDriver: tempRating
                       });
                    } catch (err) { console.error("Rating save error", err); }
                 }
                 setHasRated(true);
                 setShowRatingModal(false);
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
