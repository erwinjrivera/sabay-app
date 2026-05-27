/**
 * Requests native browser notification permission.
 * Safe to call multiple times as it checks existing permissions.
 */
export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};

/**
 * Triggers a browser notification if permission is granted.
 * Uses sessionStorage to prevent duplicate notifications for the same event ID.
 * 
 * @param {string} eventId - Unique ID for the event (e.g., 'new_match_rideId_matchId')
 * @param {string} title - The notification title
 * @param {Object} options - Standard notification options (body, icon, etc.)
 */
export const sendRideNotification = async (eventId, title, options = {}) => {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notifiedEvents = JSON.parse(sessionStorage.getItem('sabay_notified_events') || '{}');
    
    // If we have already notified this exact event, ignore to prevent spam
    if (notifiedEvents[eventId]) {
      return;
    }

    new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...options
    });

    // Mark as notified for this session
    notifiedEvents[eventId] = true;
    sessionStorage.setItem('sabay_notified_events', JSON.stringify(notifiedEvents));
  } catch (error) {
    console.error('Failed to send ride notification:', error);
  }
};
