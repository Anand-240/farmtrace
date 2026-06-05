import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions');
  const [notifFilter, setNotifFilter] = useState('ALL');
  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Normalize local user phone to match API +91 format
  const rawUser = JSON.parse(localStorage.getItem('user') || '{}');
  if (rawUser.phone && !rawUser.phone.startsWith('+')) {
    if (rawUser.phone.length === 10) rawUser.phone = '+91' + rawUser.phone;
    else if (rawUser.phone.length === 12 && rawUser.phone.startsWith('91')) rawUser.phone = '+' + rawUser.phone;
  }
  const user = rawUser;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const txPromise = api.get('/payment/transactions')
        .then(res => {
          if (Array.isArray(res.data)) setTransactions(res.data);
        })
        .catch(err => console.error('Transactions load error:', err));

      const notifPromise = api.get('/payment/notifications')
        .then(res => {
          if (Array.isArray(res.data)) setNotifications(res.data);
        })
        .catch(err => console.error('Notifications load error:', err));

      await Promise.allSettled([txPromise, notifPromise]);
    } catch (err) { 
      console.error('FetchData error:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const markRead = async (id) => {
    await api.put(`/payment/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const TX_STATUS_STYLES = {
    COMPLETED:    { background: '#dcfce7', color: '#166534' },
    BOOKING_PAID: { background: '#dbeafe', color: '#1e40af' },
    PENDING:      { background: '#fef9c3', color: '#854d0e' },
    FAILED:       { background: '#fee2e2', color: '#991b1b' },
    CANCELLED:    { background: '#f3f4f6', color: '#6b7280' },
  };
  const statusStyle = (status) => TX_STATUS_STYLES[status] || { background: '#f3f4f6', color: '#374151' };

  const filteredTransactions = transactions.filter(t => {
    if (txStatusFilter === 'ALL') return true;
    return t.status === txStatusFilter;
  });

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
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}><ArrowLeft size={20} /></button>
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
                <div style={s.filterRow}>
                  {['ALL', 'PENDING', 'COMPLETED', 'FAILED'].map(f => (
                    <button key={f} style={{ ...s.filterBtn, ...(txStatusFilter === f ? s.filterBtnActive : {}) }} onClick={() => setTxStatusFilter(f)}>
                      {f === 'ALL' ? 'Sabhi' : f}
                    </button>
                  ))}
                </div>
                {filteredTransactions.length === 0 ? (
                  <div style={s.empty}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💸</div>
                    <p style={s.emptyTitle}>Koi transaction nahi mili</p>
                    <p style={s.emptySub}>Jab aap payment karenge ya receive karenge, yahan dikhegi</p>
                  </div>
                ) : (
                  filteredTransactions.map((t, idx) => {
                    const isSent = t.fromPhone === user.phone;
                    const txDate = new Date(t.createdAt);
                    const dateStr = txDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeStr = txDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
                            {isSent
                              ? <><span style={{ color: '#9ca3af', fontWeight: 700 }}>To: </span>{t.toName || t.toPhone}</>
                              : <><span style={{ color: '#9ca3af', fontWeight: 700 }}>From: </span>{t.fromName || t.fromPhone}</>
                            }
                          </div>
                          {t.pricePerKg && (
                            <div style={s.txSub}>₹{t.pricePerKg}/kg × {t.quantity}kg</div>
                          )}
                          <div style={s.txDate}>
                            📅 {dateStr} · ⏰ {timeStr}
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
                          <span style={{ ...s.txStatus, ...statusStyle(t.status) }}>{t.status}</span>
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
                          <p style={s.notifDate}>📅 {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ⏰ {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
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
  page: { minHeight: '100vh', background: 'var(--ft-bg)', fontFamily: 'var(--ft-font-main)' },
  topbar: { position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(15px)', borderBottom: '1px solid var(--ft-border)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  backBtn: { width: 44, height: 44, borderRadius: 12, background: 'var(--ft-white)', border: '1px solid var(--ft-border)', color: 'var(--ft-forest)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'var(--ft-transition)' },
  topbarTitle: { display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 },
  topbarText: { fontWeight: 800, fontSize: '1.25rem', color: 'var(--ft-forest)', letterSpacing: '-0.02em' },
  unreadChip: { background: 'var(--ft-error)', color: '#fff', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' },
  inner: { maxWidth: 800, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' },
  tabBar: { display: 'flex', gap: '0.75rem', background: 'var(--ft-white)', borderRadius: '16px', padding: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)' },
  tab: { flex: 1, padding: '0.85rem 0.5rem', border: 'none', borderRadius: '12px', cursor: 'pointer', background: 'transparent', color: 'var(--ft-text-muted)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'var(--ft-transition)' },
  tabActive: { background: 'var(--ft-forest)', color: '#fff', boxShadow: 'var(--ft-shadow)' },
  badge: { background: 'var(--ft-error)', color: '#fff', borderRadius: 999, minWidth: 20, height: 20, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, padding: '0 4px' },
  loadingWrap: { textAlign: 'center', marginTop: '6rem' },
  loadingDot: { width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--ft-border)', borderTopColor: 'var(--ft-forest)', margin: '0 auto 1.25rem', animation: 'ft-spin 0.75s linear infinite' },
  loadingText: { color: 'var(--ft-text-muted)', fontWeight: 600 },
  empty: { textAlign: 'center', padding: '4rem 2rem', background: 'var(--ft-white)', borderRadius: 'var(--ft-radius-lg)', border: '1px dashed var(--ft-sage)', marginTop: '0.5rem' },
  emptyTitle: { fontSize: '1.25rem', fontWeight: 800, color: 'var(--ft-forest)', margin: '0 0 0.5rem' },
  emptySub: { fontSize: '0.95rem', color: 'var(--ft-text-muted)', lineHeight: 1.6 },
  txCard: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius)', padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)', transition: 'var(--ft-transition)' },
  txIconWrap: { flexShrink: 0 },
  txIcon: { width: 48, height: 48, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 800 },
  txBody: { flex: 1, minWidth: 0 },
  txTitle: { fontWeight: 800, fontSize: '1.1rem', color: 'var(--ft-forest)', marginBottom: '0.25rem' },
  txSub: { fontSize: '0.85rem', color: 'var(--ft-text-muted)', margin: '0.15rem 0', fontWeight: 500 },
  txDate: { fontSize: '0.8rem', color: 'var(--ft-sage)', marginTop: '0.5rem', fontWeight: 600 },
  txLink: { display: 'inline-block', marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-forest)', textDecoration: 'underline' },
  txRight: { textAlign: 'right', flexShrink: 0 },
  txAmount: { fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' },
  txStatus: { padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' },
  filterBtn: { border: '1px solid var(--ft-border)', background: 'var(--ft-white)', color: 'var(--ft-text-muted)', padding: '0.5rem 1.25rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'var(--ft-transition)' },
  filterBtnActive: { background: 'var(--ft-sage-light)', borderColor: 'var(--ft-forest)', color: 'var(--ft-forest)' },
  notifCard: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius)', padding: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '1.25rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)', transition: 'var(--ft-transition)', position: 'relative', overflow: 'hidden' },
  notifIcon: { width: 48, height: 48, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' },
  notifBody: { flex: 1, minWidth: 0 },
  notifTitle: { fontWeight: 800, fontSize: '1.05rem', color: 'var(--ft-forest)', marginBottom: '0.25rem' },
  notifTypeBadge: { borderRadius: 999, padding: '0.15rem 0.65rem', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  notifMsg: { fontSize: '0.95rem', color: 'var(--ft-text)', margin: '0.5rem 0', lineHeight: 1.6 },
  notifDate: { fontSize: '0.8rem', color: 'var(--ft-sage)', marginTop: '0.5rem', fontWeight: 600 },
  unreadDot: { position: 'absolute', top: '1.25rem', right: '1.25rem', width: 10, height: 10, borderRadius: '50%', background: 'var(--ft-error)', boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)' },
};

