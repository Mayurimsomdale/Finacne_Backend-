import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const useAutoLogout = (timeout = 15 * 60 * 1000) => { // Default: 15 minutes
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  const logout = useCallback(() => {
    // Clear authentication
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    
    // Show alert
    alert('Session expired due to inactivity. Please login again.');
    
    // Redirect to login
    navigate('/login');
  }, [navigate]);

  const resetTimeout = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeout);
  }, [logout, timeout]);

  useEffect(() => {
    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Reset timeout on any user activity
    const handleActivity = () => {
      resetTimeout();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Initialize timeout
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimeout]);

  return { logout };
};

export default useAutoLogout;