import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfUse() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ background: '#3c3f4a', padding: '16px 20px', display: 'flex', alignItems: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 10 }}>
         <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginRight: '16px' }}>
            <ArrowLeft size={24} color="#fff" />
         </button>
         <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Terms of Use</span>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '24px', color: '#334155', lineHeight: '1.6', fontSize: '0.95rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '16px' }}>Sabay Terms of Use</h1>
        
        <p style={{ marginBottom: '16px' }}>
          Welcome to Sabay! By accessing or using our platform, you agree to comply with and be legally bound by these terms. If you do not agree, please refrain from using our services.
        </p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>1. Non-Profit Cost-Sharing & LTFRB Compliance</h2>
        <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', marginBottom: '16px' }}>
          <strong>Legal Restriction:</strong> Sabay operates strictly as a non-profit, cost-sharing network. Drivers are explicitly prohibited from generating commercial profit or operating as an unlicensed Public Utility Vehicle (PUV/Colorum). Any fees exchanged between passengers and drivers are strictly limited to the proportional sharing of immediate trip costs (e.g., fuel, toll fees), in accordance with local Philippine Land Transportation Franchising and Regulatory Board (LTFRB) regulations.
        </div>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>2. Eligibility</h2>
        <p style={{ marginBottom: '16px' }}>Users must be at least 18 years old. Drivers must hold a valid Philippine driver’s license and necessary vehicle permits.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>3. User Responsibilities</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
          <li style={{ marginBottom: '8px' }}><strong>Drivers:</strong> Ensure your vehicle is in safe condition, provide accurate trip details, strictly adhere to the cost-sharing protocol, and comply with all local traffic regulations.</li>
          <li style={{ marginBottom: '8px' }}><strong>Passengers:</strong> Be punctual, respect the driver’s rules, and contribute to the agreed cost-sharing fees promptly.</li>
          <li style={{ marginBottom: '8px' }}><strong>General:</strong> Treat all users with respect and avoid illegal or prohibited activities.</li>
        </ul>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>4. Safety and Conduct</h2>
        <p style={{ marginBottom: '16px' }}>While we utilize basic verification metrics natively, Sabay acts strictly as a peer-to-peer facilitator and does not guarantee absolute safety. Users are advised to take necessary precautions and report concerns.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>5. Limitation of Liability</h2>
        <p style={{ marginBottom: '16px' }}>Sabay acts as an informational platform connecting commuters. We are not responsible for disputes, accidents, or damages arising during rides.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>6. Termination</h2>
        <p style={{ marginBottom: '16px' }}>We fundamentally reserve the right to suspend or terminate accounts for violations of these terms, especially any actions constituting commercial transport/profit operation.</p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '24px', marginBottom: '8px' }}>7. Governing Law</h2>
        <p style={{ marginBottom: '32px' }}>These terms are governed by the laws of the Republic of the Philippines.</p>
      </div>

    </div>
  );
}
