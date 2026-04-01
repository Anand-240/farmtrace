import React, { createContext, useContext, useState, useCallback } from 'react';
import NotificationHub from '../components/NotificationHub';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newNotif = {
      id,
      message,
      title: options.title || 'FarmTrace Alert',
      type: options.type || 'whatsapp', // 'whatsapp', 'sms', 'system'
      duration: options.duration || 6000,
    };

    setNotifications(prev => [...prev, newNotif]);

    // Auto remove
    setTimeout(() => {
      removeNotification(id);
    }, newNotif.duration);
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <NotificationHub notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
};
