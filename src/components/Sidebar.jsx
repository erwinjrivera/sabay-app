import React from 'react';
import { Home, Search, Car, ClipboardList, Settings, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose} />
      <div className="sidebar-content">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={onClose} style={{marginRight: 'auto', border:'none', background:'none'}}>
            <ChevronLeft size={24} color="#00b0f0"/>
          </button>
        </div>
        <div className="sidebar-nav">
          <div className="sidebar-item" onClick={() => { navigate('/'); onClose(); }}><Home size={20} color="#ff5a5f" /> Home</div>
          <div className="sidebar-item" onClick={() => { navigate('/find'); onClose(); }}><Search size={20} color="#00b0f0" /> Find a ride</div>
          <div className="sidebar-item" onClick={() => { navigate('/offer'); onClose(); }}><Car size={20} color="#ffb400" /> Offer a ride</div>
          <div className="sidebar-item" onClick={() => { navigate('/my-rides'); onClose(); }}><ClipboardList size={20} color="#9c27b0" /> My Rides</div>
        </div>
        <div className="sidebar-item settings"><Settings size={20} color="#555" /> Settings</div>
      </div>
    </>
  );
}
