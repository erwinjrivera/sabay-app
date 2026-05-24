import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

export default function AddSavedPlace() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // state is expected to contain { item, findState, activeField } from LocationDetails
  const item = state?.item || { title: 'Unknown', desc: 'No geography found', lat: undefined, lon: undefined };
  const findState = state?.findState || null;
  const activeField = state?.activeField || 'from';
  const sourceMode = state?.sourceMode || 'find';

  const fullAddress = item.desc && item.desc !== 'Philippines' ? `${item.title}, ${item.desc}` : item.title;

  const editMode = state?.editMode || false;
  const savedData = state?.savedData || null;

  const [name, setName] = useState(editMode && savedData ? savedData.name : (item.title && item.title !== 'Unknown Area' && item.title !== 'Unknown' ? item.title : ''));
  const [details, setDetails] = useState(editMode && savedData ? savedData.details || '' : '');
  const [note, setNote] = useState(editMode && savedData ? savedData.note || '' : '');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMsg('Please enter a name for this place.');
      return;
    }
    
    if (name.trim().length > 60) {
      setErrorMsg('Name must not exceed 60 characters.');
      return;
    }
    
    if (details.trim().length > 150) {
      setErrorMsg('Address details must not exceed 150 characters.');
      return;
    }

    // Check uniqueness natively against the correct pool
    const savedString = localStorage.getItem(`sabay_${sourceMode}_saved`);
    const savedList = savedString ? JSON.parse(savedString) : [];

    if (savedList.some(p => p.name.toLowerCase() === name.trim().toLowerCase() && (!editMode || p.id !== savedData.id))) {
       setErrorMsg('A saved place with this name already exists.');
       return;
    }

    let updated;
    if (editMode && savedData) {
       updated = savedList.map(p => {
         if (p.id === savedData.id) {
            return { ...p, name: name.trim(), details: details.trim(), note: note.trim() };
         }
         return p;
       });
    } else {
       const newPlace = {
          id: Date.now().toString() + Math.random(),
          name: name.trim(),
          address: fullAddress,
          title: item.title,
          desc: item.desc,
          lat: item.lat,
          lon: item.lon,
          details: details.trim(),
          note: note.trim()
       };
       updated = [newPlace, ...savedList];
    }

    localStorage.setItem(`sabay_${sourceMode}_saved`, JSON.stringify(updated));

    // Bounce exactly backwards
    navigate(-1);
  };

  const wrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    padding: '0.5rem 0 1rem',
  };

  const inputStyle = {
    flex: 1,
    border: 'none',
    fontSize: '1rem',
    color: '#f8fafc',
    outline: 'none',
    background: 'transparent',
    padding: 0,
    minWidth: 0
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '1.5rem',
    marginBottom: '0.2rem'
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
       {/* HEADER */}
       <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
          <button 
             onClick={() => navigate(-1)}
             style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={24} color="#f8fafc" />
          </button>
          <h2 style={{ margin: '0 auto', fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', paddingRight: '24px' }}>
             {editMode ? 'Edit Saved Place' : 'Add to Saved Places'}
          </h2>
       </div>

       {/* CONTENT */}
       <div style={{ padding: '0 1.5rem', flex: 1 }}>
          
          {errorMsg && (
             <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.9rem' }}>
                {errorMsg}
             </div>
          )}

          <label style={{ ...labelStyle, display: 'flex' }}>
             <span style={{ color: '#ea4335', marginRight: '2px' }}>*</span>Name
          </label>
          <div style={wrapperStyle}>
            <input 
               style={inputStyle}
               placeholder="e.g. Home, Work, etc..."
               value={name}
               maxLength={60}
               onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg('');
               }}
            />
            {name && (
               <button onClick={() => setName('')} style={{ background: '#475569', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, marginLeft: '8px' }}>
                 <X size={12} color="#f8fafc" strokeWidth={3} />
               </button>
            )}
          </div>

          <label style={labelStyle}>Address</label>
          <div style={{ padding: '0.5rem 0 1rem', borderBottom: '1px solid #334155', fontSize: '1rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fullAddress}
          </div>

          <label style={labelStyle}>Address details</label>
          <div style={wrapperStyle}>
            <input 
               style={inputStyle}
               placeholder="e.g. Floor, unit number"
               value={details}
               maxLength={150}
               onChange={(e) => setDetails(e.target.value)}
            />
            {details && (
               <button onClick={() => setDetails('')} style={{ background: '#475569', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, marginLeft: '8px' }}>
                 <X size={12} color="#f8fafc" strokeWidth={3} />
               </button>
            )}
          </div>

          {sourceMode === 'find' && (
            <>
              <label style={labelStyle}>Note to driver</label>
              <div style={wrapperStyle}>
                <input 
                   style={inputStyle}
                   placeholder="e.g. Meet me at the lobby"
                   value={note}
                   onChange={(e) => setNote(e.target.value)}
                />
                {note && (
                   <button onClick={() => setNote('')} style={{ background: '#475569', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, marginLeft: '8px' }}>
                     <X size={12} color="#f8fafc" strokeWidth={3} />
                   </button>
                )}
              </div>
            </>
          )}

       </div>

       {/* ACTION BUTTON */}
       <div style={{ padding: '1.5rem', paddingBottom: '2.5rem', background: '#0f172a', position: 'sticky', bottom: 0, marginTop: 'auto' }}>
           <button 
              className="fr-submit-btn" 
              onClick={handleSave}
              style={{ width: '100%' }}
           >
              {editMode ? 'Update Address' : 'Save Address'}
           </button>
       </div>
    </div>
  );
}
