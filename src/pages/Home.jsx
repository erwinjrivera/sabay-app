import React, { useState, useEffect } from 'react';
import { Menu, Search, Car, List } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MapBackground from '../components/MapBackground';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { currentUser, logout } = useAuth();
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
    }
  }, [currentUser, navigate]);

  const handleProfileClick = () => {
    if (currentUser) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-container">
      <MapBackground />
      {/* VIBRANT AMBIENT BENTO FROST OVERLAY */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, background: 'rgba(240, 247, 255, 0.65)', backdropFilter: 'blur(20px)' }}></div>

      {/* TOP NAVBAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', zIndex: 100, background: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
               <Menu size={20} color="#1e293b" />
            </button>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>Sabay</h1>
         </div>
         
         <button className="profile-btn" onClick={handleProfileClick} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', overflow: 'hidden', padding: 0 }}>
          {currentUser && currentUser.photoURL && !imgError ? (
            <img 
               src={currentUser.photoURL} 
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
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-1.5px', margin: 0 }}>Sabay</h1>
            <p style={{ fontSize: '1.05rem', color: '#64748b', fontWeight: 600, margin: '4px 0 0 0' }}>Where are we going today?</p>
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

            {/* OFFER RIDE (Secondary Tile) */}
            <div 
               onClick={() => navigate('/offer')}
               style={{ background: '#fff', borderRadius: '32px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.05)', border: '1px solid #f1f5f9', transition: 'transform 0.15s' }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
               <div style={{ background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={22} color="#0f172a" strokeWidth={2.5} />
               </div>
               <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.3px' }}>Offer <br/> Ride</h3>
               </div>
            </div>
         </div>

         {/* GRID ROW 2: Activity Log Widget */}
         <div 
            onClick={() => navigate('/my-rides')}
            style={{ background: '#1e293b', borderRadius: '32px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 12px 32px rgba(30, 41, 59, 0.25)', transition: 'transform 0.15s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
         >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ background: 'rgba(255,255,255,0.1)', width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <List size={22} color="#fff" />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>Activity Log</span>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Track your matches</span>
               </div>
            </div>
            <div style={{ background: '#334155', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <span style={{ fontSize: '1.2rem', color: '#fff' }}>›</span>
            </div>
         </div>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
