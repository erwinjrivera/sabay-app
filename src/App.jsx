import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import FindRide from './pages/FindRide';
import OfferRide from './pages/OfferRide';
import ChooseOnMap from './pages/ChooseOnMap';
import LocationDetails from './pages/LocationDetails';
import AddSavedPlace from './pages/AddSavedPlace';
import OfferMatches from './pages/OfferMatches';
import FindMatches from './pages/FindMatches';
import MyRides from './pages/MyRides';
import ActiveRide from './pages/ActiveRide';
import PassengerTracking from './pages/PassengerTracking';
import Profile from './pages/Profile';
import TermsOfUse from './pages/TermsOfUse';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AdminDashboard from './pages/AdminDashboard';
import NetworkWrapper from './components/NetworkWrapper';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Gate: requires auth + completed onboarding
function ProtectedRoute({ children }) {
  const { currentUser, profileReady } = useAuth();
  
  if (!currentUser || currentUser.emailVerified === false) {
    return <Navigate to="/login" replace />;
  }
  
  if (!profileReady) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
}

// Gate: requires auth + completed onboarding + isAdmin === true
function AdminRoute({ children }) {
  const { currentUser, profileReady, isAdmin } = useAuth();
  
  if (!currentUser || currentUser.emailVerified === false) {
    return <Navigate to="/login" replace />;
  }
  
  if (!profileReady) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/terms-of-use" element={<TermsOfUse />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      {/* Protected routes — require auth + onboarding */}
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/find" element={<ProtectedRoute><FindRide /></ProtectedRoute>} />
      <Route path="/offer" element={<ProtectedRoute><OfferRide /></ProtectedRoute>} />
      <Route path="/choose-on-map" element={<ProtectedRoute><ChooseOnMap /></ProtectedRoute>} />
      <Route path="/location-details" element={<ProtectedRoute><LocationDetails /></ProtectedRoute>} />
      <Route path="/add-saved-place" element={<ProtectedRoute><AddSavedPlace /></ProtectedRoute>} />
      <Route path="/offer-matches" element={<ProtectedRoute><OfferMatches /></ProtectedRoute>} />
      <Route path="/find-matches" element={<ProtectedRoute><FindMatches /></ProtectedRoute>} />
      <Route path="/active-ride" element={<ProtectedRoute><ActiveRide /></ProtectedRoute>} />
      <Route path="/passenger-tracking" element={<ProtectedRoute><PassengerTracking /></ProtectedRoute>} />
      <Route path="/my-rides" element={<ProtectedRoute><MyRides /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      
      {/* Admin Route */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <NetworkWrapper>
        <Router>
          <AppRoutes />
        </Router>
      </NetworkWrapper>
    </AuthProvider>
  );
}

export default App;
