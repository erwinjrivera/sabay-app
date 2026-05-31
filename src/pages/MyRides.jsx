import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, User, Car, Search, MoreHorizontal, Check, Edit, Loader2, X, Calendar, ChevronRight, Users, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, getDoc, doc, onSnapshot } from 'firebase/firestore';
import dayjs from 'dayjs';

const AvatarFallback = ({ src, name }) => {
  const [error, setError] = useState(false);
  
  const getInitials = (n) => {
    if (!n) return '';
    const parts = n.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (!src || error) {
    const initials = getInitials(name);
    return initials ? (
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>{initials}</span>
    ) : (
      <User size={20} color="#64748b" />
    );
  }

  return (
    <img 
      src={src} 
      alt="Profile" 
      onError={() => setError(true)} 
      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
    />
  );
};

export default function MyRides() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, cleanupStaleRides } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'Pending');

  useEffect(() => {
    if (location.state?.initialTab) {
      setActiveTab(location.state.initialTab);
    }
  }, [location.state?.initialTab]);

  // Geospatial Euclidean Filter mirroring OfferMatches constraints securely
  const getDistanceKM = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    // Explicitly run cleanup on MyRides mount so the database syncs quickly
    if (cleanupStaleRides) {
        cleanupStaleRides(currentUser);
    }

    const isValidGeographicProxy = (ride1, ride2, isRide1Driver) => {
        if (!ride1.from?.lat || !ride1.to?.lat || !ride2.from?.lat || !ride2.to?.lat) return false;

        const driver = isRide1Driver ? ride1 : ride2;
        const pass = isRide1Driver ? ride2 : ride1;

        const dx = driver.to.lon - driver.from.lon;
        const dy = driver.to.lat - driver.from.lat;
        const lenSq = (dx * dx) + (dy * dy);
        
        if (lenSq === 0) return false;
        const len = Math.sqrt(lenSq);

        // Along-track projection
        const pPickupX = pass.from.lon - driver.from.lon;
        const pPickupY = pass.from.lat - driver.from.lat;
        const projPickup = (pPickupX * dx) + (pPickupY * dy);
        
        const pDropX = pass.to.lon - driver.from.lon;
        const pDropY = pass.to.lat - driver.from.lat;
        const projDrop = (pDropX * dx) + (pDropY * dy);

        if (projPickup > lenSq) return false;
        if (projDrop < 0) return false;
        if (projPickup >= projDrop) return false;

        // Cross-track distance (perpendicular distance to the line)
        const crossPickup = Math.abs(dx * (driver.from.lat - pass.from.lat) - (driver.from.lon - pass.from.lon) * dy) / len;
        const crossDrop = Math.abs(dx * (driver.from.lat - pass.to.lat) - (driver.from.lon - pass.to.lon) * dy) / len;

        // 0.05 degrees is approx 5.5 km.
        if (crossPickup > 0.05 || crossDrop > 0.05) return false;

        const buffer = 0.045; 
        const dMinLat = Math.min(driver.from.lat, driver.to.lat) - buffer;
        const dMaxLat = Math.max(driver.from.lat, driver.to.lat) + buffer;
        const dMinLon = Math.min(driver.from.lon, driver.to.lon) - buffer;
        const dMaxLon = Math.max(driver.from.lon, driver.to.lon) + buffer;

        const pMinLat = Math.min(pass.from.lat, pass.to.lat);
        const pMaxLat = Math.max(pass.from.lat, pass.to.lat);
        const pMinLon = Math.min(pass.from.lon, pass.to.lon);
        const pMaxLon = Math.max(pass.from.lon, pass.to.lon);

        return (dMaxLat > pMinLat && dMinLat < pMaxLat) && (dMaxLon > pMinLon && dMinLon < pMaxLon);
    };

    const isValidTemporalProxy = (ride1, ride2, isRide1Driver) => {
        if (!ride1.date || !ride2.date || !ride1.time || !ride2.time) return false;
        const d1 = dayjs(ride1.date).format('YYYY-MM-DD');
        const d2 = dayjs(ride2.date).format('YYYY-MM-DD');
        if (d1 !== d2) return false;

        const today = dayjs().format('YYYY-MM-DD');
        if (d1 < today) return false;

        const time1 = dayjs(ride1.time);
        const time2 = dayjs(ride2.time);
        const m1 = time1.hour() * 60 + time1.minute();
        const m2 = time2.hour() * 60 + time2.minute();
        
        const mDriver = isRide1Driver ? m1 : m2;
        const mPassenger = isRide1Driver ? m2 : m1;
        
        const timeDiff = mDriver - mPassenger;
        if (timeDiff < -60 || timeDiff > 180) return false;

        return true;
    };

    let myOffers = [];
    let myReqs = [];
    let linkedOffers = [];
    let linkedReqs = [];
    let openOffers = [];
    let openReqs = [];

    let myOffersReady = false;
    let myReqsReady = false;
    let linkedReady = false;
    
    const profileCache = {};

    let linkedOffersUnsub = () => {};
    let linkedReqsUnsub = () => {};

    // Static fetch to calculate matches without blowing up realtime reads
    const fetchOpenRidesOnce = async () => {
        try {
            const [oSnap, rSnap] = await Promise.all([
                getDocs(query(collection(db, 'rideOffers'), where('status', '==', 'open'))),
                getDocs(query(collection(db, 'rideRequests'), where('status', '==', 'open')))
            ]);
            openOffers = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            openReqs = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error fetching open rides cache", e);
        }
    };

    const processRides = async () => {
        if (!myOffersReady || !myReqsReady || !linkedReady) return;
        
        // Emulate the old global arrays for downstream business logic processing seamlessly
        const mergedOffersMap = new Map();
        [...myOffers, ...linkedOffers, ...openOffers].forEach(o => mergedOffersMap.set(o.id, o));
        const allOffers = Array.from(mergedOffersMap.values());

        const mergedReqsMap = new Map();
        [...myReqs, ...linkedReqs, ...openReqs].forEach(r => mergedReqsMap.set(r.id, r));
        const allReqs = Array.from(mergedReqsMap.values());

        const rawOffers = myOffers.map((data) => {
             const passengersMap = new Map();
             
             const passengerArray = [...(data.requestedByPassengerIds || []), ...(data.offeredToPassengerIds || [])];
             if (passengerArray.length > 0) {
                 for (let reqId of passengerArray) {
                     const reqData = allReqs.find(r => r.id === reqId);
                     if (reqData) {
                         let pStatus = 'Request';
                         if (reqData.status === 'completed' && reqData.offeredByRideId === data.id) {
                            pStatus = 'Completed';
                         } else if (reqData.status === 'confirmed' && reqData.offeredByRideId === data.id) {
                            pStatus = 'Confirmed';
                         } else if (reqData.status === 'offered' && reqData.offeredByRideId === data.id) {
                            pStatus = 'Offered';
                         }
                         passengersMap.set(reqData.id, { ...reqData, pStatus });
                     }
                 }
             }

             const linkedPassengerReqs = allReqs.filter(r => r.offeredByRideId === data.id);
             linkedPassengerReqs.forEach(reqData => {
                 if (!passengersMap.has(reqData.id)) {
                     let pStatus = 'Offered'; 
                     if (reqData.status === 'completed') pStatus = 'Completed';
                     else if (reqData.status === 'confirmed') pStatus = 'Confirmed';
                     passengersMap.set(reqData.id, { ...reqData, pStatus });
                 }
             });

             const passengers = Array.from(passengersMap.values()).sort((a, b) => {
                 if (a.pStatus === 'Confirmed' && b.pStatus !== 'Confirmed') return -1;
                 if (b.pStatus === 'Confirmed' && a.pStatus !== 'Confirmed') return 1;
                 return 0;
             });

             const eligibleReqs = allReqs.filter(r => {
                 if (r.userId === currentUser.uid || !r.from?.lat || !r.to?.lat) return false;
                 const isLinked = r.offeredByRideId === data.id || 
                                  (data.requestedByPassengerIds || []).includes(r.id) || 
                                  (data.offeredToPassengerIds || []).includes(r.id);
                 if (isLinked) return true;
                 return r.status === 'open' && isValidGeographicProxy(data, r, true) && isValidTemporalProxy(data, r, true);
             });
             
             let matchesFound = 0;
             if (data.from?.lat && data.to?.lat) {
                 matchesFound = eligibleReqs.length;
             }

             return { ...data, collectionType: 'offer', passengers, matchesCount: matchesFound };
        });

        const rawRequests = myReqs.map((data) => {
             const passengers = [];
             
             if (data.offeredByRideId && data.status !== 'open') {
                 const driverData = allOffers.find(r => r.id === data.offeredByRideId);
                 if (driverData) {
                     let pStatus = 'Sent Request';
                     if (data.status === 'completed') pStatus = 'Completed';
                     else if (data.status === 'confirmed') pStatus = 'Confirmed';
                     else if (data.status === 'offered') pStatus = 'Accept Offer';
                     
                     passengers.push({ ...driverData, pStatus, userName: driverData.userName || 'Driver' });
                 }
             }

             const eligibleOffers = allOffers.filter(r => {
                 if (r.userId === currentUser.uid || !r.from?.lat || !r.to?.lat) return false;
                 const isLinked = data.offeredByRideId === r.id || 
                                  (r.requestedByPassengerIds || []).includes(data.id) ||
                                  (r.offeredToPassengerIds || []).includes(data.id);
                 if (isLinked) return true;
                 return (!r.status || (r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'expired')) && 
                        isValidGeographicProxy(data, r, false) && 
                        isValidTemporalProxy(data, r, false);
             });
             
             let matchesFound = 0;
             if (data.from?.lat && data.to?.lat) {
                 matchesFound = eligibleOffers.length;
             }

             let computedStatus = data.status;
             if (data.offeredByRideId && data.status === 'confirmed') {
                 const linkedDriver = allOffers.find(r => r.id === data.offeredByRideId);
                 if (linkedDriver && linkedDriver.status === 'in_progress') {
                     computedStatus = 'in_progress';
                 }
             }

             return { ...data, collectionType: 'request', passengers, matchesCount: matchesFound, computedStatus: computedStatus };
        });

        const mergedRides = [...rawOffers, ...rawRequests].sort((a, b) => {
           const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return timeB - timeA; 
        });

        const enrichProfiles = async () => {
            const enriched = await Promise.all(mergedRides.map(async (ride) => {
                if (!ride.passengers || ride.passengers.length === 0) return ride;
                const enrichedPassengers = await Promise.all(ride.passengers.map(async (p) => {
                    if (!p.userId) return p;
                    if (profileCache[p.userId] !== undefined) {
                        const cached = profileCache[p.userId];
                        const patches = {};
                        if (cached.photo) patches.userProfilePic = cached.photo;
                        if (cached.name) patches.userName = cached.name;
                        if (cached.rating) patches.userRating = parseFloat(cached.rating).toFixed(1);
                        patches.userReviews = cached.reviews || 0;
                        if (cached.plateNumber) patches.userPlateNumber = cached.plateNumber;
                        if (cached.carMake) patches.userCarMake = cached.carMake;
                        if (cached.carModel) patches.userCarModel = cached.carModel;
                        if (cached.carColor) patches.userCarColor = cached.carColor;
                        return { ...p, ...patches };
                    }
                    try {
                        const uSnap = await getDoc(doc(db, 'users', p.userId));
                        if (uSnap.exists()) {
                            const uData = uSnap.data();
                            profileCache[p.userId] = { photo: uData.photoURL || '', name: uData.fullName || '', rating: uData.rating || '0.0', reviews: uData.reviewsCount !== undefined ? uData.reviewsCount : (uData.reviews || 0), plateNumber: uData.plateNumber || '', carMake: uData.carMake || '', carModel: uData.carModel || '', carColor: uData.carColor || '' };
                            const patches = {};
                            if (uData.photoURL) patches.userProfilePic = uData.photoURL;
                            if (uData.fullName) patches.userName = uData.fullName;
                            if (uData.rating) patches.userRating = parseFloat(uData.rating).toFixed(1);
                            patches.userReviews = uData.reviewsCount !== undefined ? uData.reviewsCount : (uData.reviews || 0);
                            if (uData.plateNumber) patches.userPlateNumber = uData.plateNumber;
                            if (uData.carMake) patches.userCarMake = uData.carMake;
                            if (uData.carModel) patches.userCarModel = uData.carModel;
                            if (uData.carColor) patches.userCarColor = uData.carColor;
                            return { ...p, ...patches };
                        } else { profileCache[p.userId] = { photo: '', name: '' }; }
                    } catch (e) { profileCache[p.userId] = { photo: '', name: '' }; }
                    return p;
                }));
                return { ...ride, passengers: enrichedPassengers };
            }));
            return enriched;
        };
        const finalRides = await enrichProfiles();
        setRides(finalRides);
        setLoading(false);
    };

    const setupLinkedListeners = () => {
        const linkedOfferIds = [...new Set(myReqs.map(r => r.offeredByRideId).filter(Boolean))];
        const linkedReqIds = [...new Set(myOffers.flatMap(r => [
            ...(r.requestedByPassengerIds || []),
            ...(r.offeredToPassengerIds || [])
        ]).filter(Boolean))];

        linkedOffersUnsub();
        linkedReqsUnsub();
        
        let offersPending = linkedOfferIds.length > 0;
        let reqsPending = linkedReqIds.length > 0;
        
        if (!offersPending && !reqsPending) {
            linkedOffers = [];
            linkedReqs = [];
            linkedReady = true;
            processRides();
            return;
        }

        const checkLinkedReady = () => {
            if (!offersPending && !reqsPending) {
                linkedReady = true;
                processRides();
            }
        };

        if (linkedOfferIds.length > 0) {
            const q = query(collection(db, 'rideOffers'), where('__name__', 'in', linkedOfferIds.slice(0, 30)));
            linkedOffersUnsub = onSnapshot(q, snap => {
                linkedOffers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                offersPending = false;
                checkLinkedReady();
            });
        } else {
            linkedOffers = [];
            offersPending = false;
        }

        if (linkedReqIds.length > 0) {
            const q = query(collection(db, 'rideRequests'), where('__name__', 'in', linkedReqIds.slice(0, 30)));
            linkedReqsUnsub = onSnapshot(q, snap => {
                linkedReqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                reqsPending = false;
                checkLinkedReady();
            });
        } else {
            linkedReqs = [];
            reqsPending = false;
        }
    };

    setLoading(true);
    let myOffersUnsub = () => {};
    let myReqsUnsub = () => {};

    fetchOpenRidesOnce().then(() => {
        myOffersUnsub = onSnapshot(query(collection(db, 'rideOffers'), where('userId', '==', currentUser.uid)), snap => {
            myOffers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            myOffersReady = true;
            if (myReqsReady) setupLinkedListeners();
        }, (err) => console.error(err));

        myReqsUnsub = onSnapshot(query(collection(db, 'rideRequests'), where('userId', '==', currentUser.uid)), snap => {
            myReqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            myReqsReady = true;
            if (myOffersReady) setupLinkedListeners();
        }, (err) => console.error(err));
    });

    return () => {
        myOffersUnsub();
        myReqsUnsub();
        linkedOffersUnsub();
        linkedReqsUnsub();
    };
  }, [currentUser, navigate, cleanupStaleRides]);

  // Format timestamp helper
  const getRideTimeOnly = (ride) => {
    if (ride.time) {
       return `at ${dayjs(ride.time).format('h:mm A')}`;
    }
    return '';
  };

  const getRideDateStr = (ride) => {
    if (ride.date) {
       return dayjs(ride.date).format('MMM D, YYYY');
    }
    return '';
  };

  const getRideDateParts = (ride) => {
    if (ride.date) {
      const d = dayjs(ride.date);
      return { month: d.format('MMM').toUpperCase(), day: d.format('DD'), year: d.format('YYYY') };
    }
    return { month: '', day: '--', year: '' };
  };

  const isExpiredLocally = (ride) => {
    if (['in_progress', 'completed', 'cancelled', 'expired'].includes(ride.status)) return false;
    
    let scheduledTime;
    if (ride.date && ride.time) {
         const datePart = dayjs(ride.date).format('YYYY-MM-DD');
         const timePart = dayjs(ride.time).format('HH:mm:ss');
         scheduledTime = dayjs(`${datePart}T${timePart}`);
    } else if (ride.time || ride.date) {
         scheduledTime = dayjs(ride.time || ride.date);
    } else {
         return false;
    }
    
    if (!scheduledTime.isValid()) return false;
    return dayjs().diff(scheduledTime, 'hour') >= 8;
  };

  const filteredRides = rides.filter(ride => {
     let status = ride.computedStatus || ride.status || 'open';
     if (!['in_progress', 'completed', 'cancelled', 'expired'].includes(status) && isExpiredLocally(ride)) {
         status = 'expired';
         ride.computedStatus = 'expired'; // Inject locally so other renders treat it as expired
     }
     
     if (activeTab === 'Pending') return !['in_progress', 'completed', 'cancelled', 'expired'].includes(status);
     if (activeTab === 'Active') return status === 'in_progress';
     if (activeTab === 'History') return ['completed', 'cancelled', 'expired'].includes(status);
     return false;
  });

  if (activeTab === 'Pending') {
      filteredRides.sort((a, b) => {
          const dA = a.date ? dayjs(a.date).format('YYYY-MM-DD') : '9999-12-31';
          const dB = b.date ? dayjs(b.date).format('YYYY-MM-DD') : '9999-12-31';
          if (dA < dB) return -1;
          if (dA > dB) return 1;

          const tA = a.time ? dayjs(a.time).format('HH:mm') : '23:59';
          const tB = b.time ? dayjs(b.time).format('HH:mm') : '23:59';
          if (tA < tB) return -1;
          if (tA > tB) return 1;
          return 0;
      });
  }

  const hasActiveRide = rides.some(ride => {
      const status = ride.computedStatus || ride.status || 'open';
      return status === 'in_progress';
  });

  return (
    <div className="home-container" style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', height: '100dvh', overflow: 'hidden' }}>
      
      {/* Dark Header Strip */}
      <div style={{ background: '#1e293b', zIndex: 10 }}>
        {/* Top Bar Navigation */}
        <div style={{ padding: 'calc(1.5rem + env(safe-area-inset-top)) 1rem 1rem', display: 'flex', alignItems: 'center', gap: '16px', color: '#f8fafc' }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#f8fafc', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>My Rides</h1>
          </div>
        </div>

        {/* Text Tabs */}
        <div style={{ padding: '0 1rem', display: 'flex', borderBottom: '1px solid #334155' }}>
          {['Pending', 'Active', 'History'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px 0 16px 0',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <div style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: isActive ? 600 : 500, 
                  color: isActive ? '#f8fafc' : '#94a3b8', 
                  transition: 'color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {tab}
                  {tab === 'Active' && hasActiveRide && (
                    <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%', flexShrink: 0 }}></span>
                  )}
                </div>
                
                {/* Active Indicator Underline */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: isActive ? '60px' : '0px',
                  height: '4px',
                  background: '#0ea5e9',
                  borderRadius: '4px 4px 0 0',
                  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                  opacity: isActive ? 1 : 0
                }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(100px + env(safe-area-inset-bottom))' }}>

        {/* RIDES LIST */}
        <div style={{ padding: '1rem 1.5rem' }}>
      {loading ? (
        <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <Loader2 size={40} color="#999" style={{ animation: 'spin 1.2s linear infinite' }} />
          <h3 style={{ color: '#888', margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Loading your rides...</h3>
        </div>
      ) : filteredRides.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#94a3b8' }}>
            <div style={{ background: '#1e293b', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
               <MapPin size={32} color="#64748b" />
            </div>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 8px 0' }}>No {activeTab.toLowerCase()} rides</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>You don't have any {activeTab.toLowerCase()} rides at the moment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
                   {filteredRides.map(ride => {
                     const isDriver = ride.collectionType === 'offer';
                     const activeColor = '#00b0f0';
                     let badgeText = isDriver ? 'Offer Ride' : 'Find Ride';
                     if (activeTab !== 'History') {
                        if (ride.status === 'cancelled') {
                           badgeText = `${badgeText} (Cancelled)`;
                        } else if (ride.status === 'expired') {
                           badgeText = `${badgeText} (Expired)`;
                        } else if (ride.status === 'completed') {
                           badgeText = `${badgeText} (Completed)`;
                        }
                     }
                     
                     let ribbonLeftColor = isDriver ? '#9cc93a' : '#00b0f0';
                     let ribbonRightColor = isDriver ? '#8ab528' : '#0090c0';

                     if (activeTab === 'History') {
                        if (ride.status === 'cancelled' || ride.status === 'expired') {
                           ribbonLeftColor = '#888';
                           ribbonRightColor = '#777';
                        } else {
                           ribbonLeftColor = '#9cc93a';
                           ribbonRightColor = '#8ab528';
                        }
                     } else if (ride.passengers) {
                        const hasConfirmed = ride.passengers.some(p => p.pStatus === 'Confirmed');
                        const hasRequest = ride.passengers.some(p => p.pStatus === 'Request' || p.pStatus === 'Accept Offer');
                        const hasOffered = ride.passengers.some(p => p.pStatus === 'Offered' || p.pStatus === 'Sent Request');

                        if (hasConfirmed) {
                           ribbonLeftColor = '#9cc93a'; // Green
                           ribbonRightColor = '#8ab528';
                        } else if (hasRequest) {
                           ribbonLeftColor = '#ff0043'; // Red
                           ribbonRightColor = '#d00035';
                        } else if (hasOffered) {
                           ribbonLeftColor = '#eab308'; // Orange
                           ribbonRightColor = '#c89600';
                        } else {
                           ribbonLeftColor = '#00b0f0'; // Blue
                           ribbonRightColor = '#0090c0';
                        }
                     }

                     return (
                        <div 
                          key={ride.id}
                          onClick={() => {
                            if (isDriver) {
                              if (ride.status === 'in_progress') {
                                navigate('/active-ride', { state: { ride, fromTab: activeTab } });
                              } else {
                                navigate('/offer-matches', { state: { ride, fromTab: activeTab } });
                              }
                            } else {
                              const effStatus = ride.computedStatus || ride.status;
                              if (effStatus === 'in_progress' && activeTab !== 'History') {
                                navigate('/passenger-tracking', { state: { ride, fromTab: activeTab } });
                              } else {
                                navigate('/find-matches', { state: { ride, fromTab: activeTab } });
                              }
                            }
                          }}
                          style={{ 
                            background: '#1e293b', 
                            borderRadius: '10px',
                            border: 'none',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* UNIFIED HEADER + ROUTE WITH VERTICAL CONNECTOR */}
                          <div style={{ padding: '18px 20px 16px 20px', display: 'flex', flexDirection: 'column' }}>
                            {/* ROW 1: Icon circle + Title/Date/Time */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                              <div style={{ width: '50px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {isDriver ? <Car size={20} color="#e2e8f0" /> : <Search size={18} color="#e2e8f0" strokeWidth={2.5} />}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0, paddingLeft: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>{badgeText}</span>
                                  <div style={{ display: 'flex', gap: '1px', flexShrink: 0, marginTop: '2px' }}>
                                    {Array.from({ length: ride.seats || 1 }).map((_, i) => {
                                      const fillStatus = isDriver ? i < (ride.seatsTaken || 0) : true;
                                      return (
                                        <User key={i} size={15} color={fillStatus ? '#9cc93a' : '#475569'} fill={fillStatus ? '#9cc93a' : '#475569'} />
                                      );
                                    })}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                                  <Calendar size={13} color="#94a3b8" />
                                  <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#94a3b8' }}>{getRideDateStr(ride)}</span>
                                  {getRideTimeOnly(ride) && (
                                    <>
                                      <span style={{ fontSize: '0.78rem', color: '#475569', margin: '0 1px' }}>|</span>
                                      <Clock size={13} color="#94a3b8" />
                                      <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#94a3b8' }}>{getRideTimeOnly(ride).replace('at ', '')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ROUTE: Two columns, seamless connector */}
                            <div style={{ display: 'flex', gap: '0', marginTop: '0' }}>
                              {/* Left: continuous connector strip */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px', flexShrink: 0, gap: '0' }}>
                                <div style={{ width: '1.5px', height: '18px', background: '#475569' }}></div>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }}></div>
                                <div style={{ width: '1.5px', height: '18px', background: '#475569' }}></div>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1e293b', border: '2.5px solid #94a3b8', flexShrink: 0, boxSizing: 'border-box' }}></div>
                              </div>
                              {/* Right: address labels aligned with dots */}
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingLeft: '10px', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', paddingTop: '16px' }}>
                                  {ride.from?.address || 'Unknown origin'}
                                </span>
                                <span style={{ fontSize: '0.88rem', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                  {ride.to?.address || 'Unknown destination'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* SECTION 3: PASSENGERS */}
                          {ride.passengers && ride.passengers.filter(p => activeTab !== 'History' || ['Completed', 'Confirmed'].includes(p.pStatus)).length > 0 && (
                            <>
                              <div style={{ width: '100%', height: '1px', background: '#334155' }}></div>
                              <div style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  {ride.passengers.filter(p => activeTab !== 'History' || ['Completed', 'Confirmed'].includes(p.pStatus)).map((p, idx) => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#334155', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #475569' }}>
                                        <AvatarFallback src={p.userProfilePic} name={p.userName} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                                          {p.userName || 'Passenger'}
                                        </span>
                                        {/* Star Rating & Reviews */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
                                          {[1, 2, 3, 4, 5].map(starNum => {
                                            const ratingVal = parseFloat(p.userRating) || 0;
                                            const isFilled = starNum <= Math.round(ratingVal);
                                            return <Star key={starNum} size={11} fill={isFilled ? "#ffb800" : "#475569"} color={isFilled ? "#ffb800" : "#475569"} />;
                                          })}
                                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '3px', fontWeight: 600 }}>{p.userRating || '0.0'} <span style={{ fontWeight: 400 }}>({p.userReviews || 0})</span></span>
                                        </div>
                                        {/* Car Details (passenger POV - viewing driver info) */}
                                        {!isDriver && p.userPlateNumber && (
                                          <div style={{ marginTop: '2px', fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontWeight: 600 }}>{p.userPlateNumber}</span> | {p.userCarMake} {p.userCarModel} ({p.userCarColor})
                                          </div>
                                        )}
                                        {/* Status */}
                                        {(p.pStatus === 'Confirmed' || p.pStatus === 'Completed') && (
                                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9cc93a', marginTop: '3px' }}>{p.pStatus}</span>
                                        )}
                                        {p.pStatus === 'Request' && (
                                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ef4444', marginTop: '3px' }}>Accept Request</span>
                                        )}
                                        {p.pStatus === 'Accept Offer' && (
                                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ef4444', marginTop: '3px' }}>Accept Offer</span>
                                        )}
                                        {p.pStatus === 'Offered' && (
                                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b', marginTop: '3px' }}>Ride Offered</span>
                                        )}
                                        {p.pStatus === 'Sent Request' && (
                                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b', marginTop: '3px' }}>Sent Request</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {/* SECTION 4: MATCH COUNT / HISTORY STAMP */}
                          {activeTab !== 'History' ? (
                            <div style={{ padding: '6px 16px 14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '16px', padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: '50%', background: 'rgba(14, 165, 233, 0.25)', flexShrink: 0 }}>
                                  <Users size={20} color="#0ea5e9" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0ea5e9', letterSpacing: '-0.2px' }}>
                                    {ride.matchesCount || 0} ride match{(ride.matchesCount || 0) > 1 ? 'es' : ''}
                                  </span>
                                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                                    available on your route
                                  </span>
                                </div>
                                <ChevronRight size={22} color="#0ea5e9" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ width: '100%', height: '1px', background: '#334155' }}></div>
                              <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50px', background: ((ride.computedStatus || ride.status) === 'cancelled' || (ride.computedStatus || ride.status) === 'expired') ? '#334155' : '#8ab528', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: ((ride.computedStatus || ride.status) === 'cancelled' || (ride.computedStatus || ride.status) === 'expired') ? '#94a3b8' : '#fff', letterSpacing: '0.3px' }}>
                                  {(ride.computedStatus || ride.status) === 'cancelled' ? 'Ride Cancelled' : (ride.computedStatus || ride.status) === 'expired' ? 'Ride Expired' : 'Ride Completed'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                     );
                  })}
          </div>
        )}
        </div>
      </div>

    </div>
  );
}