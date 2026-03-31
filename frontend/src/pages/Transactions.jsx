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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txRes, notifRes] = await Promise.all([
        api.get('/api/payment/transactions'),
        api.get('/api/payment/notifications')
      ]);
      setTransactions(txRes.data);
      setNotifications(notifRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    await api.put(`/api/payment/notifications/${id}/read`);
    setNotifications(prev =>
      prev.map(n => n._id === id ? {...n, isRead: true} : n)
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'UNREAD') {
      return !n.isRead;
    }

    if (notifFilter === 'PAYMENTS') {
      return n.type === 'PAYMENT_RECEIVED';
    }

    if (notifFilter === 'TRANSFER') {
      return n.type === 'TRANSFER_COMPLETE' || n.type === 'REQUEST_RECEIVED';
    }

    return true;
  });

  const notifColor = {
    PAYMENT_RECEIVED: { bg: '#EAF3DE', color: '#27500A', icon: '₹' },
    TRANSFER_COMPLETE: { bg: '#E1F5EE', color: '#085041', icon: '✓' },
    REQUEST_RECEIVED: { bg: '#FAEEDA', color: '#854F0B', icon: '!' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Dashboard
        </button>
        <h2 style={styles.title}>History</h2>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{...styles.tab, ...(activeTab==='transactions' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('transactions')}>
          Transactions ({transactions.length})
        </button>
        <button
          style={{...styles.tab, ...(activeTab==='notifications' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('notifications')}>
          Notifications {unreadCount > 0 && (
            <span style={styles.badge}>{unreadCount}</span>
          )}
        </button>
      </div>

      {loading ? (
        <p style={styles.loading}>Load ho raha hai...</p>
      ) : (
        <>
          {/* Transactions */}
          {activeTab === 'transactions' && (
            <div>
              {transactions.length === 0 ? (
                <div style={styles.empty}>
                  <p>Abhi koi transaction nahi hui</p>
                </div>
              ) : (
                transactions.map(t => {
                  const isSent = t.fromPhone === user.phone;
                  return (
                    <div key={t._id} style={styles.txCard}>
                      <div style={styles.txLeft}>
                        <div style={{
                          ...styles.txIcon,
                          background: isSent ? '#FCEBEB' : '#EAF3DE',
                          color: isSent ? '#791F1F' : '#27500A'
                        }}>
                          {isSent ? '↑' : '↓'}
                        </div>
                        <div>
                          <p style={styles.txTitle}>{t.cropType}</p>
                          <p style={styles.txSub}>
                            {isSent ? `Ko: ${t.toName || t.toPhone}` : `Se: ${t.fromName || t.fromPhone}`}
                          </p>
                          <p style={styles.txSub}>
                            {t.pricePerKg && `₹${t.pricePerKg}/kg × ${t.quantity}kg`}
                          </p>
                          <p style={styles.txDate}>
                            {new Date(t.createdAt).toLocaleDateString('hi-IN')}
                          </p>
                          {t.txHash && (
                            <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`}
                              target="_blank" rel="noreferrer" style={styles.txLink}>
                              Blockchain proof →
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p style={{
                          ...styles.txAmount,
                          color: isSent ? '#791F1F' : '#27500A'
                        }}>
                          {isSent ? '-' : '+'}₹{t.amount?.toLocaleString()}
                        </p>
                        <span style={styles.txStatus}>{t.status}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div>
              <div style={styles.notifFilters}>
                <button
                  style={{ ...styles.notifFilterBtn, ...(notifFilter === 'ALL' ? styles.notifFilterBtnActive : {}) }}
                  onClick={() => setNotifFilter('ALL')}
                >
                  All
                </button>
                <button
                  style={{ ...styles.notifFilterBtn, ...(notifFilter === 'UNREAD' ? styles.notifFilterBtnActive : {}) }}
                  onClick={() => setNotifFilter('UNREAD')}
                >
                  Unread only
                </button>
                <button
                  style={{ ...styles.notifFilterBtn, ...(notifFilter === 'PAYMENTS' ? styles.notifFilterBtnActive : {}) }}
                  onClick={() => setNotifFilter('PAYMENTS')}
                >
                  Payments only
                </button>
                <button
                  style={{ ...styles.notifFilterBtn, ...(notifFilter === 'TRANSFER' ? styles.notifFilterBtnActive : {}) }}
                  onClick={() => setNotifFilter('TRANSFER')}
                >
                  Transfer only
                </button>
              </div>

              {filteredNotifications.length === 0 ? (
                <div style={styles.empty}>
                  <p>Is filter me koi notification nahi</p>
                </div>
              ) : (
                filteredNotifications.map(n => {
                  const style = notifColor[n.type] || { bg: '#f0f4f0', color: '#444', icon: '•' };
                  return (
                    <div key={n._id}
                      style={{...styles.notifCard, opacity: n.isRead ? 0.7 : 1}}
                      onClick={() => !n.isRead && markRead(n._id)}>
                      <div style={{...styles.notifIcon, background: style.bg, color: style.color}}>
                        {style.icon}
                      </div>
                      <div style={{flex:1}}>
                        <p style={styles.notifTitle}>{n.title}</p>
                        <p style={styles.notifMsg}>{n.message}</p>
                        <p style={styles.notifDate}>
                          {new Date(n.createdAt).toLocaleDateString('hi-IN')}
                        </p>
                      </div>
                      {!n.isRead && <div style={styles.unreadDot}/>}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', padding:'1rem' },
  header: { display:'flex', alignItems:'center', gap:'1rem', background:'#fff', padding:'1rem 1.2rem', borderRadius:'14px', marginBottom:'1rem', border:'1px solid #dbe5d8', boxShadow:'0 8px 22px rgba(26, 44, 33, 0.08)' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', fontSize:'0.9rem', padding:0 },
  title: { color:'#1f3320', margin:0, fontSize:'1.2rem' },
  tabs: { display:'flex', background:'#fff', borderRadius:'10px', padding:'0.25rem', marginBottom:'1rem', gap:'0.25rem', border:'1px solid #dbe5d8' },
  tab: { flex:1, padding:'0.6rem', border:'none', borderRadius:'6px', cursor:'pointer', background:'transparent', color:'#666', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' },
  activeTab: { background:'#27500A', color:'white' },
  badge: { background:'#E24B4A', color:'white', borderRadius:'50%', width:'18px', height:'18px', fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center' },
  loading: { textAlign:'center', color:'#5f7167', marginTop:'2rem' },
  empty: { textAlign:'center', color:'#5f7167', padding:'2.4rem', background:'#fff', borderRadius:'14px', border:'1px solid #dbe5d8' },
  txCard: { background:'#fff', padding:'1rem 1.1rem', borderRadius:'14px', marginBottom:'0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #dbe5d8', boxShadow:'0 8px 20px rgba(26, 44, 33, 0.07)' },
  txLeft: { display:'flex', gap:'1rem', alignItems:'flex-start' },
  txIcon: { width:'40px', height:'40px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', fontWeight:'bold', flexShrink:0 },
  txTitle: { color:'#2a3b31', fontWeight:'bold', margin:'0 0 0.2rem', fontSize:'0.95rem' },
  txSub: { color:'#708078', fontSize:'0.8rem', margin:'0.1rem 0' },
  txDate: { color:'#aaa', fontSize:'0.75rem', margin:'0.2rem 0 0' },
  txLink: { color:'#0a5a79', fontSize:'0.75rem' },
  txAmount: { fontWeight:'bold', fontSize:'1.1rem', margin:'0 0 0.25rem' },
  txStatus: { background:'#EAF3DE', color:'#27500A', padding:'0.15rem 0.5rem', borderRadius:'20px', fontSize:'0.75rem' },
  notifCard: { background:'#fff', padding:'1rem', borderRadius:'14px', marginBottom:'0.75rem', display:'flex', gap:'1rem', alignItems:'flex-start', cursor:'pointer', border:'1px solid #dbe5d8', boxShadow:'0 8px 20px rgba(26, 44, 33, 0.07)' },
  notifIcon: { width:'40px', height:'40px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', fontWeight:'bold', flexShrink:0 },
  notifTitle: { color:'#2a3b31', fontWeight:'bold', margin:'0 0 0.25rem', fontSize:'0.95rem' },
  notifMsg: { color:'#55655d', fontSize:'0.85rem', margin:'0 0 0.25rem', lineHeight:1.4 },
  notifDate: { color:'#aaa', fontSize:'0.75rem', margin:0 },
  unreadDot: { width:'10px', height:'10px', borderRadius:'50%', background:'#27500A', flexShrink:0, marginTop:'4px' },
  notifFilters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    marginBottom: '0.8rem'
  },
  notifFilterBtn: {
    border: '1px solid #d4e0d1',
    background: '#f5f9f4',
    color: '#3e5547',
    padding: '0.38rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  notifFilterBtnActive: {
    background: '#27500A',
    borderColor: '#27500A',
    color: '#fff'
  }
};
