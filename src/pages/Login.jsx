import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import MapBackground from '../components/MapBackground';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  
  const { currentUser, loginGoogle, loginEmail, signupEmail, resetPassword } = useAuth();
  const navigate = useNavigate();

  const getFriendlyErrorMessage = (errMsg) => {
    if (errMsg.includes('auth/email-already-in-use')) return 'This email is already registered. Please sign in instead.';
    if (errMsg.includes('auth/invalid-email')) return 'Please enter a valid email address.';
    if (errMsg.includes('auth/weak-password')) return 'Your password should be at least 6 characters.';
    if (errMsg.includes('auth/user-not-found') || errMsg.includes('auth/wrong-password') || errMsg.includes('auth/invalid-credential')) return 'Invalid email or password.';
    if (errMsg.includes('auth/missing-email')) return 'Please enter your email address.';
    if (errMsg.includes('verify your email')) return errMsg;
    return 'An error occurred. Please try again.';
  };

  useEffect(() => {
    // If user is already logged in (Google auto-verify, or email was verified)
    if (currentUser && currentUser.emailVerified !== false) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isLogin) {
        await loginEmail(email, password);
        navigate('/');
      } else {
        await signupEmail(email, password);
        setMessage('Registration successful! Please check your email inbox to verify your account.');
        setIsLogin(true); // Switch to login view for them
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Please check your inbox.');
      setIsResetMode(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
    }
  };

  const handleGoogle = async () => {
    try {
      await loginGoogle();
      navigate('/');
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
    }
  };

  return (
    <div className="home-container">
      <MapBackground />
      <div className="auth-overlay" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
        <div className="auth-box" style={{ background: 'transparent', boxShadow: 'none', padding: 0, width: '90%', maxWidth: '350px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ color: '#00b0f0', fontWeight: 800, fontSize: '2.5rem', marginBottom: '0.2rem' }}>Karsabay</h1>
            <h2 style={{ color: '#555', fontSize: '1rem', fontWeight: 500 }}>{isLogin ? 'a free carpool sharing for every Juan' : 'Create an Account'}</h2>
          </div>
          
          {error && <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
          {message && <p style={{ color: '#00b0f0', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 'bold' }}>{message}</p>}

          {isResetMode ? (
            <form onSubmit={handleResetPassword}>
              <input 
                type="email" 
                placeholder="Enter your registered email address" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <button type="submit">Send Reset Link</button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <input 
                type="email" 
                placeholder="Email address" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <button type="submit">{isLogin ? 'Sign In' : 'Sign Up'}</button>
            </form>
          )}
          
          {!isResetMode && (
             <button className="google-btn" type="button" onClick={handleGoogle}>
               <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: '8px' }}>
                 <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                 <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.82 7.18l7.73 6c4.51-4.18 7.13-10.36 7.13-17.65z"/>
                 <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                 <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                 <path fill="none" d="M0 0h48v48H0z"/>
               </svg>
               Continue with Google
             </button>
          )}
          
          <p style={{textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#64748b'}}>
            {isResetMode ? (
               <span style={{color: '#00b0f0', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => { setIsResetMode(false); setError(''); setMessage(''); }}>
                 Back to Sign In
               </span>
            ) : isLogin ? (
              <>
                 <span style={{color: '#00b0f0', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => { setIsResetMode(true); setError(''); setMessage(''); }}>
                    Forgot Password?
                 </span>
                 <br/><br/>
                 Don't have an account? <span style={{color: '#00b0f0', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}>Sign Up</span>
              </>
            ) : (
              <>
                 Already have an account? <span style={{color: '#00b0f0', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}>Sign In</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
