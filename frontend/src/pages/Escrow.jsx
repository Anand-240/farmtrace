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
      const res = await api.get('/payment/escrow/my/all');
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
      const res = await api.post(`/payment/escrow/${transferId}/request-refund`, {
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
      const response = await api.get(`/payment/docs/${transferId}/${type}${query}`, {
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
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass">
        <div className="ft-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm">
            ← Dashboard
          </button>
          <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>Escrow & Milestone Payments</span>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '6rem', paddingBottom: '4rem' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="ft-loading-pulse">Authenticating Escrow Ledger...</div>
          </div>
        ) : escrows.length === 0 ? (
          <div className="ft-card ft-anim-reveal" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ft-forest)' }}>Koi escrow record nahi hai</p>
            <p style={{ marginTop: '0.5rem', color: 'var(--ft-text-muted)' }}>Jab payment hoga tab escrow records yahan dikhenge.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
            {escrows.map((item, idx) => {
              const { transfer, escrow, produce } = item;
              const progress = calculateProgress(escrow);
              const id = transfer._id;

              return (
                <div key={id} className="ft-card ft-anim-reveal" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--ft-forest)' }}>{produce?.cropType || 'Produce'}</h3>
                      <p style={{ margin: '0.2rem 0 0', color: 'var(--ft-text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{transfer.transferType}</p>
                    </div>
                    <span className="ft-badge" style={{ background: statusColor(escrow.status), color: '#166534' }}>
                      {escrow.status}
                    </span>
                  </div>

                  <div style={{ background: 'var(--ft-sage-light)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>From</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{transfer.fromPhone}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>To</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{transfer.toPhone}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Location</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{transfer.location}</span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--ft-forest)', color: '#fff', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 10px 15px -3px rgba(13, 51, 25, 0.4)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locked Amount</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 900 }}>₹{escrow.totalAmount.toLocaleString()}</p>
                    
                    <div style={{ marginTop: '1.25rem' }}>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                      </div>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', opacity: 0.9 }}>{progress}% Released To Seller</p>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: escrow.dispatchAmount > 0 ? '1fr 1fr 1fr' : '1fr 1fr', 
                    gap: '0.75rem', 
                    marginBottom: '1.5rem' 
                  }}>
                    <div style={milestoneItemStyle(escrow.bookingPaid)}>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Booking</p>
                      <p style={{ margin: '0.25rem 0 0', fontWeight: 800, fontSize: '1rem', color: 'var(--ft-forest)' }}>₹{escrow.bookingAmount.toLocaleString()}</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', fontWeight: 700, color: escrow.bookingPaid ? 'var(--ft-success)' : 'var(--ft-text-muted)' }}>{escrow.bookingPaid ? '✓ Paid' : 'Pending'}</p>
                    </div>
                    {escrow.dispatchAmount > 0 && (
                      <div style={milestoneItemStyle(escrow.dispatchReleased)}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Dispatch</p>
                        <p style={{ margin: '0.25rem 0 0', fontWeight: 800, fontSize: '1rem', color: escrow.dispatchReleased ? 'var(--ft-forest)' : 'var(--ft-text-muted)' }}>₹{escrow.dispatchAmount.toLocaleString()}</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', fontWeight: 700, color: escrow.dispatchReleased ? 'var(--ft-success)' : 'var(--ft-text-muted)' }}>{escrow.dispatchReleased ? '✓ Released' : 'Locked'}</p>
                      </div>
                    )}
                    <div style={milestoneItemStyle(escrow.deliveryReleased)}>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Delivery</p>
                      <p style={{ margin: '0.25rem 0 0', fontWeight: 800, fontSize: '1rem', color: escrow.deliveryReleased ? 'var(--ft-forest)' : 'var(--ft-text-muted)' }}>₹{escrow.deliveryAmount.toLocaleString()}</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', fontWeight: 700, color: escrow.deliveryReleased ? 'var(--ft-success)' : 'var(--ft-text-muted)' }}>{escrow.deliveryReleased ? '✓ Released' : 'Locked'}</p>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid var(--ft-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Delivery Status</p>
                    <p style={{ margin: 0, fontSize: '1rem', color: 'var(--ft-forest)', fontWeight: 800 }}>{transfer.deliveryStatus || 'PENDING_DISPATCH'}</p>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 800 }}>Compliance Documents</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <button onClick={() => handleDocDownload(id, 'invoice')} disabled={Boolean(downloading[`${id}-invoice-default`])} className="ft-btn ft-btn-secondary ft-btn-sm">Invoice PDF</button>
                      <button onClick={() => handleDocDownload(id, 'challan')} disabled={Boolean(downloading[`${id}-challan-default`])} className="ft-btn ft-btn-secondary ft-btn-sm">Challan PDF</button>
                      <button onClick={() => handleDocDownload(id, 'settlement')} disabled={Boolean(downloading[`${id}-settlement-default`])} className="ft-btn ft-btn-secondary ft-btn-sm">Settlement PDF</button>
                      <button onClick={() => handleDocDownload(id, 'audit-trail', 'json')} disabled={Boolean(downloading[`${id}-audit-trail-json`])} className="ft-btn ft-btn-ghost ft-btn-sm">Audit JSON</button>
                    </div>
                  </div>

                  {escrow.status !== 'REFUNDED' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--ft-border)' }}>
                      <button
                        onClick={() => setExpandedId(expandedId === id ? null : id)}
                        className="ft-btn ft-btn-ghost ft-btn-full"
                        style={{ color: transfer.deliveryStatus === 'DELIVERED' ? 'var(--ft-error)' : 'var(--ft-text-muted)', borderColor: transfer.deliveryStatus === 'DELIVERED' ? 'rgba(185, 28, 28, 0.2)' : 'var(--ft-border)' }}
                        disabled={transfer.deliveryStatus !== 'DELIVERED'}
                      >
                        {expandedId === id ? '✕ Cancel Refund' : 'Request Dispute / Refund'}
                      </button>
                      {transfer.deliveryStatus !== 'DELIVERED' && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--ft-text-muted)', marginTop: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                          🔒 Refund tab available hoga jab delivery status "DELIVERED" ho jaaye. Abhi: <strong>{transfer.deliveryStatus || 'PENDING_DISPATCH'}</strong>
                        </p>
                      )}

                      {expandedId === id && (
                        <div style={{ marginTop: '1rem' }}>
                          <textarea className="ft-input" placeholder="Explain the reason for refund..." value={refundData[id] || ''} onChange={(e) => setRefundData({...refundData, [id]: e.target.value})} style={{ minHeight: '80px', marginBottom: '1rem' }} />
                          <button onClick={() => handleRefundRequest(id)} className="ft-btn ft-btn-full" style={{ background: 'var(--ft-error)', color: '#fff' }}>Submit Request</button>
                        </div>
                      )}
                    </div>
                  )}

                  {escrow.refundReason && (
                    <div style={{ background: '#fef2f2', borderLeft: '4px solid var(--ft-error)', padding: '1rem', borderRadius: '0 8px 8px 0', marginTop: '1.5rem' }}>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--ft-error)', fontWeight: 800, textTransform: 'uppercase' }}>Refund Status</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f1d1d' }}>{escrow.refundReason}</p>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: 'var(--ft-error)', fontWeight: 900 }}>Amount: ₹{escrow.refundAmount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const statusColor = (status) => {
  if (status === 'COMPLETED') return '#dcfce7';
  if (status === 'REFUNDED') return '#fee2e2';
  if (status === 'FAILED') return '#fee2e2';
  return '#fef9c3';
};

const milestoneItemStyle = (isCompleted) => ({
  background: isCompleted ? 'var(--ft-sage-light)' : '#f8fafc',
  padding: '1rem 0.5rem',
  borderRadius: '12px',
  border: `1px solid ${isCompleted ? 'var(--ft-sage)' : 'var(--ft-border)'}`,
  textAlign: 'center',
  opacity: isCompleted ? 1 : 0.6
});
