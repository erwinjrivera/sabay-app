import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import FindRide from './pages/FindRide';
import OfferRide from './pages/OfferRide';
import ChooseOnMap from './pages/ChooseOnMap';
import LocationDetails from './pages/LocationDetails';
import AddSavedPlace from './pages/AddSavedPlace';
import OfferMatches from './pages/OfferMatches';
import MyRides from './pages/MyRides';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/find" element={<FindRide />} />
          <Route path="/offer" element={<OfferRide />} />
          <Route path="/choose-on-map" element={<ChooseOnMap />} />
          <Route path="/location-details" element={<LocationDetails />} />
          <Route path="/add-saved-place" element={<AddSavedPlace />} />
          <Route path="/offer-matches" element={<OfferMatches />} />
          <Route path="/my-rides" element={<MyRides />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
