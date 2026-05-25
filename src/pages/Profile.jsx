import React, { useState, useEffect, useRef } from 'react';
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
  X,
  Camera,
  Loader2,
  Trash2
} from 'lucide-react';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { db } from '../firebase';

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, logout, setUserPhotoURL } = useAuth();
  
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
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef(null);

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

  const triggerDeleteConfirm = () => {
    setPrompt({ message: "Are you sure you want to permanently delete your account? This action cannot be undone.", type: "confirmDeleteAccount" });
  };

  const executeDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      // Mask sensitive fields in Firestore to avoid null-related errors for historical rides
      await setDoc(doc(db, 'users', currentUser.uid), { 
        phoneNumber: '*******', 
        plateNumber: '*******' 
      }, { merge: true });
      
      await deleteUser(currentUser);
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Failed to delete account", err);
      setIsDeleting(false);
      if (err.code === 'auth/requires-recent-login') {
        setPrompt({ message: "For security reasons, please sign out and sign back in before deleting your account.", type: "error" });
      } else {
        setPrompt({ message: "Failed to delete account. Please try again.", type: "error" });
      }
    }
  };

  // Compress image and return as base64 data URL
  const compressImageToDataURL = (file, maxWidth = 256, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = (maxWidth / w) * h;
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataURL = canvas.toDataURL('image/jpeg', quality);
          resolve(dataURL);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPrompt({ message: 'Please select a valid image file.', type: 'error' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPrompt({ message: 'Image must be under 5MB.', type: 'error' });
      return;
    }

    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setImgError(false);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile || !currentUser) return;
    setIsUploadingPhoto(true);
    try {
      // Compress to small base64 data URL (~20-50KB)
      const dataURL = await compressImageToDataURL(photoFile);

      // Store in Firestore only (data URLs exceed Auth's 2048-char photoURL limit)
      await setDoc(doc(db, 'users', currentUser.uid), { photoURL: dataURL }, { merge: true });

      // Update local state so avatar refreshes immediately
      setInitialState(prev => ({ ...prev, photoURL: dataURL }));
      // Sync to AuthContext so other pages (Home, etc.) see the new photo
      setUserPhotoURL(dataURL);
      setPhotoPreview(null);
      setPhotoFile(null);
      setImgError(false);
      setPrompt({ message: 'Profile photo updated!', type: 'success' });
    } catch (err) {
      console.error('Photo upload error:', err);
      setPrompt({ message: 'Failed to save photo. Please try again.', type: 'error' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const cancelPhotoPreview = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        onboardingComplete: true,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', currentUser.uid), payload, { merge: true });
      // Sync Auth displayName so ride creation uses the latest name
      try { await updateProfile(currentUser, { displayName: fullName }); } catch (e) {}
      setInitialState(prev => ({ ...prev, ...payload })); // Preserve photoURL from previous state
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
    <div style={{ height: '100dvh', width: '100vw', background: '#0f172a', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ background: '#161a1e', padding: 'calc(16px + env(safe-area-inset-top)) 20px 16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
               <ArrowLeft size={24} color="#fff" />
            </button>
            <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Profile</span>
         </div>
         <div style={{ display: 'flex', alignItems: 'center' }}>
             <button onClick={handleSave} disabled={isSaving} style={{ background: 'rgba(255,255,255,0.2)', height: 32, width: 32, borderRadius: '8px', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s', opacity: isSaving ? 0.6 : 1 }}>
                <Save size={16} color="#fff" />
             </button>
         </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoSelect}
      />

      {/* TOP USER RATING CARD */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '24px 20px', borderBottom: '1px solid #1e293b' }}>
          {/* Avatar with camera overlay */}
          <div style={{ position: 'relative', width: 64, height: 64, marginRight: '16px', flexShrink: 0 }}>
             <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1e293b', overflow: 'hidden' }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                ) : (initialState.photoURL || currentUser.photoURL) && !imgError ? (
                  <img 
                    src={initialState.photoURL || currentUser.photoURL} 
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
             {/* Camera button overlay */}
             <button
               onClick={() => fileInputRef.current?.click()}
               style={{
                 position: 'absolute', bottom: -2, right: -2,
                 width: 26, height: 26, borderRadius: '50%',
                 background: '#00b0f0', border: '2px solid #fff',
                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                 cursor: 'pointer', padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
               }}
             >
               <Camera size={13} color="#fff" strokeWidth={2.5} />
             </button>
          </div>

         <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
               {fullName || currentUser.displayName || 'Gabriel Rivera'}
            </h2>
            <span style={{ fontSize: '0.90rem', color: '#94a3b8', marginBottom: '6px' }}>
               {currentUser.email}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
               {[1, 2, 3, 4, 5].map(starNum => {
                   const ratingVal = parseFloat(initialState.rating) || 0;
                   const isFilled = starNum <= Math.round(ratingVal);
                   return <Star key={starNum} size={14} fill={isFilled ? "#ffb800" : "#334155"} color={isFilled ? "#ffb800" : "#334155"} />;
               })}
               <span style={{ marginLeft: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{(parseFloat(initialState.rating) || 0).toFixed(1)}</span>
               <span style={{ marginLeft: '4px', fontSize: '0.85rem', color: '#64748b' }}>({initialState.completedRides || 0})</span>
            </div>

            {/* Photo action buttons (only show when a photo is previewed) */}
            {photoPreview && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  onClick={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    background: '#00b0f0', color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                    cursor: isUploadingPhoto ? 'not-allowed' : 'pointer',
                    opacity: isUploadingPhoto ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: '5px'
                  }}
                >
                  {isUploadingPhoto ? (
                    <><Loader2 size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> Uploading...</>
                  ) : (
                    <><Check size={13} strokeWidth={3} /> Save Photo</>
                  )}
                </button>
                <button
                  onClick={cancelPhotoPreview}
                  disabled={isUploadingPhoto}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    background: '#334155', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
         </div>
      </div>

      {/* BODY INFO */}
      <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
         
         {/* PERSONAL DETAILS */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Full Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Full Name</label>
               <div className="input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}>
                     <User size={18} color="#64748b" />
                  </div>
                  <input 
                     type="text" 
                     value={fullName}
                     onChange={(e) => setFullName(e.target.value)}
                     placeholder=""
                     maxLength={30}
                     style={{
                        width: '100%', padding: '14px 14px 14px 44px', borderRadius: '10px',
                        border: '1px solid #334155', fontSize: '0.95rem', color: '#f8fafc',
                        outline: 'none', background: '#1e293b', fontFamily: 'inherit',
                        transition: 'border-color 0.2s'
                     }}
                     onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                     onBlur={(e) => e.target.style.borderColor = '#334155'}
                  />
               </div>
            </div>

            {/* Phone Number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Phone Number</label>
               <div className="input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '14px', pointerEvents: 'none' }}>
                     <Phone size={18} color="#64748b" />
                  </div>
                  <input 
                     type="tel" 
                     value={phoneNumber}
                     onChange={(e) => setPhoneNumber(e.target.value)}
                     placeholder=""
                     maxLength={13}
                     style={{
                        width: '100%', padding: '14px 14px 14px 44px', borderRadius: '10px',
                        border: '1px solid #334155', fontSize: '0.95rem', color: '#f8fafc',
                        outline: 'none', background: '#1e293b', fontFamily: 'inherit',
                        transition: 'border-color 0.2s'
                     }}
                     onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                     onBlur={(e) => e.target.style.borderColor = '#334155'}
                  />
               </div>
               <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', marginTop: '2px' }}>
                  Your phone number will be shared with matched users so they can contact you.
               </span>
            </div>

            {/* About Me */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>About Me (Optional)</label>
               <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A little bit about yourself (e.g., 'I love listening to jazz on my commute')"
                  maxLength={150}
                  style={{ 
                     width: '100%', padding: '14px', borderRadius: '10px',
                     border: '1px solid #334155', fontSize: '0.95rem', color: '#f8fafc',
                     outline: 'none', background: '#1e293b', fontFamily: 'inherit',
                     resize: 'none', minHeight: '100px', lineHeight: '1.5',
                     transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
                  onBlur={(e) => e.target.style.borderColor = '#334155'}
               />
            </div>

         </div>

         {/* VISUAL SEPARATOR */}
         <div style={{ height: '1px', background: '#1e293b', margin: '4px 0' }} />

         {/* CAR DETAILS SECTION */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
               <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>Car Details (Optional)</h3>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px', borderRadius: '10px', border: '1px solid #334155', background: '#1e293b', marginTop: '4px' }}>
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
                        background: (parseInt(seats) || 3) <= 1 ? '#1e293b' : '#334155', 
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: (parseInt(seats) || 3) <= 1 ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s'
                     }}>
                     <Minus size={16} color={(parseInt(seats) || 3) <= 1 ? '#334155' : '#cbd5e1'} />
                  </button>
                  
                  <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#f8fafc', width: '20px', textAlign: 'center' }}>
                     {parseInt(seats) || 3}
                  </span>
                  
                  <button 
                     onClick={() => setSeats((Math.min(4, (parseInt(seats) || 3) + 1)).toString())}
                     style={{ 
                        width: 32, height: 32, borderRadius: '6px', 
                        background: '#475569', border: 'none', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transition: 'background 0.2s'
                     }}
                     onMouseOver={(e) => e.currentTarget.style.background = '#64748b'}
                     onMouseOut={(e) => e.currentTarget.style.background = '#475569'}
                  >
                     <Plus size={16} color="#fff" />
                  </button>
               </div>
            </div>

         </div>

         {/* BOTTOM ACTIONS */}
         <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <button 
                 onClick={triggerLogoutConfirm}
                 style={{
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.3s, transform 0.1s'
                 }}
                 onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                 onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                 <LogOut size={18} />
                 Sign Out
              </button>

              <button 
                 onClick={triggerDeleteConfirm}
                 disabled={isDeleting}
                 style={{
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.3s, transform 0.1s',
                    opacity: isDeleting ? 0.7 : 1
                 }}
                 onMouseOver={(e) => { if(!isDeleting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                 onMouseOut={(e) => { if(!isDeleting) e.currentTarget.style.background = 'transparent'; }}
               >
                 {isDeleting ? <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} /> : <Trash2 size={18} />}
                 {isDeleting ? "Deleting..." : "Delete Account"}
              </button>

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
                   transition: 'background 0.3s, transform 0.1s',
                   opacity: isSaving ? 0.7 : 1
                }}
              >
                 {isSaving ? <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} /> : <Save size={18} />}
                 {isSaving ? "Saving..." : "Save Profile"}
              </button>
         </div>

      </div>

      {/* CUSTOM PROMPT MODAL */}
      {prompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: prompt.type === 'success' ? 'rgba(22, 163, 74, 0.15)' : prompt.type === 'confirmLogout' ? 'rgba(0, 176, 240, 0.15)' : 'rgba(255, 39, 68, 0.15)', color: prompt.type === 'success' ? '#4ade80' : prompt.type === 'confirmLogout' ? '#00b0f0' : '#ff2744', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {prompt.type === 'success' ? <Check size={24} strokeWidth={3} /> : prompt.type === 'confirmLogout' ? <LogOut size={24} strokeWidth={2} /> : prompt.type === 'confirmDeleteAccount' ? <Trash2 size={24} strokeWidth={2} /> : <X size={24} strokeWidth={3} />}
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
               {prompt.type === 'success' ? "Success" : prompt.type === 'confirmLogout' ? "Sign Out" : prompt.type === 'confirmDeleteAccount' ? "Delete Account" : "Error"}
            </h3>
            
            <p style={{ margin: '0 0 24px', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.4 }}>{prompt.message}</p>
            
            {prompt.type === 'confirmLogout' || prompt.type === 'confirmDeleteAccount' ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setPrompt(null)}
                  style={{ flex: 1, padding: '14px', background: '#334155', border: 'none', borderRadius: '8px', color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={prompt.type === 'confirmDeleteAccount' ? executeDeleteAccount : executeLogout}
                  style={{ flex: 1, padding: '14px', background: '#ff2744', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  {prompt.type === 'confirmDeleteAccount' ? "Delete" : "Sign Out"}
                </button>
              </div>
            ) : (
                <button 
                  onClick={() => setPrompt(null)}
                  style={{ width: '100%', padding: '14px', background: '#334155', border: 'none', borderRadius: '8px', color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
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
         <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>{label}</label>
         <input 
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            style={{
               width: '100%', padding: '14px', borderRadius: '10px',
               border: '1px solid #334155', fontSize: '0.95rem', color: '#f8fafc',
               outline: 'none', background: '#1e293b', fontFamily: 'inherit',
               transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#00b0f0'}
            onBlur={(e) => e.target.style.borderColor = '#334155'}
         />
      </div>
   );
}
