import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function NetworkWrapper({ children }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check in case it changed between load and effect
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    // Add a slight artificial delay for better UX feeling when checking
    setTimeout(() => {
      setIsOffline(!navigator.onLine);
      setIsRetrying(false);
    }, 600);
  };

  return (
    <>
      <div 
        style={{ 
          pointerEvents: isOffline ? 'none' : 'auto', 
          height: '100%', 
          width: '100%',
          filter: isOffline ? 'blur(4px)' : 'none',
          transition: 'filter 0.3s ease'
        }}
      >
        {children}
      </div>

      {isOffline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease'
        }}>
          <style>
            {`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}
          </style>
          
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: '#fee2e2', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '24px',
            animation: 'pulse 2s infinite ease-in-out'
          }}>
            <WifiOff size={40} color="#ef4444" strokeWidth={2} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>
            No Internet Connection
          </h2>
          
          <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '32px', maxWidth: '300px', lineHeight: 1.5 }}>
            Please check your network settings and make sure you're connected to Wi-Fi or mobile data.
          </p>

          <button
            onClick={handleRetry}
            disabled={isRetrying}
            style={{
              padding: '16px 32px',
              backgroundColor: '#00b0f0',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.05rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,176,240,0.3)',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: isRetrying ? 0.7 : 1
            }}
            onMouseDown={(e) => { if (!isRetrying) e.currentTarget.style.transform = 'scale(0.96)'; }}
            onMouseUp={(e) => { if (!isRetrying) e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { if (!isRetrying) e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <RefreshCw size={20} style={{ animation: isRetrying ? 'spin 1s linear infinite' : 'none' }} />
            {isRetrying ? 'Checking...' : 'Try Again'}
          </button>
        </div>
      )}
    </>
  );
}
