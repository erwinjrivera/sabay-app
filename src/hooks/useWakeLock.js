import { useEffect, useRef } from 'react';

export default function useWakeLock() {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Screen Wake Lock acquired.');

          wakeLockRef.current.addEventListener('release', () => {
            console.log('Screen Wake Lock released.');
          });
        }
      } catch (err) {
        console.warn(`Wake Lock API error: ${err.name}, ${err.message}`);
      }
    };

    // Browsers often release the wake lock when the window becomes inactive (e.g. backgrounded).
    // We need to re-acquire it when the window becomes visible again.
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
          .then(() => { wakeLockRef.current = null; })
          .catch(console.error);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
