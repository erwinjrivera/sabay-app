import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  LogOut,
  Save,
  Star,
  User,
  Phone,
  Users,
  Plus,
  Minus,
  Check,
  X
} from 'lucide-react';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  
  // React State mapping directly to the new Inspiration Data Schema
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carColor, setCarColor] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [seats, setSeats] = useState("3");
  const [isSaving, setIsSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [initialState, setInitialState] = useState({});

  const getInitials = (nameStr) => {
    if (!nameStr) return '';
    const parts = nameStr.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return nameStr.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const loadProfile = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setInitialState(data);
          
          if (data.fullName !== undefined) setFullName(data.fullName);
          else if (currentUser.displayName) setFullName(currentUser.displayName);
          
          if (data.phoneNumber !== undefined) setPhoneNumber(data.phoneNumber);
          if (data.bio !== undefined) setBio(data.bio);
          if (data.carMake !== undefined) setCarMake(data.carMake);
          if (data.carModel !== undefined) setCarModel(data.carModel);
          if (data.carColor !== undefined) setCarColor(data.carColor);
          if (data.plateNumber !== undefined) setPlateNumber(data.plateNumber);
          if (data.seats !== undefined) setSeats(data.seats);
        } else {
           // Fallback to auto-fill display name natively if fresh profile
           if (currentUser.displayName) setFullName(currentUser.displayName);
        }
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };
    loadProfile();
  }, [currentUser, navigate]);

  const triggerLogoutConfirm = () => {
    setPrompt({ message: "Are you sure you want to sign out of your account?", type: "confirmLogout" });
  };

  const executeLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Failed to log out", err);
      setPrompt({ message: "Failed to log out. Please try again.", type: "error" });
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    
    // VALIDATIONS
    let errorMsg = "";
    if (!fullName || fullName.trim() === "") errorMsg = "Full Name is required.";
    else if (fullName.trim().length > 30) errorMsg = "Full Name cannot exceed 30 characters.";
    else if (!phoneNumber || phoneNumber.trim() === "") errorMsg = "Phone Number is required.";
    else if (!/^\+?[0-9]+$/.test(phoneNumber)) errorMsg = "Phone Number can only contain numbers and a '+' sign.";
    else if (phoneNumber.trim().length > 13) errorMsg = "Phone Number cannot exceed 13 characters.";
    else if (bio.trim().length > 150) errorMsg = "About Me cannot exceed 150 characters.";
    else if (carMake.trim().length > 20) errorMsg = "Car Make cannot exceed 20 characters.";
    else if (carModel.trim().length > 30) errorMsg = "Car Model cannot exceed 30 characters.";
    else if (carColor.trim().length > 15) errorMsg = "Car Color cannot exceed 15 characters.";
    else if (plateNumber.trim().length > 10) errorMsg = "Plate Number cannot exceed 10 characters.";

    if (errorMsg) {
       setPrompt({ message: errorMsg, type: "error" });
       // Revert fields to initial database snapshot values safely
       setFullName(initialState.fullName !== undefined ? initialState.fullName : (currentUser.displayName || ""));
       setPhoneNumber(initialState.phoneNumber !== undefined ? initialState.phoneNumber : "");
       setBio(initialState.bio !== undefined ? initialState.bio : "");
       setCarMake(initialState.carMake !== undefined ? initialState.carMake : "");
       setCarModel(initialState.carModel !== undefined ? initialState.carModel : "");
       setCarColor(initialState.carColor !== undefined ? initialState.carColor : "");
       setPlateNumber(initialState.plateNumber !== undefined ? initialState.plateNumber : "");
       setSeats(initialState.seats !== undefined ? initialState.seats : "3");
       return;
    }

    setIsSaving(true);
    try {
      const payload = {
        fullName,
        phoneNumber,
        bio,
        carMake,
        carModel,
        carColor,
        plateNumber,
        seats,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', currentUser.uid), payload, { merge: true });
      setInitialState(payload); // Update reference snapshot point
      setPrompt({ message: "Profile successfully saved!", type: "success" });
    } catch (err) {
      console.error("Failed to save profile", err);
      setPrompt({ message: "Error saving profile. Please try again.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ background: '#3c3f4a', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
               <ArrowLeft size={24} color="#fff" />
            </button>
            <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Profile</span>
         </div>
         <div style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={triggerLogoutConfirm} style={{ background: 'rgba(255,255,255,0.2)', height: 32, width: 32, borderRadius: '8px', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s' }}>
               <LogOut size={16} color="#fff" />
            </button>
         </div>
      </div>

      {/* TOP USER RATING CARD (Retained for visual continuity of profile layout) */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '24px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', marginRight: '16px', overflow: 'hidden', flexShrink: 0 }}>
             {currentUser.photoURL && !imgError ? (
               <img 
                 src={currentUser.photoURL} 
                 alt="Avatar" 
                 style={{width: '100%', height: '100%', objectFit: 'cover'}} 
                 referrerPolicy="no-referrer"
                 onError={() => setImgError(true)}
               />
             ) : (
               <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '1.4rem', fontWeight: 700, color: '#94a3b8'}}>
                  {getInitials(fullName || currentUser.displayName) || <User color="#94a3b8" />}
               </div>
             )}
          </div>
         <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
               {fullName || currentUser.displayName || 'Gabriel Rivera'}
            </h2>
            <span style={{ fontSize: '0.90rem', color: '#64748b', marginBottom: '6px' }}>
               {currentUser.email}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
               {[1, 2, 3, 4, 5].map(starNum => {
                   const ratingVal = parseFloat(initialState.rating) || 0;
                   const isFilled = starNum <= Math.round(ratingVal);
                   return <Star key={starNum} size={14} fill={isFilled ? "#ffb800" : "#e2e8f0"} color={isFilled ? "#ffb800" : "#e2e8f0"} />;
               })}
               <span style={{ marginLeft: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{(parseFloat(initialState.rating) || 0).toFixed(1)}</span>
               <span style={{ marginLeft: '4px', fontSize: '0.85rem', color: '#94a3b8' }}>({initialState.completedRides || 0})</span>
            </div>
         </div>
      </div>

      {/* BODY INFO */}
      <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
         
         {/* PERSONAL DETAILS */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Full Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Full Name</label>
               <div className="input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}>
                     <User size={18} color="#94a3b8" />
                  </div>
                  <input 
                     type="text" 
                     value={fullName}
                     onChange={(e) => setFullName(e.target.value)}
                     placeholder=""
                     maxLength={30}
                     style={{
                        width: '100%', padding: '14px 14px 14px 44px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
                        outline: 'none', background: '#fff', fontFamily: 'inherit',
                        transition: 'border-color 0.2s'
                     }}
                     onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                     onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  />
               </div>
            </div>

            {/* Phone Number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Phone Number</label>
               <div className="input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}>
                     <Phone size={18} color="#94a3b8" />
                  </div>
                  <input 
                     type="tel" 
                     value={phoneNumber}
                     onChange={(e) => setPhoneNumber(e.target.value)}
                     placeholder=""
                     maxLength={13}
                     style={{
                        width: '100%', padding: '14px 14px 14px 44px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
                        outline: 'none', background: '#fff', fontFamily: 'inherit',
                        transition: 'border-color 0.2s'
                     }}
                     onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                     onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  />
               </div>
               <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', marginTop: '2px' }}>
                  Your phone number will be shared with matched users so they can contact you.
               </span>
            </div>

            {/* About Me */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>About Me (Optional)</label>
               <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A little bit about yourself (e.g., 'I love listening to jazz on my commute')"
                  maxLength={150}
                  style={{ 
                     width: '100%', padding: '14px', borderRadius: '10px',
                     border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
                     outline: 'none', background: '#fff', fontFamily: 'inherit',
                     resize: 'none', minHeight: '100px', lineHeight: '1.5',
                     transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
               />
            </div>

         </div>

         {/* VISUAL SEPARATOR */}
         <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

         {/* CAR DETAILS SECTION */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Car Details (Optional)</h3>
               <span style={{ fontSize: '0.80rem', color: '#64748b', lineHeight: '1.4' }}>
                  Add your vehicle details so passengers know what to look for when joining your ride.
               </span>
            </div>

            <LightInput label="Make (e.g. Toyota, Honda)" placeholder="Enter car make" value={carMake} onChange={setCarMake} maxLength={20} />
            <LightInput label="Model (e.g. Camry, Civic)" placeholder="Enter car model" value={carModel} onChange={setCarModel} maxLength={30} />
            
            <div style={{ display: 'flex', gap: '16px' }}>
               <div style={{ flex: 1 }}>
                  <LightInput label="Color" placeholder="e.g. Silver" value={carColor} onChange={setCarColor} maxLength={15} />
               </div>
               <div style={{ flex: 1 }}>
                  <LightInput label="Plate Number" placeholder="E.G. ABC 1234" value={plateNumber} onChange={setPlateNumber} maxLength={10} />
               </div>
            </div>

            {/* Retained Passengers Counter adapted to Light Theme block styling */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', marginTop: '4px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users size={18} color="#94a3b8" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Passengers</span>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                     onClick={() => setSeats(Math.max(1, (parseInt(seats) || 3) - 1).toString())}
                     disabled={(parseInt(seats) || 3) <= 1}
                     style={{ 
                        width: 32, height: 32, borderRadius: '6px', 
                        background: (parseInt(seats) || 3) <= 1 ? '#e2e8f0' : '#cbd5e1', 
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: (parseInt(seats) || 3) <= 1 ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s'
                     }}>
                     <Minus size={16} color={(parseInt(seats) || 3) <= 1 ? '#fff' : '#475569'} />
                  </button>
                  
                  <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#1e293b', width: '20px', textAlign: 'center' }}>
                     {parseInt(seats) || 3}
                  </span>
                  
                  <button 
                     onClick={() => setSeats((Math.min(4, (parseInt(seats) || 3) + 1)).toString())}
                     style={{ 
                        width: 32, height: 32, borderRadius: '6px', 
                        background: '#334155', border: 'none', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transition: 'background 0.2s'
                     }}
                     onMouseOver={(e) => e.currentTarget.style.background = '#0f172a'}
                     onMouseOut={(e) => e.currentTarget.style.background = '#334155'}
                  >
                     <Plus size={16} color="#fff" />
                  </button>
               </div>
            </div>

         </div>

         {/* BOTTOM SAVE ACTION */}
         <div style={{ marginTop: '16px' }}>
             <button 
               onClick={handleSave}
               disabled={isSaving}
               style={{
                  width: '100%',
                  padding: '16px',
                  background: '#00b0f0',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(0,176,240,0.2)',
                  transition: 'background 0.3s, transform 0.1s'
               }}
               onMouseOver={(e) => { if(!isSaving) e.currentTarget.style.background = '#0099d1' }}
               onMouseOut={(e) => { if(!isSaving) e.currentTarget.style.background = '#00b0f0' }}
               onMouseDown={(e) => { if(!isSaving) e.currentTarget.style.transform = 'scale(0.98)' }}
               onMouseUp={(e) => { if(!isSaving) e.currentTarget.style.transform = 'scale(1)' }}
             >
                {isSaving ? "Saving details..." : "Save Profile"}
             </button>
         </div>

      </div>

      {/* CUSTOM PROMPT MODAL */}
      {prompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: prompt.type === 'success' ? '#dcfce7' : prompt.type === 'confirmLogout' ? '#e0f2fe' : '#fee2e2', color: prompt.type === 'success' ? '#16a34a' : prompt.type === 'confirmLogout' ? '#00b0f0' : '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {prompt.type === 'success' ? <Check size={24} strokeWidth={3} /> : prompt.type === 'confirmLogout' ? <LogOut size={24} strokeWidth={2} /> : <X size={24} strokeWidth={3} />}
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>
               {prompt.type === 'success' ? "Success" : prompt.type === 'confirmLogout' ? "Sign Out" : "Error"}
            </h3>
            
            <p style={{ margin: '0 0 24px', color: '#555', fontSize: '0.95rem', lineHeight: 1.4 }}>{prompt.message}</p>
            
            {prompt.type === 'confirmLogout' ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setPrompt(null)}
                  style={{ flex: 1, padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#111', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeLogout}
                  style={{ flex: 1, padding: '14px', background: '#ff2744', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
                <button 
                  onClick={() => setPrompt(null)}
                  style={{ width: '100%', padding: '14px', background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#111', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  Okay
                </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Light theme standalone input block
function LightInput({ label, placeholder, value, onChange, maxLength }) {
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
         <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{label}</label>
         <input 
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            style={{
               width: '100%', padding: '14px', borderRadius: '10px',
               border: '1px solid #cbd5e1', fontSize: '0.95rem', color: '#1e293b',
               outline: 'none', background: '#fff', fontFamily: 'inherit',
               transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
         />
      </div>
   );
}
