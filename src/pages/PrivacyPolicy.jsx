import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ background: '#3c3f4a', padding: '16px 20px', display: 'flex', alignItems: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 10 }}>
         <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginRight: '16px' }}>
            <ArrowLeft size={24} color="#fff" />
         </button>
         <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Privacy Policy</span>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '24px', color: '#334155', lineHeight: '1.6', fontSize: '0.95rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '16px' }}>Privacy Policy</h1>
        
        <p style={{ marginBottom: '16px' }}>
          At Karsabay, we take your privacy extremely seriously. This Privacy Policy outlines precisely how we collect, map, and secure your personal data in compliance with the Philippine Data Privacy Act of 2012 (DPA).
        </p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>1. Information We Collect</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
          <li style={{ marginBottom: '8px' }}><strong>Profile Data:</strong> Names, email addresses, phone numbers, and vehicle details provided strictly voluntarily during Profile setup.</li>
          <li style={{ marginBottom: '8px' }}><strong>Location Data:</strong> To facilitate carpooling matches locally, we temporarily process GPS location data when the app is actively used to map Origins and Destinations.</li>
          <li style={{ marginBottom: '8px' }}><strong>Authentication:</strong> Secure UID tracking through Google Firebase Authentication mechanisms.</li>
        </ul>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>2. How We Use the Data</h2>
        <p style={{ marginBottom: '16px' }}>Data is strictly deployed to operate the non-profit cost-sharing ecosystem. Phone numbers and structural vehicle identities are shared exclusively with explicitly matched users to facilitate safe meetups and pickups natively within the network.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>3. Data Security</h2>
        <p style={{ marginBottom: '16px' }}>All identity logic is encrypted and handled remotely via enterprise-grade Google Firebase infrastructure. We do not sell your personal attributes to third-party marketing firms.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>4. Your Rights</h2>
        <p style={{ marginBottom: '16px' }}>You retain the absolute right to correct, update, or completely purge your settings locally from the interface or by directly deleting your Firebase Auth profile.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>5. Policy Updates</h2>
        <p style={{ marginBottom: '32px' }}>Karsabay reserves the right to modify this structural privacy document to aggressively ensure compliance with regulatory data policies continuously.</p>
      </div>

    </div>
  );
}
