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

      {/* BOTTOM SHEET DRAWER */}
      <div style={{
          position: 'absolute',
          bottom: 0, left: 0, width: '100%',
          background: '#fff',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          padding: '24px 20px 32px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.08)',
          zIndex: 100,
          display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
         {/* Drag Handle Indicator */}
         <div style={{ width: '40px', height: '5px', background: '#e2e8f0', borderRadius: '4px', alignSelf: 'center', marginBottom: '4px', marginTop: '-14px' }} />

         {/* Prominent Search Input */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.3px' }}>
               Where are you going?
            </h2>
            <div 
               onClick={() => navigate('/find')}
               style={{ 
                  background: '#f1f5f9', display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: '16px', gap: '14px', cursor: 'pointer', transition: 'background 0.2s' 
               }}
            >
               <Search size={22} color="#00b0f0" strokeWidth={2.5} />
               <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: 600 }}>Enter destination...</span>
            </div>
         </div>

         {/* Quick Actions Grid */}
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div 
               onClick={() => navigate('/find')}
               style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'transform 0.1s' }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
               <div style={{ background: '#e0f2fe', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={24} color="#0284c7" />
               </div>
               <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>Find a Ride</span>
            </div>

            <div 
               onClick={() => navigate('/offer')}
               style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'transform 0.1s' }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
               <div style={{ background: '#0ea5e9', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)' }}>
                  <Car size={26} color="#fff" strokeWidth={2} />
               </div>
               <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>Offer a Ride</span>
            </div>
         </div>

         {/* My Rides Item */}
         <div 
            onClick={() => navigate('/my-rides')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: '#f8fafc', borderRadius: '16px', cursor: 'pointer', border: '1px solid #e2e8f0', marginTop: '4px' }}
         >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
               <List size={22} color="#0f172a" />
               <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>Activity & History</span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <span style={{ fontSize: '1.2rem', color: '#64748b' }}>›</span>
            </div>
         </div>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
