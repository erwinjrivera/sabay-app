import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Phone, FileText, Check, X, Loader2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import MapBackground from '../components/MapBackground';

export default function Onboarding() {
  const navigate = useNavigate();
  const { currentUser, profileReady, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [imgError, setImgError] = useState(false);

  // If already onboarded, redirect to home
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (profileReady) {
      navigate('/');
    }
  }, [currentUser, profileReady, navigate]);

  // Pre-fill from auth profile
  useEffect(() => {
    if (currentUser) {
      const name = currentUser.displayName || '';
      // Don't pre-fill auto-generated User_XXXXXXXX names
      if (name && !name.startsWith('User_')) {
        setDisplayName(name);
      }
    }
  }, [currentUser]);

  const getInitials = (nameStr) => {
    if (!nameStr) return '';
    const parts = nameStr.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  const handleSubmit = async () => {
    // Validations
    let errorMsg = '';
    if (!displayName || displayName.trim().length < 2) {
      errorMsg = 'Please enter your full name (at least 2 characters).';
    } else if (displayName.trim().length > 30) {
      errorMsg = 'Full name cannot exceed 30 characters.';
    } else if (!phoneNumber || phoneNumber.trim() === '') {
      errorMsg = 'Please enter your phone number so matched users can contact you.';
    } else if (!/^\+?[0-9]+$/.test(phoneNumber.trim())) {
      errorMsg = 'Phone number can only contain numbers and an optional "+" prefix.';
    } else if (phoneNumber.trim().length > 13) {
      errorMsg = 'Phone number cannot exceed 13 characters.';
    } else if (bio.trim().length > 150) {
      errorMsg = 'About me cannot exceed 150 characters.';
    }

    if (errorMsg) {
      setPrompt({ message: errorMsg, type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      // Update Firebase Auth displayName
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });

      // Save to Firestore users/{uid}
      await setDoc(doc(db, 'users', currentUser.uid), {
        fullName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        bio: bio.trim(),
        onboardingComplete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Notify AuthContext
      await refreshProfile();

      // Navigate to home
      navigate('/');
    } catch (err) {
      console.error('Onboarding save error:', err);
      setPrompt({ message: 'Failed to save profile. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  const hasGooglePhoto = currentUser.photoURL && !imgError;

  return (
    <div className="home-container" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <MapBackground />

      {/* Glass overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        zIndex: 1
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column',
        maxWidth: '420px', width: '100%', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box'
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingTop: 'calc(48px + env(safe-area-inset-top))', marginBottom: '32px' }}>
          <h1 style={{ color: '#00b0f0', fontWeight: 800, fontSize: '2rem', margin: '0 0 4px' }}>Welcome!</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>
            Let's set up your profile so others<br/>can recognize and contact you.
          </p>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%', background: '#f1f5f9',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
          }}>
            {hasGooglePhoto ? (
              <img
                src={currentUser.photoURL}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#00b0f0', color: '#fff', fontSize: '1.8rem', fontWeight: 700
              }}>
                {getInitials(displayName) || <User size={36} color="#fff" />}
              </div>
            )}
          </div>
        </div>

        {/* Email badge */}
        <div style={{
          textAlign: 'center', marginBottom: '28px',
          fontSize: '0.85rem', color: '#94a3b8'
        }}>
          Signed in as <span style={{ fontWeight: 600, color: '#64748b' }}>{currentUser.email}</span>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Full Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}>
                <User size={18} color="#94a3b8" />
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                maxLength={30}
                style={{
                  width: '100%', padding: '14px 14px 14px 44px', borderRadius: '12px',
                  border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
                  outline: 'none', background: '#fff', fontFamily: 'inherit',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
              Phone Number <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}>
                <Phone size={18} color="#94a3b8" />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +639123456789"
                maxLength={13}
                style={{
                  width: '100%', padding: '14px 14px 14px 44px', borderRadius: '12px',
                  border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
                  outline: 'none', background: '#fff', fontFamily: 'inherit',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4', marginTop: '2px' }}>
              Your phone number will be shared with matched users so they can contact you.
            </span>
          </div>

          {/* About Me (Optional) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
              <span>About Me <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></span>
              <span style={{ color: bio.length >= 150 ? '#ef4444' : '#94a3b8', fontSize: '0.75rem', fontWeight: 400 }}>{bio.length}/150</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A little bit about yourself (e.g., 'I love listening to jazz on my commute')"
              maxLength={150}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
                outline: 'none', background: '#fff', fontFamily: 'inherit',
                resize: 'none', minHeight: '80px', lineHeight: '1.5',
                boxSizing: 'border-box', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>

        {/* Submit */}
        <div style={{ marginTop: '32px', paddingBottom: 'calc(48px + env(safe-area-inset-bottom))' }}>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            style={{
              width: '100%', padding: '16px', background: '#00b0f0', color: '#fff',
              border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'background 0.3s, transform 0.1s'
            }}
            onMouseOver={(e) => { if (!isSaving) e.currentTarget.style.background = '#0099d1' }}
            onMouseOut={(e) => { if (!isSaving) e.currentTarget.style.background = '#00b0f0' }}
            onMouseDown={(e) => { if (!isSaving) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { if (!isSaving) e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isSaving ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1.2s linear infinite' }} />
                Setting up...
              </>
            ) : (
              <>
                Complete Setup
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error/Success Prompt Modal */}
      {prompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
          background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px', boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: '360px', borderRadius: '16px',
            padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center',
            animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>

            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: prompt.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: prompt.type === 'success' ? '#16a34a' : '#ff2744',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              {prompt.type === 'success' ? <Check size={24} strokeWidth={3} /> : <X size={24} strokeWidth={3} />}
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>
              {prompt.type === 'success' ? 'Success' : 'Oops'}
            </h3>

            <p style={{ margin: '0 0 24px', color: '#555', fontSize: '0.95rem', lineHeight: 1.4 }}>
              {prompt.message}
            </p>

            <button
              onClick={() => setPrompt(null)}
              style={{
                width: '100%', padding: '14px', background: '#f5f5f5', border: 'none',
                borderRadius: '8px', color: '#111', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
              }}
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
