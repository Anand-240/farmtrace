import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Escrow() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [refundData, setRefundData] = useState({});
  const [downloading, setDownloading] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchEscrows();
  }, []);

  const fetchEscrows = async () => {
    try {
      const res = await api.get('/api/payment/escrow/my/all');
      setEscrows(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefundRequest = async (transferId) => {
    const reason = refundData[transferId];
    if (!reason?.trim()) {
      alert('Refund reason likho');
      return;
    }
    try {
      const res = await api.post(`/api/payment/escrow/${transferId}/request-refund`, {
        reason
      });
      alert(`Refund request submitted! Amount: ₹${res.data.refundAmount}`);
      fetchEscrows();
      setRefundData({...refundData, [transferId]: ''});
    } catch (err) {
      alert('Refund request fail: ' + err.message);
    }
  };

  const triggerBrowserDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const handleDocDownload = async (transferId, type, format = '') => {
    const key = `${transferId}-${type}-${format || 'default'}`;
    setDownloading((prev) => ({ ...prev, [key]: true }));

    try {
      const query = format ? `?format=${format}` : '';
      const response = await api.get(`/api/payment/docs/${transferId}/${type}${query}`, {
        responseType: 'blob'
      });

      const ext = type === 'audit-trail'
        ? (format === 'csv' ? 'csv' : 'json')
        : 'pdf';
      const filename = `${type}-${String(transferId).slice(-6)}.${ext}`;
      triggerBrowserDownload(response.data, filename);
    } catch (err) {
      alert(`Document download fail hua: ${err?.response?.data?.message || err.message}`);
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };


  const calculateProgress = (escrow) => {
    let progress = 0;
    if (escrow.bookingPaid) progress += 33.33;
    if (escrow.dispatchReleased) progress += 33.33;
    if (escrow.deliveryReleased) progress += 33.34;
    return Math.round(progress);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Dashboard
        </button>
        <h2 style={styles.title}>Escrow & Milestone Payments</h2>
      </div>

      {loading ? (
        <p style={styles.loading}>Load ho raha hai...</p>
      ) : escrows.length === 0 ? (
        <div style={styles.empty}>
          <p>Koi escrow record nahi hai</p>
          <p style={{fontSize:'0.85rem', color:'#888'}}>
            Jab payment hoga tab escrow records yahan dikhenge
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {escrows.map(item => {
            const { transfer, escrow, produce } = item;
            const progress = calculateProgress(escrow);
            const id = transfer._id;

            return (
              <div key={id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cropName}>{produce?.cropType}</h3>
                    <p style={styles.transferType}>{transfer.transferType}</p>
                  </div>
                  <span style={{...styles.badge, background: statusColor(escrow.status)}}>
                    {escrow.status}
                  </span>
                </div>

                <div style={styles.partyInfo}>
                  <p><strong>From:</strong> {transfer.fromPhone}</p>
                  <p><strong>To:</strong> {transfer.toPhone}</p>
                  <p><strong>Location:</strong> {transfer.location}</p>
                </div>

                {/* Total Amount */}
                <div style={styles.totalBox}>
                  <p style={{margin:'0 0 0.5rem', color:'#666', fontSize:'0.85rem'}}>Total Amount</p>
                  <p style={{margin:0, fontSize:'1.3rem', fontWeight:'bold', color:'#27500A'}}>
                    ₹{escrow.totalAmount.toLocaleString()}
                  </p>
                </div>

                {/* Progress Bar */}
                <div style={styles.progressContainer}>
                  <div style={{...styles.progressBar, width: `${progress}%`}}></div>
                  <p style={{margin:'0.3rem 0 0', fontSize:'0.8rem', color:'#888'}}>
                    {progress}% Released
                  </p>
                </div>

                {/* Milestone Details */}
                <div style={styles.milestoneGrid}>
                  <div style={milestoneItemStyle(escrow.bookingPaid)}>
                    <p style={{margin:0, fontSize:'0.75rem', color:'#666'}}>Booking (40%)</p>
                    <p style={{margin:'0.25rem 0 0', fontWeight:'bold', fontSize:'0.95rem'}}>
                      ₹{escrow.bookingAmount}
                    </p>
                    {escrow.bookingPaid && <p style={{margin:'0.2rem 0 0', fontSize:'0.7rem', color:'#27500A', fontWeight:'700'}}>✓ Paid</p>}
                  </div>

                  <div style={milestoneItemStyle(escrow.dispatchReleased)}>
                    <p style={{margin:0, fontSize:'0.75rem', color:'#666'}}>Dispatch (30%)</p>
                    <p style={{margin:'0.25rem 0 0', fontWeight:'bold', fontSize:'0.95rem', color: escrow.dispatchReleased ? '#27500A' : '#aaa'}}>
                      ₹{escrow.dispatchAmount}
                    </p>
                    {escrow.dispatchReleased && <p style={{margin:'0.2rem 0 0', fontSize:'0.7rem', color:'#27500A', fontWeight:'700'}}>✓ Released</p>}
                    {!escrow.dispatchReleased && <p style={{margin:'0.2rem 0 0', fontSize:'0.7rem', color:'#aaa'}}>Pending Dispatch</p>}
                  </div>

                  <div style={milestoneItemStyle(escrow.deliveryReleased)}>
                    <p style={{margin:0, fontSize:'0.75rem', color:'#666'}}>Delivery (30%)</p>
                    <p style={{margin:'0.25rem 0 0', fontWeight:'bold', fontSize:'0.95rem', color: escrow.deliveryReleased ? '#27500A' : '#aaa'}}>
                      ₹{escrow.deliveryAmount}
                    </p>
                    {escrow.deliveryReleased && <p style={{margin:'0.2rem 0 0', fontSize:'0.7rem', color:'#27500A', fontWeight:'700'}}>✓ Released</p>}
                    {!escrow.deliveryReleased && <p style={{margin:'0.2rem 0 0', fontSize:'0.7rem', color:'#aaa'}}>Pending Delivery</p>}
                  </div>
                </div>

                {/* Delivery Status */}
                <div style={styles.deliveryStatus}>
                  <p style={{margin:'0 0 0.3rem', fontSize:'0.85rem', color:'#666'}}><strong>Delivery Status:</strong></p>
                  <p style={{margin:0, fontSize:'0.95rem', color:'#27500A', fontWeight:'bold'}}>
                    {transfer.deliveryStatus || 'PENDING_DISPATCH'}
                  </p>
                </div>

                <div style={styles.docSection}>
                  <p style={styles.docTitle}>Compliance Documents</p>
                  <div style={styles.docGrid}>
                    <button
                      onClick={() => handleDocDownload(id, 'invoice')}
                      disabled={Boolean(downloading[`${id}-invoice-default`])}
                      style={styles.docBtn}
                    >
                      {downloading[`${id}-invoice-default`] ? 'Downloading...' : 'Invoice PDF'}
                    </button>
                    <button
                      onClick={() => handleDocDownload(id, 'challan')}
                      disabled={Boolean(downloading[`${id}-challan-default`])}
                      style={styles.docBtn}
                    >
                      {downloading[`${id}-challan-default`] ? 'Downloading...' : 'Challan PDF'}
                    </button>
                    <button
                      onClick={() => handleDocDownload(id, 'settlement')}
                      disabled={Boolean(downloading[`${id}-settlement-default`])}
                      style={styles.docBtn}
                    >
                      {downloading[`${id}-settlement-default`] ? 'Downloading...' : 'Settlement PDF'}
                    </button>
                    <button
                      onClick={() => handleDocDownload(id, 'audit-trail', 'json')}
                      disabled={Boolean(downloading[`${id}-audit-trail-json`])}
                      style={styles.docBtnSecondary}
                    >
                      {downloading[`${id}-audit-trail-json`] ? 'Downloading...' : 'Audit JSON'}
                    </button>
                    <button
                      onClick={() => handleDocDownload(id, 'audit-trail', 'csv')}
                      disabled={Boolean(downloading[`${id}-audit-trail-csv`])}
                      style={styles.docBtnSecondary}
                    >
                      {downloading[`${id}-audit-trail-csv`] ? 'Downloading...' : 'Audit CSV'}
                    </button>
                  </div>
                </div>

                {/* Refund Option */}
                {escrow.status !== 'REFUNDED' && (
                  <div style={styles.refundSection}>
                    <button
                      onClick={() => setExpandedId(expandedId === id ? null : id)}
                      style={{...styles.refundBtn, opacity: transfer.deliveryStatus === 'DELIVERED' ? 1 : 0.5}}
                      disabled={transfer.deliveryStatus !== 'DELIVERED'}>
                      {expandedId === id ? '✕ Cancel Refund' : 'Request Refund'}
                    </button>

                    {expandedId === id && (
                      <div style={styles.refundForm}>
                        <textarea
                          placeholder="Refund reason likho..."
                          value={refundData[id] || ''}
                          onChange={(e) => setRefundData({...refundData, [id]: e.target.value})}
                          style={styles.textarea}
                        />
                        <button
                          onClick={() => handleRefundRequest(id)}
                          style={styles.submitRefundBtn}>
                          Submit Refund Request
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {escrow.refundReason && (
                  <div style={styles.refundInfo}>
                    <p style={{margin:'0 0 0.3rem', fontSize:'0.85rem', color:'#d32f2f'}}><strong>Refund Status:</strong></p>
                    <p style={{margin:0, fontSize:'0.9rem'}}>Reason: {escrow.refundReason}</p>
                    <p style={{margin:'0.2rem 0 0', fontSize:'0.9rem', color:'#27500A', fontWeight:'bold'}}>
                      Amount: ₹{escrow.refundAmount.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const statusColor = (status) => {
  if (status === 'COMPLETED') return '#d4edda';
  if (status === 'REFUNDED') return '#f8d7da';
  if (status === 'FAILED') return '#f8d7da';
  return '#fff3cd';
};

const milestoneItemStyle = (isCompleted) => ({
  background: isCompleted ? '#e8f5e9' : '#f5f5f5',
  padding: '0.6rem',
  borderRadius: '8px',
  border: `1px solid ${isCompleted ? '#c8e6c9' : '#e0e0e0'}`,
  textAlign: 'center'
});

const styles = {
  container: { minHeight:'100vh', background:'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', padding:'1rem' },
  header: { display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem', background:'#fff', padding:'1rem 1.2rem', borderRadius:'14px', border:'1px solid #dbe5d8', boxShadow:'0 8px 22px rgba(26, 44, 33, 0.08)' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', fontSize:'0.9rem', padding:0 },
  title: { color:'#1f3320', margin:0, fontSize:'1.2rem' },
  loading: { textAlign:'center', color:'#5f7167', marginTop:'2rem' },
  empty: { textAlign:'center', color:'#5f7167', marginTop:'2.4rem', padding:'1.5rem', background:'#fff', borderRadius:'14px', border:'1px solid #dbe5d8' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'1rem' },
  card: { background:'#fff', padding:'1.2rem', borderRadius:'14px', border:'1px solid #dbe5d8', boxShadow:'0 8px 22px rgba(26, 44, 33, 0.08)' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' },
  cropName: { margin:0, color:'#1f3320', fontSize:'1.1rem' },
  transferType: { margin:'0.3rem 0 0', color:'#888', fontSize:'0.8rem' },
  badge: { padding:'0.35rem 0.7rem', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'700', color:'#333' },
  partyInfo: { background:'#f5f5f5', padding:'0.7rem', borderRadius:'8px', margin:'0.8rem 0', fontSize:'0.85rem' },
  partyInfo_p: { margin:'0.3rem 0' },
  totalBox: { background:'#eef5e9', padding:'0.8rem', borderRadius:'10px', border:'1px solid #dbe5d8', marginBottom:'0.8rem' },
  progressContainer: { marginBottom:'1rem' },
  progressBar: { height:'8px', background:'linear-gradient(90deg, #27500A 0%, #4caf50 100%)', borderRadius:'4px', transition:'width 0.3s' },
  milestoneGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.6rem', margin:'1rem 0' },
  deliveryStatus: { background:'#f9f9f9', padding:'0.7rem', borderRadius:'8px', margin:'0.8rem 0' },
  refundSection: { marginTop:'1rem', borderTop:'1px solid #eee', paddingTop:'1rem' },
  docSection: { marginTop:'1rem', borderTop:'1px solid #eee', paddingTop:'1rem' },
  docTitle: { margin:'0 0 0.6rem', color:'#1f3320', fontWeight:'700', fontSize:'0.9rem' },
  docGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' },
  docBtn: { width:'100%', padding:'0.55rem', background:'#27500A', color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.82rem', cursor:'pointer', fontWeight:'600' },
  docBtnSecondary: { width:'100%', padding:'0.55rem', background:'#fff', color:'#27500A', border:'1px solid #27500A', borderRadius:'8px', fontSize:'0.82rem', cursor:'pointer', fontWeight:'600' },
  refundBtn: { width:'100%', padding:'0.6rem', background:'#ff9800', color:'white', border:'none', borderRadius:'8px', fontSize:'0.9rem', cursor:'pointer', fontWeight:'600' },
  refundForm: { marginTop:'0.8rem' },
  textarea: { width:'100%', padding:'0.6rem', borderRadius:'8px', border:'1px solid #ddd', fontSize:'0.9rem', minHeight:'60px', fontFamily:'inherit', boxSizing:'border-box' },
  submitRefundBtn: { width:'100%', marginTop:'0.5rem', padding:'0.6rem', background:'#d32f2f', color:'white', border:'none', borderRadius:'8px', fontSize:'0.9rem', cursor:'pointer', fontWeight:'600' },
  refundInfo: { background:'#ffebee', padding:'0.7rem', borderRadius:'8px', margin:'0.8rem 0', borderLeft:'3px solid #d32f2f' }
};
