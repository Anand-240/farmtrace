import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions');
  const [notifFilter, setNotifFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [txRes, notifRes] = await Promise.all([
        api.get('/api/payment/transactions'),
        api.get('/api/payment/notifications')
      ]);
      setTransactions(txRes.data);
      setNotifications(notifRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const markRead = async (id) => {
    await api.put(`/api/payment/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'UNREAD') return !n.isRead;
    if (notifFilter === 'PAYMENTS') return n.type === 'PAYMENT_RECEIVED';
    if (notifFilter === 'TRANSFER') return ['TRANSFER_COMPLETE', 'REQUEST_RECEIVED', 'DELIVERY_UPDATE', 'LOCATION_SHIFT'].includes(n.type);
    return true;
  });

  const notifConfig = {
    PAYMENT_RECEIVED:  { bg: '#dcfce7', color: '#166534', icon: '₹', label: 'Payment' },
    TRANSFER_COMPLETE: { bg: '#dbeafe', color: '#1e40af', icon: '✓', label: 'Transfer' },
    REQUEST_RECEIVED:  { bg: '#fef3c7', color: '#92400e', icon: '!', label: 'Request' },
    DELIVERY_UPDATE:   { bg: '#ede9fe', color: '#6d28d9', icon: '🚚', label: 'Delivery' },
    LOCATION_SHIFT:    { bg: '#fee2e2', color: '#991b1b', icon: '📍', label: 'Location' },
  };

  return (
    <div style={s.page}>
      {/* TOP BAR */}
      <div style={s.topbar}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
        <div style={s.topbarTitle}>
          <span style={{ fontSize: '1.2rem' }}>📋</span>
          <span style={s.topbarText}>History & Notifications</span>
        </div>
        {unreadCount > 0 && (
          <span style={s.unreadChip}>{unreadCount} unread</span>
        )}
      </div>

      <div style={s.inner}>
        {/* TABS */}
        <div style={s.tabBar}>
          <button
            style={{ ...s.tab, ...(activeTab === 'transactions' ? s.tabActive : {}) }}
            onClick={() => setActiveTab('transactions')}
          >
            💸 Transactions ({transactions.length})
          </button>
          <button
            style={{ ...s.tab, ...(activeTab === 'notifications' ? s.tabActive : {}) }}
            onClick={() => setActiveTab('notifications')}
          >
            🔔 Notifications
            {unreadCount > 0 && <span style={s.badge}>{unreadCount}</span>}
          </button>
        </div>

        {loading ? (
          <div style={s.loadingWrap}>
            <div style={s.loadingDot} />
            <p style={s.loadingText}>Load ho raha hai...</p>
          </div>
        ) : (
          <>
            {/* ─── TRANSACTIONS ─── */}
            {activeTab === 'transactions' && (
              <div>
                {transactions.length === 0 ? (
                  <div style={s.empty}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💸</div>
                    <p style={s.emptyTitle}>Koi transaction nahi mili</p>
                    <p style={s.emptySub}>Jab aap payment karenge ya receive karenge, yahan dikhegi</p>
                  </div>
                ) : (
                  transactions.map((t, idx) => {
                    const isSent = t.fromPhone === user.phone;
                    return (
                      <div key={t._id} style={{ ...s.txCard, animationDelay: `${idx * 0.04}s` }}>
                        <div style={s.txIconWrap}>
                          <div style={{ ...s.txIcon, background: isSent ? '#fee2e2' : '#dcfce7', color: isSent ? '#dc2626' : '#16a34a' }}>
                            {isSent ? '↑' : '↓'}
                          </div>
                        </div>
                        <div style={s.txBody}>
                          <div style={s.txTitle}>{t.cropType}</div>
                          <div style={s.txSub}>
                            {isSent ? `→ ${t.toName || t.toPhone}` : `← ${t.fromName || t.fromPhone}`}
                          </div>
                          {t.pricePerKg && (
                            <div style={s.txSub}>₹{t.pricePerKg}/kg × {t.quantity}kg</div>
                          )}
                          <div style={s.txDate}>
                            📅 {new Date(t.createdAt).toLocaleDateString('hi-IN')}
                          </div>
                          {t.txHash && (
                            <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" style={s.txLink}>
                              🔗 Blockchain proof →
                            </a>
                          )}
                        </div>
                        <div style={s.txRight}>
                          <div style={{ ...s.txAmount, color: isSent ? '#dc2626' : '#16a34a' }}>
                            {isSent ? '-' : '+'}₹{t.amount?.toLocaleString()}
                          </div>
                          <span style={s.txStatus}>{t.status}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ─── NOTIFICATIONS ─── */}
            {activeTab === 'notifications' && (
              <div>
                <div style={s.filterRow}>
                  {['ALL', 'UNREAD', 'PAYMENTS', 'TRANSFER'].map(f => (
                    <button key={f} style={{ ...s.filterBtn, ...(notifFilter === f ? s.filterBtnActive : {}) }} onClick={() => setNotifFilter(f)}>
                      {f === 'ALL' ? 'Sabhi' : f === 'UNREAD' ? 'Unread' : f === 'PAYMENTS' ? '₹ Payments' : '🚚 Transfer'}
                    </button>
                  ))}
                </div>

                {filteredNotifications.length === 0 ? (
                  <div style={s.empty}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔔</div>
                    <p style={s.emptyTitle}>Koi notification nahi</p>
                    <p style={s.emptySub}>Is filter mein abhi koi update nahi hai</p>
                  </div>
                ) : (
                  filteredNotifications.map((n, idx) => {
                    const cfg = notifConfig[n.type] || { bg: '#f4f8f0', color: '#5a7050', icon: '•', label: 'Update' };
                    return (
                      <div
                        key={n._id}
                        style={{ ...s.notifCard, opacity: n.isRead ? 0.65 : 1, cursor: n.isRead ? 'default' : 'pointer', animationDelay: `${idx * 0.04}s` }}
                        onClick={() => !n.isRead && markRead(n._id)}
                      >
                        <div style={{ ...s.notifIcon, background: cfg.bg, color: cfg.color }}>
                          <span style={{ fontSize: '1.1rem' }}>{cfg.icon}</span>
                        </div>
                        <div style={s.notifBody}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                            <span style={s.notifTitle}>{n.title}</span>
                            <span style={{ ...s.notifTypeBadge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <p style={s.notifMsg}>{n.message}</p>
                          <p style={s.notifDate}>📅 {new Date(n.createdAt).toLocaleDateString('hi-IN')}</p>
                        </div>
                        {!n.isRead && <div style={s.unreadDot} />}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg, #f4f8f0 0%, #eef5e7 50%, #e8f0e0 100%)', fontFamily: "'Outfit', sans-serif" },
  topbar: { position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #d4e4c8', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 2px 10px rgba(15,45,9,0.07)' },
  backBtn: { width: 38, height: 38, borderRadius: 10, background: '#f3fae8', border: '1px solid #d4e4c8', color: '#27500a', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' },
  topbarTitle: { display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 },
  topbarText: { fontWeight: 800, fontSize: '1.05rem', color: '#0f1f0d' },
  unreadChip: { background: '#ef4444', color: '#fff', borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 800 },
  inner: { maxWidth: 700, margin: '0 auto', padding: '1rem 1rem 3rem' },
  tabBar: { display: 'flex', gap: '0.5rem', background: '#fff', borderRadius: 14, padding: '0.35rem', marginBottom: '1rem', border: '1px solid #d4e4c8', boxShadow: '0 2px 8px rgba(15,45,9,0.07)' },
  tab: { flex: 1, padding: '0.7rem 0.5rem', border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent', color: '#5a7050', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' },
  tabActive: { background: 'linear-gradient(135deg, #27500a, #3a7510)', color: '#fff', boxShadow: '0 4px 12px rgba(39,80,10,0.3)' },
  badge: { background: '#ef4444', color: '#fff', borderRadius: 999, width: 18, height: 18, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  loadingWrap: { textAlign: 'center', marginTop: '3rem' },
  loadingDot: { width: 40, height: 40, borderRadius: '50%', border: '3px solid #d4e4c8', borderTopColor: '#27500a', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' },
  loadingText: { color: '#5a7050', fontWeight: 600 },
  empty: { textAlign: 'center', padding: '3rem 1.5rem', background: '#fff', borderRadius: 18, border: '2px dashed #d4e4c8', marginTop: '0.5rem' },
  emptyTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#0f1f0d', margin: '0 0 0.4rem' },
  emptySub: { fontSize: '0.88rem', color: '#5a7050', lineHeight: 1.6 },
  txCard: { background: '#fff', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.9rem', border: '1.5px solid #d4e4c8', boxShadow: '0 4px 14px rgba(15,45,9,0.09)', animation: 'slideUp 0.3s ease both', transition: 'transform 0.2s' },
  txIconWrap: { flexShrink: 0 },
  txIcon: { width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800 },
  txBody: { flex: 1, minWidth: 0 },
  txTitle: { fontWeight: 800, fontSize: '0.98rem', color: '#0f1f0d', marginBottom: '0.2rem' },
  txSub: { fontSize: '0.8rem', color: '#5a7050', margin: '0.1rem 0', fontWeight: 500 },
  txDate: { fontSize: '0.76rem', color: '#8aa07a', marginTop: '0.3rem' },
  txLink: { display: 'inline-block', marginTop: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#0369a1' },
  txRight: { textAlign: 'right', flexShrink: 0 },
  txAmount: { fontWeight: 900, fontSize: '1.05rem', marginBottom: '0.3rem' },
  txStatus: { background: '#dcfce7', color: '#166534', padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.9rem' },
  filterBtn: { border: '1.5px solid #d4e4c8', background: '#f3fae8', color: '#2d4428', padding: '0.38rem 0.7rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  filterBtnActive: { background: '#27500a', borderColor: '#27500a', color: '#fff', boxShadow: '0 3px 10px rgba(39,80,10,0.25)' },
  notifCard: { background: '#fff', borderRadius: 14, padding: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.85rem', border: '1.5px solid #d4e4c8', boxShadow: '0 4px 14px rgba(15,45,9,0.09)', animation: 'slideUp 0.3s ease both', transition: 'all 0.2s' },
  notifIcon: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifBody: { flex: 1, minWidth: 0 },
  notifTitle: { fontWeight: 800, fontSize: '0.95rem', color: '#0f1f0d' },
  notifTypeBadge: { borderRadius: 999, padding: '0.12rem 0.5rem', fontSize: '0.68rem', fontWeight: 800 },
  notifMsg: { fontSize: '0.85rem', color: '#2d4428', margin: '0.2rem 0', lineHeight: 1.5 },
  notifDate: { fontSize: '0.75rem', color: '#8aa07a', marginTop: '0.2rem' },
  unreadDot: { width: 10, height: 10, borderRadius: '50%', background: '#27500a', flexShrink: 0, marginTop: 4 },
};
