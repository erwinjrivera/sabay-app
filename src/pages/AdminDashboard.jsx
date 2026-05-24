import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getCountFromServer, getDocs, limit, orderBy } from 'firebase/firestore';
import { ChevronLeft, Users, Car, CheckCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    activeOffers: 0,
    activeRequests: 0,
    completedRides: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        // Using getCountFromServer saves massively on read operations!
        const usersSnap = await getCountFromServer(collection(db, 'users'));
        
        const offersQ = query(collection(db, 'rideOffers'), where('status', 'in', ['open', 'confirmed', 'active', 'in_progress']));
        const offersSnap = await getCountFromServer(offersQ);

        const requestsQ = query(collection(db, 'rideRequests'), where('status', 'in', ['open', 'accepted', 'confirmed']));
        const requestsSnap = await getCountFromServer(requestsQ);

        const completedQ = query(collection(db, 'rideOffers'), where('status', '==', 'completed'));
        const completedSnap = await getCountFromServer(completedQ);

        setStats({
          users: usersSnap.data().count,
          activeOffers: offersSnap.data().count,
          activeRequests: requestsSnap.data().count,
          completedRides: completedSnap.data().count
        });

      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div style={{ padding: '24px', paddingBottom: '100px', maxWidth: '600px', margin: '0 auto', color: '#fff', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0 16px' }}>Admin Dashboard</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '64px', color: '#888' }}>Loading metrics...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          {/* Stat Card: Users */}
          <div style={{ background: '#282d32', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={32} color="#ff5a5f" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.users}</div>
            <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px' }}>Total Users</div>
          </div>

          {/* Stat Card: Active Offers */}
          <div style={{ background: '#282d32', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={32} color="#ffb400" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.activeOffers}</div>
            <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px' }}>Active Offers</div>
          </div>

          {/* Stat Card: Active Requests */}
          <div style={{ background: '#282d32', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={32} color="#00b0f0" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.activeRequests}</div>
            <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px' }}>Active Finds</div>
          </div>

          {/* Stat Card: Completed Rides */}
          <div style={{ background: '#282d32', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={32} color="#00e676" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.completedRides}</div>
            <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px' }}>Completed Rides</div>
          </div>

        </div>
      )}

      <div style={{ marginTop: '48px', background: 'rgba(0,176,240,0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(0,176,240,0.2)' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#00b0f0' }}>Data Efficiency</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc', lineHeight: '1.4' }}>
          This dashboard uses <strong style={{ color: '#fff' }}>getCountFromServer()</strong>. This securely calculates live metrics directly on the Firebase servers without downloading documents, completely avoiding massive database read costs.
        </p>
      </div>

    </div>
  );
}
