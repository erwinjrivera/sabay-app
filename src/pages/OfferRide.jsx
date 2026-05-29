import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Navigation, Crosshair, Map, Clock, Calendar, Search, X, MoreHorizontal, Heart, Users, Minus, Plus, Trash2, ChevronUp, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

/* MUI IMPORTS */
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider, MobileDatePicker, MobileTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00b0f0', // Sabay Blue overlay for the pickers!
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b'
    }
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

  const { currentUser, userPhotoURL } = useAuth();
  
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
  
  const [seats, setSeats] = useState(3);
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
       
       if (location.state.originalFindState.fromCoords) setFromCoords(location.state.originalFindState.fromCoords);
       if (location.state.originalFindState.toCoords) setToCoords(location.state.originalFindState.toCoords);
       
       if (location.state.restoreOnly) {
          if (location.state.activeField) {
             setActiveField(location.state.activeField);
             // Ensure the input regains focus
             setTimeout(() => {
                if (location.state.activeField === 'from') fromRef.current?.focus();
                else if (location.state.activeField === 'to') toRef.current?.focus();
             }, 100);
          }
       } else {
           if (location.state.updatedField === 'from') {
              setFromLocation(location.state.address);
              setFromCoords(location.state.lat && location.state.lon ? { lat: location.state.lat, lon: location.state.lon } : null);
              if (location.state.originalFindState) {
               if (!location.state.originalFindState.toCoords) {
                  setActiveField('to');
                  setTimeout(() => toRef.current?.focus(), 100);
               }
           }
           } else if (location.state.updatedField === 'to') {
              setToLocation(location.state.address);
              setToCoords(location.state.lat && location.state.lon ? { lat: location.state.lat, lon: location.state.lon } : null);
              if (location.state.originalFindState) {
                  if (!location.state.originalFindState.fromCoords) {
                     setActiveField('from');
                     setTimeout(() => fromRef.current?.focus(), 100);
                  }
               }
           }
           
           saveRecentPlace(
              location.state.title || location.state.address, 
              location.state.desc || '', 
              location.state.type || 'Location area',
              location.state.lat,
              location.state.lon
           ); // Automatically save as recent
       }
       
       // Clear state instantly to prevent infinite refresh cycles
       navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Auto-expand the drawer if both locations are validly selected
  useEffect(() => {
    if (fromCoords && toCoords) {
      setIsPanelOpen(true);
    }
  }, [fromCoords, toCoords]);

  // Map Passengers setting directly from Profile baseline
  useEffect(() => {
    if (!currentUser) return;
    const loadProfileDefaults = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().seats) {
          setSeats(Number(docSnap.data().seats));
        }
      } catch (err) {
        console.error("Failed mapped seats", err);
      }
    };
    loadProfileDefaults();
  }, [currentUser]);

  // Search Suggester state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);


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
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&bbox=116.9,4.6,126.6,21.1`);
        const data = await res.json();
        
        const mapped = data.features.map((f, index) => {
          const props = f.properties;
          const title = props.name || props.street || props.city || "Location";
          const descParts = [props.street, props.city, props.state, props.country].filter(Boolean);
          const desc = descParts.filter(p => p !== title).join(', ');
          
          return {
            id: index,
            title: title,
            desc: desc,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            type: props.osm_value || 'place'
          };
        });
        setSuggestions(mapped);
      } catch (err) {
        console.error("Geocoding failed", err);
        setSuggestions([]);
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
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
              const props = data.features[0].properties;
              const street = props.street || props.name || '';
              const area = props.city || props.state || '';
              
              let fullAddress = '';
              if (street && area) fullAddress = `${street}, ${area}`;
              else fullAddress = street || area || 'Selected Location';
              handleSelect(fullAddress, '', lat, lon);
          } else {
              handleSelect('Current Location', '', lat, lon);
          }
        } catch(e) {
          handleSelect('Coordinates: ' + lat.toFixed(4) + ', ' + lon.toFixed(4), '', lat, lon);
        } finally {
          setIsFetchingLocation(false);
        }
      }, (err) => {
        alert("Please enable location services to use Current Location.");
        setIsFetchingLocation(false);
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

  const handleSelect = (title, desc = '', lat, lon, type = 'Location area') => {
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
      if (!toCoords) {
        setActiveField('to');
        setTimeout(() => toRef.current?.focus(), 100);
      }
    } else {
      setToLocation(fullAddress);
      setToCoords(lat && lon ? { lat, lon } : null);
      if (!fromCoords) {
        setActiveField('from');
        setTimeout(() => fromRef.current?.focus(), 100);
      }
    }
    setSuggestions([]);
    
    // Save as a searched item
    saveRecentPlace(title, desc, type, lat, lon);
  };

  const handleOfferRideSubmit = async () => {
    setErrorMsg('');
    if (!fromLocation || !toLocation) {
       setErrorMsg("Please make sure you have specified both your exact 'Leaving from' and 'Going to' locations before offering your ride.");
       return;
    }

    if (fromLocation.trim().toLowerCase() === toLocation.trim().toLowerCase()) {
       setErrorMsg("Sorry, we cannot calculate a route since your origin and destination are the exact same location.");
       return;
    }

    if (dateVal && timeVal) {
       const selectedDateTime = dateVal.hour(timeVal.hour()).minute(timeVal.minute()).second(0);
       if (selectedDateTime.isBefore(dayjs().subtract(2, 'minute'))) {
          setErrorMsg("The selected departure time has already passed. Please choose a valid future time.");
          return;
       }
    }

    if (driverNote && driverNote.trim().length > 100) {
      setErrorMsg("Note must not exceed 100 characters.");
      return;
    }

    setIsSubmitting(true);
    let finalFromCoords = fromCoords;
    let finalToCoords = toCoords;

    // Aggressive Fallback Geocoding
    if (!finalFromCoords && fromLocation) {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(fromLocation)}&limit=1&bbox=116.9,4.6,126.6,21.1`);
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
           finalFromCoords = { lat: data.features[0].geometry.coordinates[1], lon: data.features[0].geometry.coordinates[0] };
        }
      } catch (err) {}
    }

    if (!finalToCoords && toLocation) {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(toLocation)}&limit=1&bbox=116.9,4.6,126.6,21.1`);
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
           finalToCoords = { lat: data.features[0].geometry.coordinates[1], lon: data.features[0].geometry.coordinates[0] };
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

      let scheduledTime = dayjs();
      if (dateVal && timeVal) {
          const dStr = dateVal.format('YYYY-MM-DD');
          const tStr = timeVal.format('HH:mm:ss');
          scheduledTime = dayjs(`${dStr}T${tStr}`);
      } else if (timeVal || dateVal) {
          scheduledTime = dayjs(timeVal || dateVal);
      }
      
      const payload = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Driver',
        userProfilePic: userPhotoURL || currentUser.photoURL || '',
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
        createdAt: serverTimestamp(),
        expiresAt: scheduledTime.add(8, 'hour').valueOf()
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
        <div className="find-ride-container" style={{ background: '#0f172a', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
          
          {/* Dark Header Strip (Matches OfferMatches.jsx style exactly) */}
          <div style={{ background: '#161a1e', zIndex: 10 }}>
            {/* Top Bar Navigation */}
            <div style={{ padding: 'calc(1rem + env(safe-area-inset-top)) 1rem 1rem 1rem', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff' }}>
              <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>Offer Ride</h1>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#bbb' }}>Set your start and destination locations</p>
              </div>
            </div>

            {/* Inputs Section */}
            <div style={{ padding: '0 1rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
                 <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', paddingBottom: '10px' }}>
                      <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: 'transparent', border: '2px solid #888', zIndex: 2 }}></div>
                      <div style={{ width: 1, flex: 1, background: '#555', margin: '4px 0' }}></div>
                      <div style={{ minWidth: 8, height: 8, borderRadius: '50%', background: '#888', zIndex: 2 }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, justifyContent: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        <input 
                          ref={fromRef}
                          type="text" 
                          placeholder="Leaving from..."
                          value={fromLocation}
                          disabled={activeField === 'from' && isFetchingLocation}
                          onChange={(e) => {
                             setFromLocation(e.target.value);
                             setFromCoords(null);
                          }}
                          onFocus={() => {
                             setActiveField('from');
                             setIsPanelOpen(false);
                          }}
                          style={{ width: 'calc(100% - 8px)', background: activeField === 'from' ? '#334155' : 'transparent', color: '#f8fafc', border: '1px solid transparent', padding: '8px 36px 8px 14px', marginLeft: '-4px', borderRadius: '20px', fontSize: '0.9rem', lineHeight: '1.3', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', opacity: (activeField === 'from' && isFetchingLocation) ? 0.6 : 1 }}
                        />
                        {activeField === 'from' && isFetchingLocation && (
                          <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                            <Loader2 size={16} color="#00b0f0" style={{ animation: 'spin 1s linear infinite' }} />
                          </div>
                        )}
                        {activeField === 'from' && !isFetchingLocation && fromLocation && (
                          <button onClick={() => setFromLocation('')} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: '#475569', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', cursor: 'pointer' }}>
                            <X size={12} color="#94a3b8" strokeWidth={3} />
                          </button>
                        )}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <input 
                          ref={toRef}
                          type="text" 
                          placeholder="Going to..."
                          value={toLocation}
                          disabled={activeField === 'to' && isFetchingLocation}
                          onChange={(e) => {
                             setToLocation(e.target.value);
                             setToCoords(null);
                          }}
                          onFocus={() => {
                             setActiveField('to');
                             setIsPanelOpen(false);
                          }}
                          style={{ width: 'calc(100% - 8px)', background: activeField === 'to' ? '#334155' : 'transparent', color: activeField === 'to' || toLocation ? '#f8fafc' : '#94a3b8', border: '1px solid transparent', padding: '8px 36px 8px 14px', marginLeft: '-4px', borderRadius: '20px', fontSize: '0.9rem', lineHeight: '1.3', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', opacity: (activeField === 'to' && isFetchingLocation) ? 0.6 : 1 }}
                        />
                        {activeField === 'to' && isFetchingLocation && (
                          <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                            <Loader2 size={16} color="#00b0f0" style={{ animation: 'spin 1s linear infinite' }} />
                          </div>
                        )}
                        {activeField === 'to' && !isFetchingLocation && toLocation && (
                          <button onClick={() => setToLocation('')} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: '#475569', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', cursor: 'pointer' }}>
                            <X size={12} color="#94a3b8" strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Physical Folder Tabs seamlessly merged to the white box below */}
            <div style={{ display: 'flex', padding: '0', background: 'transparent', paddingTop: '10px' }}>
              <div 
                onClick={() => setActiveTab('recent')}
                style={{ 
                  position: 'relative',
                  zIndex: activeTab === 'recent' ? 10 : 1,
                  flex: 1, textAlign: 'center', padding: '14px 0', fontWeight: 600, fontSize: '0.95rem',
                  color: activeTab === 'recent' ? '#f8fafc' : '#94a3b8',
                  background: activeTab === 'recent' ? '#1e293b' : 'transparent',
                  borderRadius: '12px 12px 0 0', cursor: 'pointer'
                }}
              >
                Recent
                {activeTab === 'recent' && (
                  <div style={{ position: 'absolute', bottom: 0, right: '-12px', width: '12px', height: '12px', background: 'radial-gradient(circle at top right, transparent 12px, #1e293b 12.5px)', pointerEvents: 'none' }}></div>
                )}
              </div>
              <div 
                onClick={() => setActiveTab('saved')} 
                style={{ 
                  position: 'relative',
                  zIndex: activeTab === 'saved' ? 10 : 1,
                  flex: 1, textAlign: 'center', padding: '14px 0', fontWeight: 600, fontSize: '0.95rem',
                  color: activeTab === 'saved' ? '#f8fafc' : '#94a3b8',
                  background: activeTab === 'saved' ? '#1e293b' : 'transparent',
                  borderRadius: '12px 12px 0 0', cursor: 'pointer'
                }}
              >
                Saved
                {activeTab === 'saved' && (
                  <div style={{ position: 'absolute', bottom: 0, left: '-12px', width: '12px', height: '12px', background: 'radial-gradient(circle at top left, transparent 12px, #1e293b 12.5px)', pointerEvents: 'none' }}></div>
                )}
              </div>
            </div>
          </div>

          <div className="fr-list-container" style={{ background: '#1e293b', marginTop: '-1px', position: 'relative', zIndex: 20 }}>
            {activeTab === 'recent' && (
              <div className="fr-list">
                
                {/* DEFAULT LIST */}
                {(!currentQuery || currentQuery.length < 3) && (
                  <>
                    {activeField === 'from' && (
                      <div className="fr-list-item" onClick={handleCurrentLocationclick}>
                        <div className="fr-icon-box fr-blue">
                          <Navigation size={24} color="#00b0f0" />
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
                              fromCoords,
                              toCoords,
                              dateVal: dateVal ? dateVal.toISOString() : null, 
                              timeVal: timeVal ? timeVal.toISOString() : null 
                            }
                          }
                        });
                    }}>
                      <div className="fr-icon-box fr-blue">
                        <MapPin size={24} color="#00b0f0" />
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
                      <div key={item.id} className="fr-list-item" onClick={() => handleSelect(item.title, item.desc, item.lat, item.lon, item.type)}>
                        <div className="fr-icon-box fr-teal">
                          {isPlaceSaved(item.title, item.desc) ? (
                             <Heart size={20} color="#00b0f0" />
                          ) : item.type === 'search' ? (
                            <Search size={20} color="#888" />
                          ) : (
                            <Clock size={20} color="#888" />
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
                                findState: { fromLocation, toLocation, fromCoords, toCoords, dateVal: dateVal ? dateVal.toISOString() : null, timeVal: timeVal ? timeVal.toISOString() : null }
                              }
                           });
                        }}>
                           <MoreHorizontal size={24} color="#999" />
                        </div>
                      </div>
                    ))}
                    
                    {recentPlaces.length > 0 && (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
                         <button 
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }} 
                            onClick={(e) => {
                               e.preventDefault();
                               setRecentPlaces([]);
                               localStorage.removeItem('sabay_offer_recents');
                            }}
                            title="Clear recent items"
                         >
                           <Trash2 size={20} />
                         </button>
                      </div>
                    )}
                  </>
                )}

                {/* SUGGESTER LIST */}
                {isSearching && currentQuery.length >= 3 && (
                  <p style={{ textAlign: 'center', margin: '2rem 0', color: '#888' }}>Searching Map Locations...</p>
                )}

                {/* EMPTY STATE */}
                {!isSearching && currentQuery.length >= 3 && suggestions.length === 0 && (
                  <p style={{ textAlign: 'center', margin: '2rem 0', color: '#888' }}>No results found</p>
                )}

                {!isSearching && suggestions.map((item) => (
                  <div key={item.id} className="fr-list-item" onClick={() => handleSelect(item.title, item.desc, item.lat, item.lon, item.type)}>
                    <div className="fr-icon-box fr-teal">
                      <Search size={20} color="#888" />
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
                            findState: { fromLocation, toLocation, fromCoords, toCoords, dateVal: dateVal ? dateVal.toISOString() : null, timeVal: timeVal ? timeVal.toISOString() : null }
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <Heart size={32} color="#94a3b8" strokeWidth={1.5} />
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem', color: '#f8fafc', fontSize: '1.2rem', fontWeight: 600 }}>No saved places</h3>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>You don't have any saved places at the moment.</p>
                  </div>
                ) : (
                  savedPlaces.map((item) => (
                    <div key={item.id} className="fr-list-item" onClick={() => handleSelect(item.title, item.desc, item.lat, item.lon, item.type)}>
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
                              findState: { fromLocation, toLocation, fromCoords, toCoords, dateVal: dateVal ? dateVal.toISOString() : null, timeVal: timeVal ? timeVal.toISOString() : null }
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

          {/* Background Dimmer */}
          <div 
            onClick={() => setIsPanelOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 90, opacity: isPanelOpen ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: isPanelOpen ? 'auto' : 'none' }}
          ></div>

          {/* Bottom Overlay Trigger Area */}
          <div className={"fr-bottom-panel " + (isPanelOpen ? "open" : "")}>
             
            {/* The clickable handle/dome */}
            <div className="fr-peek" onClick={() => setIsPanelOpen(!isPanelOpen)}>
               <div className="fr-chevron-grabber" style={{ opacity: isPanelOpen ? 0 : 1, transition: 'opacity 0.2s', margin: 0 }}>
                  <ChevronUp size={28} />
               </div>
               <div style={{ position: 'absolute', top: '10px', right: '16px', opacity: isPanelOpen ? 1 : 0, transition: 'opacity 0.2s' }}>
                  <X size={24} color="#555" strokeWidth={2.5} />
               </div>
            </div>

            <div className="fr-panel-content">
              <style>{`
                .fr-datetime-row .MuiInputBase-input { color: #f8fafc !important; -webkit-text-fill-color: #f8fafc !important; opacity: 1 !important; }
                .fr-datetime-row .MuiSvgIcon-root { color: #94a3b8 !important; fill: #94a3b8 !important; }
                .fr-datetime-row .MuiIconButton-root { color: #94a3b8 !important; }
                input.fr-drawer-input::placeholder { color: #94a3b8 !important; opacity: 1 !important; }
              `}</style>
              <h3 className="fr-panel-title">Choose date and time</h3>
              
              <div className="fr-datetime-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Date</label>
                    <MobileDatePicker
                      value={dateVal}
                      onChange={(newValue) => setDateVal(newValue)}
                      disablePast
                      slotProps={{
                         textField: {
                            sx: {
                              width: '100%',background: '#0f172a',borderRadius: '10px',
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                color: '#f8fafc',
                                '& fieldset': { borderColor: '#334155 !important', borderWidth: '1px !important', borderRadius: '10px !important' },
                                '&:hover fieldset': { borderColor: '#475569 !important' },
                                '&.Mui-focused fieldset': { borderColor: '#00b0f0 !important', borderWidth: '1px !important' }
                              },
                              '& .MuiInputBase-input': { padding: '14px', fontSize: '0.95rem', color: '#f8fafc !important', boxSizing: 'border-box', height: 'auto', WebkitTextFillColor: '#f8fafc !important' },
                              '& .MuiSvgIcon-root': { color: '#94a3b8 !important' }
                            }
                         }
                      }}
                    />
                 </div>
                 
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Time</label>
                    <MobileTimePicker
                      value={timeVal}
                      onChange={(newValue) => setTimeVal(newValue)}
                      slotProps={{
                         textField: {
                            sx: {
                              width: '100%',background: '#0f172a',borderRadius: '10px',
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                color: '#f8fafc',
                                '& fieldset': { borderColor: '#334155 !important', borderWidth: '1px !important', borderRadius: '10px !important' },
                                '&:hover fieldset': { borderColor: '#475569 !important' },
                                '&.Mui-focused fieldset': { borderColor: '#00b0f0 !important', borderWidth: '1px !important' }
                              },
                              '& .MuiInputBase-input': { padding: '14px', fontSize: '0.95rem', color: '#f8fafc !important', boxSizing: 'border-box', height: 'auto', WebkitTextFillColor: '#f8fafc !important' },
                              '& .MuiSvgIcon-root': { color: '#94a3b8 !important' }
                            }
                         }
                      }}
                    />
                 </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                 
                 <div>
                     <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                       <span>Driver's note</span>
                       <span style={{ color: driverNote?.length >= 100 ? '#ff0043' : '#94a3b8', fontSize: '0.75rem', alignSelf: 'flex-end', fontWeight: 500 }}>{driverNote?.length || 0}/100</span>
                     </label>
                     <input 
                        type="text" 
                        maxLength={100}
                        className="fr-drawer-input"
                        placeholder="e.g. I drive a red sedan"
                        value={driverNote}
                        onChange={e => setDriverNote(e.target.value)}
                        style={{
                           width: '100%', padding: '14px', borderRadius: '10px',
                           border: '1px solid #334155', fontSize: '0.95rem', color: '#f8fafc',
                           outline: 'none', background: '#0f172a', boxSizing: 'border-box'
                        }}
                     />
                 </div>

                 <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a' }}>
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
                                background: (parseInt(seats) || 3) <= 1 ? '#334155' : '#475569', 
                                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                cursor: (parseInt(seats) || 3) <= 1 ? 'not-allowed' : 'pointer',
                                transition: 'background 0.2s'
                             }}>
                             <Minus size={16} color={(parseInt(seats) || 3) <= 1 ? '#64748b' : '#f8fafc'} />
                          </button>
                          
                          <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#f8fafc', width: '20px', textAlign: 'center' }}>
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

              </div>
               
               <button 
                 className="fr-submit-btn" 
                 onClick={() => {
                   if (!fromLocation || !toLocation) {
                     setErrorMsg("Please select both pickup and destination locations.");
                     return;
                   }
                   handleOfferRideSubmit();
                 }}
                 disabled={isSubmitting}
                 style={isSubmitting ? { background: '#ccc', color: '#888', cursor: 'not-allowed' } : {}}
               >
                 {isSubmitting ? 'Offering...' : 'Offer Ride'}
               </button>
            </div>
          </div>

          {/* CUSTOM ERROR PROMPT MODAL */}
          {errorMsg && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', boxSizing: 'border-box' }}>
              <div style={{ background: '#1e293b', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', textAlign: 'center', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <style>{`@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <X size={24} strokeWidth={3} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>Missing Information</h3>
                <p style={{ margin: '0 0 24px', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.4 }}>{errorMsg}</p>
                <button 
                  onClick={() => setErrorMsg('')}
                  style={{ width: '100%', padding: '14px', background: '#334155', border: 'none', borderRadius: '8px', color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  Okay
                </button>
              </div>
            </div>
          )}

        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
