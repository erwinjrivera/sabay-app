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

      <div className="top-bar">
        <button className="profile-btn" onClick={handleProfileClick} style={{ marginLeft: 'auto' }}>
          {currentUser && currentUser.photoURL && !imgError ? (
            <img 
               src={currentUser.photoURL} 
               alt="Profile" 
               className="profile-img" 
               referrerPolicy="no-referrer"
               onError={() => setImgError(true)}
            />
          ) : (
            <span style={{fontWeight: 'bold', fontSize: '1.2rem', color: '#fff'}}>
              {getInitials(currentUser?.displayName) || (currentUser ? currentUser.email[0].toUpperCase() : '?')}
            </span>
          )}
        </button>
      </div>

      <div className="title-card">
        <h1>Sabay</h1>
        <p>a free carpool sharing for every Juan</p>
      </div>

      <div className="action-buttons">
        <button className="action-btn" onClick={() => navigate('/find')}>
          Find a Ride
        </button>
        <button className="action-btn" onClick={() => navigate('/offer')}>
          Offer a Ride
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: '24px', left: 0, width: '100%', textAlign: 'center', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '0.80rem', color: '#64748b' }}>
          By using Sabay, you agree to our 
        </span>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
           <button onClick={() => navigate('/terms-of-use')} style={{ background: 'transparent', border: 'none', color: '#00b0f0', fontWeight: 600, fontSize: '0.80rem', cursor: 'pointer', padding: 0 }}>Terms of Use</button>
           <span style={{ color: '#cbd5e1', fontSize: '0.80rem' }}>|</span>
           <button onClick={() => navigate('/privacy-policy')} style={{ background: 'transparent', border: 'none', color: '#00b0f0', fontWeight: 600, fontSize: '0.80rem', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON - BOTTOM RIGHT */}
      <button 
        className="icon-btn" 
        onClick={() => navigate('/my-rides')}
        style={{ 
          position: 'absolute', bottom: '80px', right: '20px', zIndex: 20, 
          background: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          width: '48px', height: '48px'
        }}
      >
        <List size={22} color="#1e293b" />
      </button>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
