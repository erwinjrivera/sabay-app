import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, User, Car, Search, MoreHorizontal, Check, Edit, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, getDoc, doc, onSnapshot } from 'firebase/firestore';
import dayjs from 'dayjs';

export default function MyRides() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'Pending');

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

    // High-performance mathematical map proxy mapping vector dot-products securely detecting inverted trips without OSRM intensity!
    const isValidGeographicProxy = (ride1, ride2) => {
        if (!ride1.from?.lat || !ride1.to?.lat || !ride2.from?.lat || !ride2.to?.lat) return false;

        const dx1 = ride1.to.lon - ride1.from.lon;
        const dy1 = ride1.to.lat - ride1.from.lat;
        const dx2 = ride2.to.lon - ride2.from.lon;
        const dy2 = ride2.to.lat - ride2.from.lat;
        
        // Block explicitly inverted trajectories spanning the identical geographical bounds
        const dotProduct = (dx1 * dx2) + (dy1 * dy2);
        if (dotProduct < 0) return false; 

        // 5km spatial bounding-box buffer detecting structural map isolation (e.g., Manila vs Cebu)
        const buffer = 0.045; 
        const r1MinLat = Math.min(ride1.from.lat, ride1.to.lat) - buffer;
        const r1MaxLat = Math.max(ride1.from.lat, ride1.to.lat) + buffer;
        const r1MinLon = Math.min(ride1.from.lon, ride1.to.lon) - buffer;
        const r1MaxLon = Math.max(ride1.from.lon, ride1.to.lon) + buffer;

        const r2MinLat = Math.min(ride2.from.lat, ride2.to.lat);
        const r2MaxLat = Math.max(ride2.from.lat, ride2.to.lat);
        const r2MinLon = Math.min(ride2.from.lon, ride2.to.lon);
        const r2MaxLon = Math.max(ride2.from.lon, ride2.to.lon);

        return (r1MaxLat > r2MinLat && r1MinLat < r2MaxLat) && (r1MaxLon > r2MinLon && r1MinLon < r2MaxLon);
    };

    let allOffers = [];
    let allReqs = [];
    let offersReady = false;
    let reqsReady = false;

    const processRides = () => {
        if (!offersReady || !reqsReady) return;
        
        const myOffers = allOffers.filter(r => r.userId === currentUser.uid);
        const myReqs = allReqs.filter(r => r.userId === currentUser.uid);

        const rawOffers = myOffers.map((data) => {
             const passengersMap = new Map();
             
             if (data.requestedByPassengerIds && data.requestedByPassengerIds.length > 0) {
                 for (let reqId of data.requestedByPassengerIds) {
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

             const eligibleReqs = allReqs.filter(r => 
                 r.userId !== currentUser.uid && 
                 r.from?.lat && r.to?.lat && 
                 (r.status === 'open' || r.offeredByRideId === data.id || (data.requestedByPassengerIds || []).includes(r.id)) &&
                 isValidGeographicProxy(data, r)
             );
             
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

             const eligibleOffers = allOffers.filter(r => 
                 r.userId !== currentUser.uid && 
                 r.from?.lat && r.to?.lat && 
                 (!r.status || r.status !== 'completed' || data.offeredByRideId === r.id || (r.requestedByPassengerIds || []).includes(data.id)) &&
                 isValidGeographicProxy(data, r)
             );
             
             let matchesFound = 0;
             if (data.from?.lat && data.to?.lat) {
                 matchesFound = eligibleOffers.length;
             }

             // Compute Active Pass-through: If the driver has actively started the ride, mirror the in_progress status locally to the passenger
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

        setRides(mergedRides);
        setLoading(false);
    };

    setLoading(true);

    const offersUnsub = onSnapshot(collection(db, 'rideOffers'), snap => {
        allOffers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        offersReady = true;
        processRides();
    }, (err) => {
        console.error("Realtime Offers Error: ", err);
    });

    const requestsUnsub = onSnapshot(collection(db, 'rideRequests'), snap => {
        allReqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        reqsReady = true;
        processRides();
    }, (err) => {
        console.error("Realtime Reqs Error: ", err);
    });

    return () => {
        offersUnsub();
        requestsUnsub();
    };
  }, [currentUser, navigate]);

  // Format timestamp helper
  const getRideTimeOnly = (ride) => {
    if (ride.time) {
       return `at ${dayjs(ride.time).format('h:mm A')}`;
    }
    return '';
  };

  const filteredRides = rides.filter(ride => {
     const status = ride.computedStatus || ride.status || 'open';
     if (activeTab === 'Pending') return !['in_progress', 'completed', 'cancelled'].includes(status);
     if (activeTab === 'Active') return status === 'in_progress';
     if (activeTab === 'History') return ['completed', 'cancelled'].includes(status);
     return false;
  });

  const groupedRides = [];
  filteredRides.forEach(ride => {
     const dateStr = ride.date ? dayjs(ride.date).format('ddd, MMM D, YYYY') : 'Unknown Date';
     let group = groupedRides.find(g => g.dateStr === dateStr);
     if (!group) {
        group = { dateStr, items: [] };
        groupedRides.push(group);
     }
     group.items.push(ride);
  });

  return (
    <div className="home-container" style={{ display: 'flex', flexDirection: 'column', background: '#eaeaea', height: '100vh', overflow: 'hidden' }}>
      
      {/* Dark Navbar */}
      <div style={{ background: 'rgba(40,45,50,0.9)', zIndex: 10, padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>My Rides</h2>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #ddd', zIndex: 5 }}>
        {['Active', 'Pending', 'History'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              flex: 1, 
              textAlign: 'center', 
              padding: '12px 0', 
              fontWeight: 600,
              fontSize: '0.95rem',
              color: activeTab === tab ? '#00b0f0' : '#888',
              borderBottom: activeTab === tab ? '3px solid #00b0f0' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* RIDES LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc', paddingBottom: '100px' }}>
      {loading ? (
        <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <Loader2 size={40} color="#999" style={{ animation: 'spin 1.2s linear infinite' }} />
          <h3 style={{ color: '#888', margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Loading your rides...</h3>
        </div>
      ) : groupedRides.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#888' }}>
            <div style={{ background: '#eee', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
               <MapPin size={32} color="#aaa" />
            </div>
            <h3 style={{ color: '#555', margin: '0 0 8px 0' }}>No {activeTab.toLowerCase()} rides</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>You don't have any {activeTab.toLowerCase()} rides at the moment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingBottom: '2rem' }}>
            {groupedRides.map(group => (
              <div key={group.dateStr} style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', color: '#999', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span style={{ whiteSpace: 'nowrap', color: '#aaa' }}>{group.dateStr}</span>
                  <div style={{ height: '1px', background: '#e0e0e0', flex: 1 }}></div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   {group.items.map(ride => {
                     const isDriver = ride.collectionType === 'offer';
                     const activeColor = '#00b0f0';
                     let badgeText = isDriver ? 'Offer Ride' : 'Find Ride';
                     if (activeTab !== 'History') {
                        if (ride.status === 'cancelled') {
                           badgeText = `${badgeText} (Cancelled)`;
                        } else if (ride.status === 'completed') {
                           badgeText = `${badgeText} (Completed)`;
                        }
                     }
                     
                     let ribbonLeftColor = isDriver ? '#1fd954' : '#00b0f0';
                     let ribbonRightColor = isDriver ? '#16b944' : '#0090c0';

                     if (activeTab === 'History') {
                        if (ride.status === 'cancelled') {
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
                           ribbonLeftColor = '#1fd954'; // Green
                           ribbonRightColor = '#16b944';
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
                             if ((effStatus === 'confirmed' || effStatus === 'in_progress') && activeTab !== 'History') {
                               navigate('/passenger-tracking', { state: { ride, fromTab: activeTab } });
                             } else {
                               navigate('/find-matches', { state: { ride, fromTab: activeTab } });
                             }
                           }
                         }}
                         style={{ 
                           background: '#fff', 
                           borderRadius: '8px', 
                           boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                           display: 'flex',
                           flexDirection: 'column',
                           cursor: 'pointer',
                           position: 'relative'
                         }}
                       >
                         {/* SECTION 1: HEADER & ROUTE */}
                         <div style={{ position: 'relative', padding: '16px 20px 24px 20px' }}>
                            
                            {/* TOP ROW: BADGE & MORE ICON */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                               
                               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  {/* LEFT BADGE: Ribbon */}
                                  <div style={{ display: 'flex', marginLeft: '-24px', marginTop: '-4px' }}>
                                     <div style={{ background: ribbonLeftColor, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '2px 2px 8px rgba(0,0,0,0.1)', transition: 'background 0.3s' }}>
                                        {isDriver ? <Car size={16} color="#fff" /> : <Search size={16} color="#fff" strokeWidth={2.5} />}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{badgeText}</span>
                                     </div>
                                     <div style={{ background: ribbonRightColor, padding: '6px 12px', display: 'flex', alignItems: 'center', borderTopRightRadius: '4px', borderBottomRightRadius: '4px', boxShadow: '2px 2px 8px rgba(0,0,0,0.1)', transition: 'background 0.3s' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{getRideTimeOnly(ride).replace('at ', '')}</span>
                                     </div>
                                  </div>
                                  
                                  {/* SEAT INDICATOR */}
                                  <div style={{ display: 'flex', gap: '0px', marginTop: '-4px', flexShrink: 0 }}>
                                    {Array.from({ length: ride.seats || 1 }).map((_, i) => {
                                       const fillStatus = isDriver ? i < (ride.seatsTaken || 0) : true;
                                       return (
                                          <User key={i} size={18} color={fillStatus ? ribbonLeftColor : '#e0e0e0'} fill={fillStatus ? ribbonLeftColor : '#e0e0e0'} transition="fill 0.3s, color 0.3s" />
                                       );
                                    })}
                                  </div>
                               </div>

                               {/* RIGHT EDIT ICON */}
                               {activeTab !== 'History' && (
                                  <div onClick={e => e.stopPropagation()}>
                                    <Edit size={20} color="#ccc" />
                                  </div>
                               )}
                            </div>
                            
                            {/* LOCATIONS WITH DOT CONNECTOR */}
                            <div style={{ display: 'flex', gap: '16px', position: 'relative', alignItems: 'stretch' }}>
                               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '6px', paddingBottom: '6px' }}>
                                  <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: 'transparent', border: '2px solid #888', zIndex: 2 }}></div>
                                  <div style={{ width: 1, flex: 1, background: '#555', margin: '4px 0' }}></div>
                                  <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: '#888', zIndex: 2 }}></div>
                               </div>
                               
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '0.9rem', color: '#111', fontWeight: 600, lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ride.from?.address || 'Unknown origin'}
                                  </span>
                                  
                                  <span style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ride.to?.address || 'Unknown destination'}
                                  </span>
                               </div>
                            </div>
                         </div>
      
                         {/* SECTION 2: PASSENGERS / DRIVER RECORD LIST */}
                         {ride.passengers && ride.passengers.filter(p => activeTab !== 'History' || ['Completed', 'Confirmed'].includes(p.pStatus)).length > 0 && (
                           <>
                             <div style={{ width: '100%', height: '0px', borderBottom: '2px dashed #ececec' }}></div>
                             <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8f8f8' }}>
                               {ride.passengers.filter(p => activeTab !== 'History' || ['Completed', 'Confirmed'].includes(p.pStatus)).map((p, idx) => (
                                 <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                                    
                                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#eaeaea', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                       {p.userProfilePic ? <img src={p.userProfilePic} alt="P" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="#999" />}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                       <span style={{ fontSize: '1rem', fontWeight: 600, color: '#222', lineHeight: '1.2' }}>
                                          {p.userName || 'Passenger'}
                                       </span>
                                       
                                       {(p.pStatus === 'Confirmed' || p.pStatus === 'Completed') && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                             {activeTab !== 'History' && (
                                                <div style={{ background: '#1fd954', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                   <Check size={10} color="#fff" strokeWidth={4} />
                                                </div>
                                             )}
                                             <span style={{ fontSize: '0.9rem', fontWeight: 600, color: activeTab === 'History' ? '#9cc93a' : '#1fd954' }}>{p.pStatus}</span>
                                          </div>
                                       )}
                                       
                                       {p.pStatus === 'Request' && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                             <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ff0043' }}>Accept Request</span>
                                          </div>
                                       )}
                                       {p.pStatus === 'Accept Offer' && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                             <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ff0043' }}>Accept Offer</span>
                                          </div>
                                       )}
                                       
                                       {p.pStatus === 'Offered' && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                             <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#eab308' }}>Ride Offered</span>
                                          </div>
                                       )}

                                       {p.pStatus === 'Sent Request' && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                             <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#eab308' }}>Sent Request</span>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                               ))}
                             </div>
                           </>
                         )}
      
                         {/* SECTION 3: MATCHES COUNT / HISTORY STAMP */}
                         {activeTab !== 'History' ? (
                           <>
                             <div style={{ width: '100%', height: '0px', borderBottom: '1.5px dashed #ececec' }}></div>
                             <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <User size={28} color="#00b0f0" fill="#00b0f0" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                   <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#00b0f0', letterSpacing: '-0.3px', marginBottom: '2px' }}>
                                      {ride.matchesCount || 0} Ride Match{(ride.matchesCount || 0) > 1 ? 'es' : ''}
                                   </span>
                                   <span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 500 }}>
                                      available on your route
                                   </span>
                                </div>
                             </div>
                           </>
                         ) : (
                           <>
                             <div style={{ width: '100%', height: '0px', borderBottom: '1.5px dashed #ececec' }}></div>
                             <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ride.status === 'cancelled' ? '#f9f9f9' : '#fff', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <span style={{ fontSize: '0.9rem', fontWeight: 700, color: ride.status === 'cancelled' ? '#888' : '#9cc93a', letterSpacing: '0.5px' }}>
                                      {ride.status === 'cancelled' ? 'Ride Cancelled' : 'Ride Completed'}
                                   </span>
                                </div>
                             </div>
                           </>
                         )}
                       </div>

                     );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}
