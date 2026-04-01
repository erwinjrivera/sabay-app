import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, User, CheckCircle2, Car, Search } from 'lucide-react';
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

        setRides(mergedRides);
      } catch (err) {
        console.error("Error fetching rides:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [currentUser, navigate]);

  // Format timestamp helper
  const getRideTime = (ride) => {
    if (ride.date && ride.time) {
       // Reconstruct ISO strings if available
       const rideDate = dayjs(ride.date).format('MMM D, YYYY');
       const rideTime = dayjs(ride.time).format('h:mm A');
       return `${rideDate} at ${rideTime}`;
    }
    return 'Time not specified';
  };

  return (
    <div className="home-container" style={{ display: 'flex', flexDirection: 'column', background: '#fff', height: '100vh', overflow: 'hidden' }}>
      
      {/* HEADER TABS EXTENDED */}
      <div style={{ background: '#fff', zIndex: 10, padding: '20px 20px 10px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={24} color="#333" />
          </button>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#111' }}>My Rides</h1>
        </div>
      </div>

      {/* RIDES LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
            {rides.map(ride => {
               // Determine card styling based on Driver (Offer) vs Passenger (Request)
               const isDriver = ride.type === 'driver';
               const activeColor = '#00b0f0'; // All cards map exactly to Sabay Blue themes
               const badgeText = isDriver ? 'Offering a ride' : 'Looking for a ride';
               
               return (
                 <div 
                   key={ride.id}
                   style={{ 
                     background: '#fff', 
                     borderRadius: '16px', 
                     boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                     overflow: 'hidden',
                     border: `1px solid #f0f0f0`,
                     display: 'flex',
                     flexDirection: 'column'
                   }}
                 >
                   {/* CARD HEADER */}
                   <div style={{ background: activeColor, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       {isDriver ? <Car size={18} color="#fff" /> : <Search size={18} color="#fff" strokeWidth={2.5} />}
                       <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', letterSpacing: '0.5px' }}>
                         {badgeText}
                       </span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
                       <Clock size={16} color="#fff" />
                       <span>{getRideTime(ride)}</span>
                     </div>
                   </div>

                   {/* CARD BODY (ADDRESSES) */}
                   <div style={{ padding: '16px', position: 'relative' }}>
                     
                     <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        
                        {/* Connecting Line Vector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${activeColor}`, background: '#fff', zIndex: 2 }}></div>
                          <div style={{ width: 2, height: '36px', background: '#eee', margin: '2px 0' }}></div>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeColor, zIndex: 2 }}></div>
                        </div>

                        {/* Location Strings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, paddingTop: '2px' }}>
                          <div>
                            <h4 style={{ margin: '0', fontSize: '1rem', color: '#222', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75vw' }}>
                              {ride.from?.address || 'Unknown origin'}
                            </h4>
                          </div>
                          <div>
                            <h4 style={{ margin: '0', fontSize: '1rem', color: '#222', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75vw' }}>
                              {ride.to?.address || 'Unknown destination'}
                            </h4>
                          </div>
                        </div>
                     </div>
                   </div>

                   {/* CARD FOOTER INFO */}
                   <div style={{ padding: '12px 16px', borderTop: '1px dashed #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                         <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <span style={{ fontSize: '0.7rem', color: '#888' }}>SEATS</span>
                           <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 600 }}>{ride.seats}</span>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <span style={{ fontSize: '0.7rem', color: '#888' }}>STATUS</span>
                           <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 600, textTransform: 'capitalize' }}>{ride.status || 'Open'}</span>
                         </div>
                      </div>
                      
                      <button style={{ background: 'transparent', border: 'none', color: activeColor, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}>
                        View Details
                      </button>
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
      
    </div>
  );
}
