import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification, updateProfile } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
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

  const value = { currentUser, loginGoogle, loginEmail, signupEmail, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
