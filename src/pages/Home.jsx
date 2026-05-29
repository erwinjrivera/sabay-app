import React, { useState, useEffect } from 'react';
import { Menu, Search, Car, List, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MapBackground from '../components/MapBackground';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { requestNotificationPermission } from '../utils/notifications';

export default function Home() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [vehiclePrompt, setVehiclePrompt] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const { currentUser, userPhotoURL, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const getInitials = (nameStr) => {
    if (!nameStr) return '';
    const parts = nameStr.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else {
      // Request notifications permission gracefully when user lands on home
      requestNotificationPermission();
    }
  }, [currentUser, navigate]);

  const handleProfileClick = () => {
    if (currentUser) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  // Reusable vehicle details validation check
  const checkVehicleDetails = async () => {
    if (!currentUser) return false;
    try {
      const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (!docSnap.exists()) {
        setMissingFields(['Make', 'Model', 'Color', 'Plate Number']);
        return false;
      }
      const data = docSnap.data();
      const missing = [];
      if (!data.carMake || data.carMake.trim() === '') missing.push('Make');
      if (!data.carModel || data.carModel.trim() === '') missing.push('Model');
      if (!data.carColor || data.carColor.trim() === '') missing.push('Color');
      if (!data.plateNumber || data.plateNumber.trim() === '') missing.push('Plate Number');
      
      if (missing.length > 0) {
        setMissingFields(missing);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error checking vehicle details:', err);
      return true; // Allow on error to not block the user
    }
  };

  const handleOfferRide = async () => {
    const isComplete = await checkVehicleDetails();
    if (isComplete) {
      navigate('/offer');
    } else {
      setVehiclePrompt(true);
    }
  };

  return (
    <div className="home-container">
      <MapBackground theme="dark" />
      {/* VIBRANT AMBIENT BENTO FROST OVERLAY (Maximum Transparency) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, background: 'rgba(15, 23, 42, 0.1)' }}></div>

      {/* TOP NAVBAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(16px + env(safe-area-inset-top)) 20px 16px 20px', zIndex: 100, background: 'linear-gradient(to bottom, rgba(15,23,42,0.8), rgba(15,23,42,0))' }}>
         <div style={{ width: 44 }}>
            {isAdmin && (
               <button onClick={() => setSidebarOpen(true)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <Menu size={28} />
               </button>
            )}
         </div>
         <button className="profile-btn" onClick={handleProfileClick} style={{ background: '#1e293b', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer', overflow: 'hidden', padding: 0 }}>
          {currentUser && (userPhotoURL || currentUser.photoURL) && !imgError ? (
            <img 
               src={userPhotoURL || currentUser.photoURL} 
               alt="Profile" 
               style={{ width: '100%', height: '100%', objectFit: 'cover' }}
               referrerPolicy="no-referrer"
               onError={() => setImgError(true)}
            />
          ) : (
            <span style={{fontWeight: 'bold', fontSize: '1.1rem', color: '#94a3b8'}}>
              {getInitials(currentUser?.displayName) || (currentUser ? currentUser.email[0].toUpperCase() : '?')}
            </span>
          )}
        </button>
      </div>

      {/* BENTO BOX GRID */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 10 }}>
         
         <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-1.5px', margin: 0 }}>Sabay</h1>
            <p style={{ fontSize: '1.05rem', color: '#94a3b8', fontWeight: 600, margin: '4px 0 0 0' }}>Saan ka? Tara Sabay!</p>
         </div>

         {/* GRID ROW 1: Find & Offer */}
         <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', height: '160px' }}>
            
            {/* FIND RIDE (Large Hero Tile) */}
            <div 
               onClick={() => navigate('/find')}
               style={{ background: '#0ea5e9', borderRadius: '32px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 12px 32px rgba(14, 165, 233, 0.3)', transition: 'transform 0.15s' }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
               <div style={{ background: 'rgba(255,255,255,0.25)', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                  <Search size={22} color="#fff" strokeWidth={3} />
               </div>
               <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.5px' }}>Find <br/> a Ride</h3>
               </div>
            </div>

            {/* OFFER RIDE (Secondary Tile) — with vehicle check */}
            <div 
               onClick={handleOfferRide}
               style={{ background: '#1e293b', borderRadius: '32px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 12px 32px rgba(30, 41, 59, 0.25)', transition: 'transform 0.15s' }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
               <div style={{ background: 'rgba(255,255,255,0.1)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={22} color="#fff" strokeWidth={2.5} />
               </div>
               <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.3px' }}>Offer <br/> Ride</h3>
               </div>
            </div>
         </div>

         {/* GRID ROW 2: Activity Log Widget */}
         <div 
            onClick={() => navigate('/my-rides')}
            style={{ background: '#1e293b', borderRadius: '32px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)', border: '1px solid #334155', transition: 'transform 0.15s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
         >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ background: '#0f172a', width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <List size={22} color="#e2e8f0" />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.2px' }}>My Rides</span>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Track your matches</span>
               </div>
            </div>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>›</span>
            </div>
         </div>
      </div>

      <div style={{ position: 'absolute', bottom: '24px', left: 0, width: '100%', textAlign: 'center', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '0.80rem', color: '#94a3b8' }}>
          By using Sabay, you agree to our 
        </span>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
           <button onClick={() => navigate('/terms-of-use')} style={{ background: 'transparent', border: 'none', color: '#0ea5e9', fontWeight: 600, fontSize: '0.80rem', cursor: 'pointer', padding: 0 }}>Terms of Use</button>
           <span style={{ color: '#475569', fontSize: '0.80rem' }}>|</span>
           <button onClick={() => navigate('/privacy-policy')} style={{ background: 'transparent', border: 'none', color: '#0ea5e9', fontWeight: 600, fontSize: '0.80rem', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
        </div>
        <span style={{ fontSize: '0.70rem', color: '#475569', marginTop: '2px', letterSpacing: '0.5px' }}>
          v{__APP_VERSION__}-{__GIT_HASH__} (build {__BUILD_NUMBER__})
        </span>
      </div>

      {/* VEHICLE DETAILS INCOMPLETE MODAL */}
      {vehiclePrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: '360px', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative' }}>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>

            {/* X Close Button */}
            <button
              onClick={() => setVehiclePrompt(false)}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color="#94a3b8" strokeWidth={2.5} />
            </button>

            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Car size={24} strokeWidth={2.5} />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>Vehicle Details Needed</h3>

            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Before offering a ride, please complete your vehicle information so passengers know what to look for.
            </p>


            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => setVehiclePrompt(false)}
                style={{ width: '100%', padding: '14px', background: '#334155', border: 'none', borderRadius: '8px', color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Later
              </button>
              <button 
                onClick={() => { setVehiclePrompt(false); navigate('/profile'); }}
                style={{ width: '100%', padding: '14px', background: '#0ea5e9', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Complete Profile
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
