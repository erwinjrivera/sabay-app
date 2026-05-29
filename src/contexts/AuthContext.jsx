import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc, increment, deleteField, limit } from 'firebase/firestore';
import dayjs from 'dayjs';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  const checkOnboardingStatus = async (user) => {
    if (!user) {
      setProfileReady(false);
      return false;
    }
    try {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Load Firestore photoURL (used for uploaded profile photos)
        if (data.photoURL) {
          setUserPhotoURL(data.photoURL);
        } else if (user.photoURL && !data.photoURL) {
          // Silent sync: if user has a Google photo but it's not in Firestore, save it so others can see it
          try {
             await setDoc(doc(db, 'users', user.uid), { photoURL: user.photoURL }, { merge: true });
             setUserPhotoURL(user.photoURL);
          } catch(e) {}
        }
        if (data.isAdmin === true) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
        if (data.onboardingComplete === true) {
          setProfileReady(true);
          return true;
        }
      }
      // If doc doesn't exist or onboarding isn't complete:
      setProfileReady(false);
      setIsAdmin(false);
      return false;
    } catch (err) {
      console.error("Error checking onboarding status:", err);
      // On network error, do not overwrite profileReady state.
      // We return false here to indicate the check failed, but state remains unchanged.
      return false;
    }
  };

  // Callable by Onboarding page after saving profile
  const refreshProfile = async () => {
    if (currentUser) {
      return await checkOnboardingStatus(currentUser);
    }
    return false;
  };

  const cleanupStaleRides = useCallback(async (user) => {
    try {
      const now = Date.now();
      const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

      const offersRef = collection(db, 'rideOffers');
      const allOffersQ = query(offersRef, where('userId', '==', user.uid));
      const allOffersSnap = await getDocs(allOffersQ);

      for (const rideDoc of allOffersSnap.docs) {
        const ride = rideDoc.data();
        if (!['in_progress', 'active', 'open', 'confirmed'].includes(ride.status)) continue;

        let scheduledTime;
        if (ride.date && ride.time) {
             const datePart = dayjs(ride.date).format('YYYY-MM-DD');
             const timePart = dayjs(ride.time).format('HH:mm:ss');
             scheduledTime = dayjs(`${datePart}T${timePart}`);
        } else if (ride.time || ride.date) {
             scheduledTime = dayjs(ride.time || ride.date);
        }
        
        if (!scheduledTime || !scheduledTime.isValid()) continue;
        
        if (dayjs().diff(scheduledTime, 'hour') >= 8) {
          if (['in_progress', 'active'].includes(ride.status)) {
              // Mark Offer as completed
              await updateDoc(doc(db, 'rideOffers', rideDoc.id), { status: 'completed', expiresAt: deleteField() });
              
              // Complete all associated requests
              const reqQ = query(collection(db, 'rideRequests'), where('offeredByRideId', '==', rideDoc.id));
              const reqSnap = await getDocs(reqQ);
              
              for (const reqDoc of reqSnap.docs) {
                 const reqData = reqDoc.data();
                 if (reqData.status !== 'completed' && reqData.status !== 'cancelled') {
                     await updateDoc(doc(db, 'rideRequests', reqDoc.id), { status: 'completed', expiresAt: deleteField() });
                     
                     // Increment passenger's completed rides if they were part of the ride
                     if (reqData.status === 'confirmed' || reqData.status === 'accepted') {
                         if (reqData.userId) {
                             await setDoc(doc(db, 'users', reqData.userId), { completedRides: increment(1) }, { merge: true });
                         }
                     }
                 }
              }
          } else if (['open', 'confirmed'].includes(ride.status)) {
              // Mark Offer as expired
              await updateDoc(doc(db, 'rideOffers', rideDoc.id), { status: 'expired', expiresAt: deleteField() });
              
              // Reset all associated requests so passengers can find a new ride
              const reqQ = query(collection(db, 'rideRequests'), where('offeredByRideId', '==', rideDoc.id));
              const reqSnap = await getDocs(reqQ);
              
              for (const reqDoc of reqSnap.docs) {
                 await updateDoc(doc(db, 'rideRequests', reqDoc.id), { status: 'open', offeredByRideId: null });
              }
          }
        }
      }

      const reqsQ = query(collection(db, 'rideRequests'), where('userId', '==', user.uid));
      const reqsSnap = await getDocs(reqsQ);

      for (const reqDoc of reqsSnap.docs) {
        const req = reqDoc.data();
        if (['completed', 'cancelled', 'expired'].includes(req.status)) continue;

        let scheduledTime;
        if (req.date && req.time) {
             const datePart = dayjs(req.date).format('YYYY-MM-DD');
             const timePart = dayjs(req.time).format('HH:mm:ss');
             scheduledTime = dayjs(`${datePart}T${timePart}`);
        } else if (req.time || req.date) {
             scheduledTime = dayjs(req.time || req.date);
        }
        
        if (!scheduledTime || !scheduledTime.isValid()) continue;
        
        if (dayjs().diff(scheduledTime, 'hour') >= 8) {
          // Verify it's not linked to an in-progress driver ride
          let isLinkedToActiveRide = false;
          if (req.offeredByRideId) {
             try {
                const offerSnap = await getDoc(doc(db, 'rideOffers', req.offeredByRideId));
                if (offerSnap.exists()) {
                   const offerData = offerSnap.data();
                   if (['in_progress', 'active'].includes(offerData.status)) {
                       isLinkedToActiveRide = true;
                   }
                }
             } catch (e) { console.error(e); }
          }

          if (!isLinkedToActiveRide) {
             await updateDoc(doc(db, 'rideRequests', reqDoc.id), { status: 'expired', expiresAt: deleteField() });
          }
        }
      }

    } catch (err) {
      console.error("Error cleaning up stale rides:", err);
    }
  }, []);

  const runDecentralizedSweep = async () => {
    // Only run ~10% of the time to save global read costs, or just run limit(5) always to be safe
    // Since limit(5) is extremely cheap, we'll run it every time someone opens the app to guarantee system health.
    try {
      const sweepCollection = async (colName) => {
          // 1. Sweep already-migrated rides that have naturally expired
          const q = query(collection(db, colName), where('expiresAt', '<', Date.now()), limit(5));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
             const data = d.data();
             if (data.status === 'open' || data.status === 'confirmed') {
                 await updateDoc(doc(db, colName, d.id), { status: 'expired', expiresAt: deleteField() });
                 
                 // If this is an offer, release all passenger locks globally
                 if (colName === 'rideOffers') {
                     const reqQ = query(collection(db, 'rideRequests'), where('offeredByRideId', '==', d.id));
                     const reqSnap = await getDocs(reqQ);
                     for (const reqDoc of reqSnap.docs) {
                        await updateDoc(doc(db, 'rideRequests', reqDoc.id), { status: 'open', offeredByRideId: null });
                     }
                 }
             } else {
                 // Self-healing: if the ride is already terminated but still has expiresAt, strip it.
                 await updateDoc(doc(db, colName, d.id), { expiresAt: deleteField() });
             }
          }

          // 2. Self-healing migration for ghost rides (those lacking expiresAt)
          const migrationQ = query(collection(db, colName), where('status', '==', 'open'), limit(10));
          const migrationSnap = await getDocs(migrationQ);
          for (const d of migrationSnap.docs) {
              const data = d.data();
              if (data.expiresAt === undefined) {
                  let scheduledTime = dayjs();
                  if (data.date && data.time) {
                       const datePart = dayjs(data.date).format('YYYY-MM-DD');
                       const timePart = dayjs(data.time).format('HH:mm:ss');
                       scheduledTime = dayjs(`${datePart}T${timePart}`);
                  } else if (data.time || data.date) {
                       scheduledTime = dayjs(data.time || data.date);
                  }
                  
                  if (!scheduledTime || !scheduledTime.isValid()) continue;
                  
                  // If it's already older than 8 hours past schedule, expire it immediately
                  if (dayjs().diff(scheduledTime, 'hour') >= 8) {
                      await updateDoc(doc(db, colName, d.id), { status: 'expired' });
                  } else {
                      // Migrate it so future expiresAt sweeps will catch it natively
                      const newExp = scheduledTime.add(8, 'hour').valueOf();
                      await updateDoc(doc(db, colName, d.id), { expiresAt: newExp });
                  }
              }
          }
      };

      await sweepCollection('rideOffers');
      await sweepCollection('rideRequests');
    } catch (e) {
       console.error("Decentralized sweep encountered an error", e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsCheckingProfile(true);
      setCurrentUser(user);
      if (user && user.emailVerified !== false) {
        await checkOnboardingStatus(user);
        cleanupStaleRides(user);
        runDecentralizedSweep();
      } else {
        setProfileReady(false);
        setIsAdmin(false);
      }
      setIsCheckingProfile(false);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const loginEmail = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (!userCredential.user.emailVerified) {
      await signOut(auth);
      throw new Error("Please verify your email address before logging in.");
    }
    return userCredential;
  };

  const signupEmail = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Leverage the Firebase universally unique ID (UID) chunk instead of Math.random
    const randomName = `User_${userCredential.user.uid.substring(0, 8)}`;
    
    await updateProfile(userCredential.user, { displayName: randomName });

    await sendEmailVerification(userCredential.user);
    await signOut(auth);
    return userCredential;
  };
  const logout = () => signOut(auth);

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const value = { currentUser, profileReady, isCheckingProfile, isAdmin, userPhotoURL, setUserPhotoURL, loginGoogle, loginEmail, signupEmail, logout, resetPassword, refreshProfile, cleanupStaleRides };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
