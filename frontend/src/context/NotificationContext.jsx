import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import NotificationHub from '../components/NotificationHub';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

// In dev, connect directly to the backend port. In production connect to the absolute backend URL.
const getWsUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  const { hostname, protocol } = window.location;
  
  // Use explicit environment variable if provided
  const envUrl = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    const url = new URL(envUrl);
    return `${url.protocol}//${url.host}`;
  }

  const isLocal = ['localhost', '127.0.0.1'].includes(hostname) || hostname.startsWith('192.168.');
  if (isLocal) return `${protocol}//${hostname}:4000`;
  
  // Production fallback for FarmTrace (Render backend)
  if (hostname.includes('vercel.app')) {
    return 'https://farmtrace-backend-6xzw.onrender.com';
  }
  
  return window.location.origin;
};

const notifTypeToStyle = (type) => {
  if (type === 'PAYMENT_RECEIVED') return 'whatsapp';
  if (type === 'TRANSFER_COMPLETE') return 'system';
  return 'sms';
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newNotif = {
      id,
      message,
      title: options.title || 'FarmTrace Alert',
      type: options.type || 'whatsapp',
      duration: options.duration || 6000,
    };
    setNotifications(prev => [...prev, newNotif]);
    setTimeout(() => removeNotification(id), newNotif.duration);
  }, [removeNotification]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(getWsUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10
    });
    socketRef.current = socket;

    socket.on('notification', (notif) => {
      showNotification(notif.message, {
        title: notif.title,
        type: notifTypeToStyle(notif.type)
      });
    });

    // silently retry on auth/network errors — non-fatal
    socket.on('connect_error', () => {});

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <NotificationHub notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
};
