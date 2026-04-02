import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Crosshair, Map, Clock, Calendar, Search, X, MoreHorizontal, Heart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

/* MUI IMPORTS */
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider, MobileDatePicker, MobileTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const theme = createTheme({
  palette: {
    primary: {
      main: '#00b0f0', // Sabay Blue overlay for the pickers!
    },
  },
});

export default function OfferRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromRef = useRef(null);
  const toRef = useRef(null);
  
  const [fromLocation, setFromLocation] = useState('');
  const [fromCoords, setFromCoords] = useState(null);
  const [toLocation, setToLocation] = useState('');
  const [toCoords, setToCoords] = useState(null);

  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'recent'); // 'recent' or 'saved'
  const [recentPlaces, setRecentPlaces] = useState(() => {
    const saved = localStorage.getItem('sabay_offer_recents');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedPlaces, setSavedPlaces] = useState(() => {
    const saved = localStorage.getItem('sabay_offer_saved');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeField, setActiveField] = useState('from'); 
  
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // MUI Pickers state
  const getDefaultTime = () => {
    const now = dayjs();
    const minutes = now.minute();
    let nextQuarterMin = Math.ceil(minutes / 15) * 15;
    
    const diff = nextQuarterMin - minutes;
    if (diff < 10) {
      nextQuarterMin += 15;
    }
    
    return now.minute(nextQuarterMin).second(0).millisecond(0);
  };

  const [dateVal, setDateVal] = useState(getDefaultTime());
  const [timeVal, setTimeVal] = useState(getDefaultTime());
  
  const [seats, setSeats] = useState(1);
  const [driverNote, setDriverNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore State from /choose-on-map
  useEffect(() => {
    if (location.state && location.state.originalFindState) {
       setFromLocation(location.state.originalFindState.fromLocation);
       setToLocation(location.state.originalFindState.toLocation);
       if (location.state.originalFindState.dateVal) setDateVal(dayjs(location.state.originalFindState.dateVal));
       if (location.state.originalFindState.timeVal) setTimeVal(dayjs(location.state.originalFindState.timeVal));
       
       if (location.state.updatedField === 'from') {
          setFromLocation(location.state.address);
          setFromCoords(location.state.lat && location.state.lon ? { lat: location.state.lat, lon: location.state.lon } : null);
          if (!location.state.originalFindState.toLocation) {
             setActiveField('to');
             setTimeout(() => toRef.current?.focus(), 100);
          } else {
             setIsPanelOpen(true);
          }
       } else if (location.state.updatedField === 'to') {
          setToLocation(location.state.address);
          setToCoords(location.state.lat && location.state.lon ? { lat: location.state.lat, lon: location.state.lon } : null);
          if (!location.state.originalFindState.fromLocation) {
             setActiveField('from');
             setTimeout(() => fromRef.current?.focus(), 100);
          } else {
             setActiveField('to');
             setIsPanelOpen(true);
          }
       }
       
       saveRecentPlace(
          location.state.title || location.state.address, 
          location.state.desc || '', 
          'search',
          location.state.lat,
          location.state.lon
       ); // Automatically save as recent
       
       // Clear state instantly to prevent infinite refresh cycles
       navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Search Suggester state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);


  useEffect(() => {
    if (fromRef.current) {
      fromRef.current.focus();
    }
  }, []);

  // Use a debounce for live search against Nominatim API
  useEffect(() => {
    const query = activeField === 'from' ? fromLocation : toLocation;
    
    // Clear suggestions if almost empty
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsSearching(true);
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=5&countrycodes=ph');
        const data = await res.json();
        
        const mapped = data.map((d, index) => {
          const parts = d.display_name.split(',');
          return {
            id: d.place_id || index,
            title: parts[0],
            desc: parts.slice(1).join(', '),
            lat: d.lat,
            lon: d.lon
          };
        });
        setSuggestions(mapped);
      } catch (err) {
        console.error("Geocoding failed", err);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [fromLocation, toLocation, activeField]);

  // Geolocation trigger
  const handleCurrentLocationclick = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json');
          const data = await res.json();
          // Extract specific part or just address
          const street = data.address?.road || data.address?.suburb || '';
          const area = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
          
          let fullAddress = '';
          if (street && area) fullAddress = `${street}, ${area}`;
          else if (street) fullAddress = street;
          else if (area) fullAddress = area;
          else fullAddress = data.display_name?.split(',').slice(0, 2).join(',') || 'Unknown Location';
          
          handleSelect(fullAddress, '', lat, lon);
        } catch(e) {
          handleSelect('Coordinates: ' + lat.toFixed(4) + ', ' + lon.toFixed(4), '', lat, lon);
        }
      }, (err) => {
        alert("Please enable location services to use Current Location.");
      });
    }
  };

  const isPlaceSaved = (title, desc) => {
    return savedPlaces.some(p => p.title === title && p.desc === desc);
  };

  const saveRecentPlace = (title, desc, type, lat, lon) => {
    if (!title || title === 'Current location' || title === 'Choose on map') return;

    let finalTitle = title;
    let finalDesc = desc || '';

    // Automatically split comma-separated strings to ensure clean bold/light UI rendering later
    if (!finalDesc && title.includes(',')) {
      const parts = title.split(',');
      finalTitle = parts[0].trim();
      finalDesc = parts.slice(1).join(',').trim();
    }

    setRecentPlaces((prev) => {
      const filtered = prev.filter(p => p.title !== finalTitle);
      const newPlace = { 
        id: Date.now().toString() + Math.random(), 
        title: finalTitle, 
        desc: finalDesc, 
        type,
        lat,
        lon
      };
      const updated = [newPlace, ...filtered].slice(0, 20);
      localStorage.setItem('sabay_offer_recents', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelect = (title, desc = '', lat, lon) => {
    if (title === 'Current location') {
      handleCurrentLocationclick();
      return;
    }
    
    // Inject the fully concatenated address into the text field
    const fullAddress = desc ? `${title}, ${desc}` : title;
    
    if (activeField === 'from') {
      const isSavedObj = savedPlaces.find(p => p.title === title && p.desc === desc);
      if (isSavedObj && isSavedObj.note) {
         setDriverNote(isSavedObj.note);
      } else {
         setDriverNote('');
      }
      
      setFromLocation(fullAddress);
      setFromCoords(lat && lon ? { lat, lon } : null);
      if (!toLocation) {
        setActiveField('to');
        setTimeout(() => toRef.current?.focus(), 100);
      } else {
        setIsPanelOpen(true);
      }
    } else {
      setToLocation(fullAddress);
      setToCoords(lat && lon ? { lat, lon } : null);
      if (!fromLocation) {
        setActiveField('from');
        setTimeout(() => fromRef.current?.focus(), 100);
      } else {
        setIsPanelOpen(true); 
      }
    }
    setSuggestions([]);
    
    // Save as a searched item
    saveRecentPlace(title, desc, 'search', lat, lon);
  };

  const handleOfferRideSubmit = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    let finalFromCoords = fromCoords;
    let finalToCoords = toCoords;

    // Aggressive Fallback Geocoding
    if (!finalFromCoords && fromLocation) {
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(fromLocation) + '&format=json&limit=1&countrycodes=ph');
        const data = await res.json();
        if (data && data[0]) {
           finalFromCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (err) {}
    }

    if (!finalToCoords && toLocation) {
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(toLocation) + '&format=json&limit=1&countrycodes=ph');
        const data = await res.json();
        if (data && data[0]) {
           finalToCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (err) {}
    }

    if (!finalFromCoords || !finalToCoords) {
      setErrorMsg("Please select map-resolved locations from the auto-suggestions before offering a ride.");
      setIsSubmitting(false);
      return;
    }
    if (!currentUser) {
      setIsSubmitting(false);
      navigate('/login');
      return;
    }

    try {
      if (fromLocation) saveRecentPlace(fromLocation, '', 'ride', finalFromCoords.lat, finalFromCoords.lon);
      if (toLocation) saveRecentPlace(toLocation, '', 'ride', finalToCoords.lat, finalToCoords.lon);

      const payload = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Driver',
        userProfilePic: currentUser.photoURL || '',
        status: 'open',
        type: 'driver',
        from: {
          address: fromLocation,
          lat: finalFromCoords.lat,
          lon: finalFromCoords.lon
        },
        to: {
          address: toLocation,
          lat: finalToCoords.lat,
          lon: finalToCoords.lon
        },
        seats: seats || 1,
        note: driverNote || '',
        date: dateVal ? dateVal.toISOString() : null,
        time: timeVal ? timeVal.toISOString() : null,
        createdAt: serverTimestamp()
      };

      const addDocPromise = addDoc(collection(db, 'rideOffers'), payload);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection error. Please check your network and try again.")), 15000));
      
      const docRef = await Promise.race([addDocPromise, timeoutPromise]);
      
      const { createdAt, ...safePayload } = payload;
      navigate('/offer-matches', { state: { ride: { id: docRef.id, ...safePayload } } });
    } catch (err) {
      console.error("Firestore error internally:", err);
      setErrorMsg(err.message + " (Redirecting to matches preview gracefully...)");
      if (err.message.includes("Connection error")) {
         setTimeout(() => navigate('/offer-matches'), 2500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuery = activeField === 'from' ? fromLocation : toLocation;

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="find-ride-container">
          {/* Header & Inputs */}
          <div className="fr-header" style={{ flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', width: '100%' }}>
               <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}>
                 <ArrowLeft size={24} color="#333" />
               </button>
               <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#111' }}>Offer a Ride</h1>
            </div>
            <div className="fr-inputs-wrapper">
              <div className="fr-timeline">
                <div className="fr-dot-blue">
                   <div className="fr-dot-inner"></div>
                </div>
                <div className="fr-line-dashed"></div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#ea4335" stroke="#ea4335" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                  <circle cx="12" cy="10" r="3" fill="white" stroke="white"></circle>
                </svg>
              </div>
              <div className="fr-input-fields">
                <div className="fr-input-wrapper">
                  <input 
                    ref={fromRef}
                    type="text" 
                    className={ "fr-input " + (activeField === 'from' ? 'fr-active' : '') }
                    placeholder="Leaving from..."
                    value={fromLocation}
                    onChange={(e) => {
                       setFromLocation(e.target.value);
                       setFromCoords(null);
                    }}
                    onFocus={() => {
                       setActiveField('from');
                       setIsPanelOpen(false);
                    }}
                  />
                  {activeField === 'from' && fromLocation && (
                    <button className="fr-clear-btn" onClick={() => setFromLocation('')} style={{ background: '#ccc', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, right: '12px' }}>
                      <X size={12} color="#fff" strokeWidth={3} />
                    </button>
                  )}
                </div>
                
                <div className="fr-input-wrapper">
                  <input 
                    ref={toRef}
                    type="text" 
                    className={ "fr-input " + (activeField === 'to' ? 'fr-active' : '') }
                    placeholder="Going to..."
                    value={toLocation}
                    onChange={(e) => {
                       setToLocation(e.target.value);
                       setToCoords(null);
                    }}
                    onFocus={() => {
                       setActiveField('to');
                       setIsPanelOpen(false);
                    }}
                  />
                  {activeField === 'to' && toLocation && (
                    <button className="fr-clear-btn" onClick={() => setToLocation('')} style={{ background: '#ccc', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, right: '12px' }}>
                      <X size={12} color="#fff" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="fr-tabs">
            <button 
              className={ "fr-tab-btn " + (activeTab === 'recent' ? 'active' : '') }
              onClick={() => setActiveTab('recent')}
            >
              Recent
            </button>
            <button 
              className={ "fr-tab-btn " + (activeTab === 'saved' ? 'active' : '') }
              onClick={() => setActiveTab('saved')} 
            >
              Saved
            </button>
          </div>

          <div className="fr-list-container">
            {activeTab === 'recent' && (
              <div className="fr-list">
                
                {/* DEFAULT LIST */}
                {(!currentQuery || currentQuery.length < 3) && (
                  <>
                    {activeField === 'from' && (
                      <div className="fr-list-item" onClick={handleCurrentLocationclick}>
                        <div className="fr-icon-box fr-blue">
                          <Crosshair size={24} color="#00b0f0" />
                        </div>
                        <div className="fr-item-text">
                          <h4>Current location</h4>
                          <p>Fetch your exact GPS address</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="fr-list-item" onClick={() => {
                        navigate('/choose-on-map', {
                          state: {
                            activeField,
                            sourceMode: 'offer',
                            findState: { 
                              fromLocation, 
                              toLocation, 
                              dateVal: dateVal ? dateVal.toISOString() : null, 
                              timeVal: timeVal ? timeVal.toISOString() : null 
                            }
                          }
                        });
                    }}>
                      <div className="fr-icon-box fr-blue">
                        <Map size={24} color="#00b0f0" fill="#ccf0ff" strokeWidth={1.5} />
                      </div>
                      <div className="fr-item-text">
                        <h4>Choose on map</h4>
                      </div>
                    </div>
                  </>
                )}

                {/* SHOW RECENT PLACES WHEN EMPTY */}
                {(!currentQuery || currentQuery.length < 3) && (
                  <>
                    {recentPlaces.map((item) => (
                      <div key={item.id} className="fr-list-item" onClick={() => handleSelect(item.title, item.desc, item.lat, item.lon)}>
                        <div className="fr-icon-box fr-teal">
                          {isPlaceSaved(item.title, item.desc) ? (
                             <Heart size={20} color="#00b0f0" />
                          ) : item.type === 'search' ? (
                            <Search size={20} color="#00b0f0" />
                          ) : (
                            <Clock size={20} color="#00b0f0" />
                          )}
                        </div>
                        <div className="fr-item-text">
                          <h4>{item.title}</h4>
                          {item.desc && <p>{item.desc}</p>}
                        </div>
                        <div className="fr-icon-more" onClick={(e) => {
                           e.stopPropagation();
                           navigate('/location-details', {
                              state: {
                                item,
                                activeField,
                                sourceMode: 'offer',
                                findState: { fromLocation, toLocation, dateVal: dateVal ? dateVal.toISOString() : null, timeVal: timeVal ? timeVal.toISOString() : null }
                              }
                           });
                        }}>
                           <MoreHorizontal size={24} color="#999" />
                        </div>
                      </div>
                    ))}
                    
                    {recentPlaces.length > 0 && (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                        <a href="#" style={{ color: '#888', textDecoration: 'underline', fontSize: '0.9rem' }} onClick={(e) => {
                           e.preventDefault();
                           setRecentPlaces([]);
                           localStorage.removeItem('sabay_offer_recents');
                        }}>
                          Clear recent items
                        </a>
                      </div>
                    )}
                  </>
                )}

                {/* SUGGESTER LIST */}
                {isSearching && currentQuery.length >= 3 && (
                  <p style={{ textAlign: 'center', margin: '2rem 0', color: '#888' }}>Searching Map Locations...</p>
                )}

                {!isSearching && suggestions.map((item) => (
                  <div key={item.id} className="fr-list-item" onClick={() => handleSelect(item.title, item.desc, item.lat, item.lon)}>
                    <div className="fr-icon-box fr-teal">
                      <Search size={20} color="#00b0f0" />
                    </div>
                    <div className="fr-item-text">
                      <h4>{item.title}</h4>
                      <p>{item.desc}</p>
                    </div>
                    <div className="fr-icon-more" onClick={(e) => {
                       e.stopPropagation();
                       navigate('/location-details', {
                          state: {
                            item,
                            activeField,
                            sourceMode: 'offer',
                            findState: { fromLocation, toLocation, dateVal: dateVal ? dateVal.toISOString() : null, timeVal: timeVal ? timeVal.toISOString() : null }
                          }
                       });
                    }}>
                       <MoreHorizontal size={24} color="#999" />
                    </div>
                  </div>
                ))}

              </div>
            )}
            
            {activeTab === 'saved' && (
              <div className="fr-list">
                {savedPlaces.length === 0 ? (
                  <p style={{ textAlign: 'center', margin: '2rem 0', color: '#888' }}>You haven't saved any places yet.</p>
                ) : (
                  savedPlaces.map((item) => (
                    <div key={item.id} className="fr-list-item" onClick={() => handleSelect(item.title, item.desc, item.lat, item.lon)}>
                      <div className="fr-icon-box fr-teal">
                        <Heart size={20} color="#00b0f0" />
                      </div>
                      <div className="fr-item-text">
                        <h4>{item.name}</h4>
                        <p>{item.address}</p>
                      </div>
                      <div className="fr-icon-more" onClick={(e) => {
                         e.stopPropagation();
                         navigate('/location-details', {
                            state: {
                              item,
                              activeField,
                              sourceMode: 'offer',
                              findState: { fromLocation, toLocation, dateVal: dateVal ? dateVal.toISOString() : null, timeVal: timeVal ? timeVal.toISOString() : null }
                            }
                         });
                      }}>
                         <MoreHorizontal size={24} color="#999" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Bottom Overlay Trigger Area */}
          <div className={"fr-bottom-panel " + (isPanelOpen ? "open" : "")}>
             
            {/* The clickable handle/dome */}
            <div className="fr-peek" onClick={() => setIsPanelOpen(!isPanelOpen)}>
               <div className="fr-panel-handle"></div>
            </div>

            <div className="fr-panel-content">
              <h3 className="fr-panel-title">Choose date and time</h3>
              
              <div className="fr-datetime-row">
                 <MobileDatePicker
                   label="Date"
                   value={dateVal}
                   onChange={(newValue) => setDateVal(newValue)}
                   disablePast
                   sx={{ 
                     background: 'transparent',
                     '& .MuiOutlinedInput-root': { borderRadius: '16px' } 
                   }}
                 />
                 
                 <MobileTimePicker
                   label="Time"
                   value={timeVal}
                   onChange={(newValue) => setTimeVal(newValue)}
                   sx={{ 
                     background: 'transparent',
                     '& .MuiOutlinedInput-root': { borderRadius: '16px' } 
                   }}
                 />
              </div>

              <div style={{ marginTop: '1.2rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '6px', fontWeight: 500 }}>Number of seats</label>
                    <input
                       type="number"
                       min="1"
                       max="8"
                       value={seats} 
                       onChange={e => setSeats(Number(e.target.value))}
                       style={{ width: '100%', padding: '14px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '12px', background: '#fff', fontSize: '1rem', outline: 'none', color: '#333' }}
                    />
                 </div>
                 
                 <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '6px', fontWeight: 500 }}>Driver's note</label>
                    <input 
                       type="text" 
                       placeholder="e.g. I drive a red sedan"
                       value={driverNote}
                       onChange={e => setDriverNote(e.target.value)}
                       style={{ width: '100%', padding: '14px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '12px', background: '#fff', fontSize: '1rem', outline: 'none', color: '#333' }}
                    />
                 </div>
              </div>
               
               {errorMsg && (
                 <div style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #ffcdd2' }}>
                   <strong>Error: </strong> {errorMsg}
                 </div>
               )}

               <button 
                 className="fr-submit-btn" 
                 onClick={handleOfferRideSubmit}
                 disabled={!fromLocation || !toLocation || isSubmitting}
                 style={(!fromLocation || !toLocation || isSubmitting) ? { background: '#ccc', color: '#888', cursor: 'not-allowed' } : {}}
               >
                 {isSubmitting ? 'Offering...' : 'Offer a Ride'}
               </button>
            </div>
          </div>

        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
