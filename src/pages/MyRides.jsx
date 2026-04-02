import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, User, Car, Search, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import dayjs from 'dayjs';

export default function MyRides() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchRides = async () => {
      try {
        setLoading(true);
        // Query both collections concurrently!
        const offersRef = collection(db, 'rideOffers');
        const requestsRef = collection(db, 'rideRequests');

        const qOffers = query(offersRef, where('userId', '==', currentUser.uid));
        const qRequests = query(requestsRef, where('userId', '==', currentUser.uid));

        const [offersSnap, requestsSnap] = await Promise.all([
          getDocs(qOffers),
          getDocs(qRequests)
        ]);

        const rawOffers = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), collectionType: 'offer' }));
        const rawRequests = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), collectionType: 'request' }));

        // Merge arrays and sort by createdAt remotely
        const mergedRides = [...rawOffers, ...rawRequests].sort((a, b) => {
           const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return timeB - timeA; // Descending (newest first)
        });

        // Group by Date immediately
        const groupedRides = [];
        mergedRides.forEach(ride => {
           const dateStr = ride.date ? dayjs(ride.date).format('ddd, MMM D, YYYY') : 'Unknown Date';
           let group = groupedRides.find(g => g.dateStr === dateStr);
           if (!group) {
              group = { dateStr, items: [] };
              groupedRides.push(group);
           }
           group.items.push(ride);
        });

        setRides(groupedRides);
      } catch (err) {
        console.error("Error fetching rides:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [currentUser, navigate]);

  // Format timestamp helper
  const getRideTimeOnly = (ride) => {
    if (ride.time) {
       return `at ${dayjs(ride.time).format('h:mm A')}`;
    }
    return '';
  };

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

      {/* RIDES LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '2rem', color: '#888' }}>
            <p>Loading your rides...</p>
          </div>
        ) : rides.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#888' }}>
            <div style={{ background: '#eee', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
               <MapPin size={32} color="#aaa" />
            </div>
            <h3 style={{ color: '#555', margin: '0 0 8px 0' }}>No active rides</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>You haven't offered or requested any rides yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingBottom: '2rem' }}>
            {rides.map(group => (
              <div key={group.dateStr} style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', color: '#999', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span style={{ whiteSpace: 'nowrap', color: '#aaa' }}>{group.dateStr}</span>
                  <div style={{ height: '1px', background: '#e0e0e0', flex: 1 }}></div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {group.items.map(ride => {
                     const isDriver = ride.type === 'driver';
                     const activeColor = '#00b0f0';
                     const badgeText = isDriver ? 'Offering a ride' : 'Looking for a ride';
                     
                     return (
                       <div 
                         key={ride.id}
                         onClick={() => isDriver ? navigate('/offer-matches', { state: { ride } }) : navigate('/find-matches', { state: { ride } })}
                         style={{ 
                           background: '#fff', 
                           borderRadius: '8px', 
                           boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                           overflow: 'hidden',
                           display: 'flex',
                           flexDirection: 'column',
                           cursor: 'pointer'
                         }}
                       >
                         {/* CARD HEADER */}
                         <div style={{ background: '#fff', padding: '16px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none' }}>
                           <div style={{ background: activeColor, borderRadius: '20px', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             {isDriver ? <Car size={18} color="#fff" /> : <Search size={18} color="#fff" strokeWidth={2.5} />}
                             <span style={{ fontSize: '1rem', fontWeight: 500, color: '#fff' }}>
                               {badgeText}
                             </span>
                           </div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#888', fontSize: '0.85rem', fontWeight: 500 }}>
                             <span>{getRideTimeOnly(ride)}</span>
                           </div>
                         </div>
      
                         {/* CARD BODY (ADDRESSES) */}
                         <div style={{ padding: '8px 16px 16px 16px', position: 'relative' }}>
                           <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${activeColor}`, background: '#fff', zIndex: 2 }}></div>
                                <div style={{ width: 1, height: '24px', background: '#ddd', margin: '4px 0' }}></div>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeColor, zIndex: 2 }}></div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, paddingTop: '0px', minWidth: 0 }}>
                                <div>
                                  <h4 style={{ margin: '0', fontSize: '1rem', color: '#222', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ride.from?.address || 'Unknown origin'}
                                  </h4>
                                </div>
                                <div>
                                  <h4 style={{ margin: '0', fontSize: '1rem', color: '#222', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ride.to?.address || 'Unknown destination'}
                                  </h4>
                                </div>
                              </div>
                           </div>
                         </div>
      
                         {/* CARD FOOTER INFO */}
                         <div style={{ padding: '12px 16px', borderTop: '1px dashed #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfdfd' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                               {isDriver ? (
                                  Array.from({ length: ride.seats || 1 }).map((_, i) => (
                                     <User key={i} size={18} color={i < (ride.seatsTaken || 0) ? activeColor : '#d1d5db'} fill={i < (ride.seatsTaken || 0) ? activeColor : '#d1d5db'} />
                                  ))
                               ) : (
                                  Array.from({ length: ride.seats || 1 }).map((_, i) => (
                                     <User key={i} size={18} color={activeColor} fill={activeColor} />
                                  ))
                               )}
                            </div>
                            
                            <button style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '0px', display: 'flex' }}>
                              <MoreHorizontal size={24} />
                            </button>
                         </div>
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
