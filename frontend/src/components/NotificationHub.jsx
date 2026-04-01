import React from 'react';
import { MessageCircle, MessageSquare, X, ShieldAlert } from 'lucide-react';
import './NotificationHub.css';

export default function NotificationHub({ notifications, onClose }) {
  if (!notifications.length) return null;

  return (
    <div className="notification-hub">
      {notifications.map(notif => {
        const isWhatsapp = notif.type === 'whatsapp';
        const isSms = notif.type === 'sms';
        
        return (
          <div key={notif.id} className={`notif-card ${isWhatsapp ? 'whatsapp-style' : isSms ? 'sms-style' : 'system-style'}`}>
            <div className="notif-header">
              <div className="notif-brand">
                {isWhatsapp ? <MessageCircle size={16} color="#25D366" /> : 
                 isSms ? <MessageSquare size={16} color="#007AFF" /> : 
                 <ShieldAlert size={16} color="#f57c00" />}
                <span>{notif.title}</span>
              </div>
              <button className="notif-close" onClick={() => onClose(notif.id)}><X size={14} /></button>
            </div>
            <div className="notif-body">
              <p>{notif.message}</p>
              <span className="notif-time">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
