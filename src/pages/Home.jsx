import React, { useState, useEffect } from 'react';
import { Menu, Search, Car } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MapBackground from '../components/MapBackground';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const handleProfileClick = () => {
    if (currentUser) {
      if (window.confirm("Do you want to sign out?")) {
        logout();
      }
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-container">
      <MapBackground />

      <div className="top-bar">
        <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} color="#555" />
        </button>
        <button className="profile-btn" onClick={handleProfileClick}>
          {currentUser && currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="Profile" className="profile-img" />
          ) : (
            <span style={{fontWeight: 'bold', fontSize: '1.2rem'}}>
              {currentUser ? currentUser.email[0].toUpperCase() : '?'}
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

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
