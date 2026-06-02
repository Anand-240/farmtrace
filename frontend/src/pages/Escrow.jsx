import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const STATUS_META = {
  ACTIVE:    { label: 'Active',    bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  COMPLETED: { label: 'Completed', bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  REFUNDED:  { label: 'Refunded',  bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  FAILED:    { label: 'Failed',    bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
};

const DELIVERY_LABELS = {
  PENDING_DISPATCH:  { label: 'Pending Dispatch',  icon: '📦', color: '#92400e', bg: '#fef3c7' },
  PICKUP_DISPATCHED: { label: 'Pickup Dispatched', icon: '🚚', color: '#1e40af', bg: '#dbeafe' },
  IN_TRANSIT:        { label: 'In Transit',        icon: '🛣️',  color: '#5b21b6', bg: '#ede9fe' },
  DELIVERED:         { label: 'Delivered',          icon: '✅', color: '#166534', bg: '#dcfce7' },
};

const TRANSFER_TYPE_LABELS = {
  FARM_TO_DISTRIBUTOR:     'Farm → Distributor',
  DISTRIBUTOR_TO_RETAILER: 'Distributor → Retailer',
  RETAILER_TO_CONSUMER:    'Retailer → Consumer',
};

function formatEnum(str) {
  if (!str) return '—';
  return TRANSFER_TYPE_LABELS[str] || str.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDelivery(status) {
  return DELIVERY_LABELS[status] || { label: status || 'Unknown', icon: '📍', color: '#475569', bg: '#f1f5f9' };
}

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.ACTIVE;
}

export default function Escrow() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [refundData, setRefundData] = useState({});
  const [downloading, setDownloading] = useState({});
  const navigate = useNavigate();

  useEffect(() => { fetchEscrows(); }, []);

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
    if (!reason?.trim()) { alert('Please provide a refund reason.'); return; }
    try {
      const res = await api.post(`/payment/escrow/${transferId}/request-refund`, { reason });
      alert(`Refund request submitted! Amount: ₹${res.data.refundAmount?.toLocaleString()}`);
      fetchEscrows();
      setRefundData(prev => ({ ...prev, [transferId]: '' }));
    } catch (err) {
      alert('Refund request failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  const triggerBrowserDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDocDownload = async (transferId, type, format = '') => {
    const key = `${transferId}-${type}-${format || 'default'}`;
    setDownloading(prev => ({ ...prev, [key]: true }));
    try {
      const query = format ? `?format=${format}` : '';
      const response = await api.get(`/payment/docs/${transferId}/${type}${query}`, { responseType: 'blob' });
      const ext = type === 'audit-trail' ? (format === 'csv' ? 'csv' : 'json') : 'pdf';
      triggerBrowserDownload(response.data, `${type}-${String(transferId).slice(-6)}.${ext}`);
    } catch (err) {
      alert(`Download failed: ${err?.response?.data?.message || err.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [key]: false }));
    }
  };

  const totalLocked = escrows.reduce((sum, item) => sum + (item.escrow?.totalAmount || 0), 0);
  const activeCount = escrows.filter(i => i.escrow?.status === 'ACTIVE').length;
  const completedCount = escrows.filter(i => i.escrow?.status === 'COMPLETED').length;

  return (
    <div className="ft-page" style={{ background: 'var(--ft-bg)' }}>
      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--ft-border)',
        padding: '0 1.5rem', height: '64px',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <button onClick={() => navigate('/dashboard')} style={navBtnStyle}>
          ← Dashboard
        </button>
        <div style={{ width: '1px', height: '24px', background: 'var(--ft-border)' }} />
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ft-forest)', letterSpacing: '-0.02em' }}>
          Escrow & Milestone Payments
        </span>
      </nav>

      <div className="ft-container" style={{ paddingTop: '88px', paddingBottom: '4rem' }}>
        {loading ? (
          <LoadingState />
        ) : escrows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Stats Bar ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem'
            }}>
              <StatCard label="Total Locked" value={`₹${totalLocked.toLocaleString()}`} icon="🔒" accent="var(--ft-forest)" />
              <StatCard label="Active Escrows" value={activeCount} icon="⚡" accent="#d97806" />
              <StatCard label="Completed" value={completedCount} icon="✅" accent="#15803d" />
            </div>

            {/* ── Cards Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {escrows.map((item, idx) => (
                <EscrowCard
                  key={item.transfer._id}
                  item={item}
                  idx={idx}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  refundData={refundData}
                  setRefundData={setRefundData}
                  downloading={downloading}
                  handleDocDownload={handleDocDownload}
                  handleRefundRequest={handleRefundRequest}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EscrowCard({ item, idx, expandedId, setExpandedId, refundData, setRefundData, downloading, handleDocDownload, handleRefundRequest }) {
  const { transfer, escrow, produce } = item;
  const id = transfer._id;
  const statusMeta = getStatusMeta(escrow.status);
  const delivery = formatDelivery(transfer.deliveryStatus);
  const canRefund = transfer.deliveryStatus === 'DELIVERED' && escrow.status !== 'REFUNDED';

  const milestones = buildMilestones(escrow);
  const completedMilestones = milestones.filter(m => m.done).length;
  const releasedAmount = (escrow.bookingPaid ? (escrow.bookingAmount || 0) : 0)
    + (escrow.dispatchReleased ? (escrow.dispatchAmount || 0) : 0)
    + (escrow.deliveryReleased ? (escrow.deliveryAmount || 0) : 0);
  const releasePercent = escrow.totalAmount ? Math.round((releasedAmount / escrow.totalAmount) * 100) : 0;

  return (
    <div
      style={{
        background: '#fff', borderRadius: '20px',
        border: '1px solid var(--ft-border)',
        boxShadow: '0 4px 24px rgba(13,51,25,0.06)',
        overflow: 'hidden',
        animation: `ft-reveal-up 0.4s ease both`,
        animationDelay: `${idx * 0.08}s`,
      }}
    >
      {/* ── Card Header ── */}
      <div style={{ padding: '1.5rem 1.5rem 1.25rem', borderBottom: '1px solid var(--ft-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--ft-forest)' }}>
              {produce?.cropType || 'Produce'}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--ft-text-muted)', fontWeight: 600, marginTop: '2px', display: 'block' }}>
              {formatEnum(transfer.transferType)}
            </span>
          </div>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: statusMeta.bg, color: statusMeta.color,
            fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px',
            borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusMeta.dot, display: 'inline-block' }} />
            {statusMeta.label}
          </span>
        </div>

        {/* Party Info */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <PartyTag label="From" value={transfer.fromPhone} />
          <PartyTag label="To" value={transfer.toPhone} />
          {transfer.location && <PartyTag label="At" value={transfer.location} />}
        </div>
      </div>

      {/* ── Amount Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d3319 0%, #1a4a26 100%)',
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Locked Amount
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
              ₹{escrow.totalAmount.toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
              {completedMilestones}/{milestones.length} Milestones
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 800, color: '#4ade80' }}>
              {releasePercent}% Released
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '1rem', height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            width: `${releasePercent}%`,
            height: '100%', background: 'linear-gradient(90deg, #4ade80, #86efac)',
            borderRadius: '99px', transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)'
          }} />
        </div>
      </div>

      {/* ── Milestone Steps ── */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--ft-border)' }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Payment Milestones
        </p>
        <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
          {milestones.map((m, i) => (
            <MilestoneStep key={m.label} milestone={m} isLast={i === milestones.length - 1} />
          ))}
        </div>
      </div>

      {/* ── Delivery Status ── */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--ft-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--ft-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Delivery Status
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: delivery.bg, color: delivery.color,
          padding: '5px 12px', borderRadius: '999px',
          fontSize: '0.8rem', fontWeight: 700
        }}>
          {delivery.icon} {delivery.label}
        </span>
      </div>

      {/* ── Compliance Docs ── */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--ft-border)' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Compliance Documents
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {[
            { type: 'invoice',     label: 'Invoice PDF',    icon: '🧾' },
            { type: 'challan',     label: 'Challan PDF',    icon: '📄' },
            { type: 'settlement',  label: 'Settlement PDF', icon: '📑' },
            { type: 'audit-trail', label: 'Audit JSON', icon: '🔍', format: 'json' },
          ].map(doc => {
            const key = `${id}-${doc.type}-${doc.format || 'default'}`;
            const busy = Boolean(downloading[key]);
            return (
              <button
                key={doc.type}
                onClick={() => handleDocDownload(id, doc.type, doc.format || '')}
                disabled={busy}
                style={docBtnStyle(busy)}
              >
                <span>{doc.icon}</span>
                <span>{busy ? 'Downloading…' : doc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Refund Section ── */}
      {escrow.status !== 'REFUNDED' && (
        <div style={{ padding: '1rem 1.5rem' }}>
          <button
            onClick={() => setExpandedId(expandedId === id ? null : id)}
            disabled={!canRefund}
            style={{
              width: '100%', padding: '0.6rem',
              borderRadius: '10px', border: '1px solid',
              fontSize: '0.82rem', fontWeight: 700, cursor: canRefund ? 'pointer' : 'not-allowed',
              borderColor: canRefund ? 'rgba(185,28,28,0.3)' : 'var(--ft-border)',
              color: canRefund ? 'var(--ft-error)' : 'var(--ft-text-muted)',
              background: canRefund ? '#fff5f5' : '#f8fafc',
              transition: 'all 0.2s ease',
            }}
          >
            {expandedId === id ? '✕ Cancel' : '⚠ Request Dispute / Refund'}
          </button>

          {!canRefund && (
            <p style={{ fontSize: '0.72rem', color: 'var(--ft-text-muted)', textAlign: 'center', marginTop: '0.5rem', lineHeight: 1.4 }}>
              Refund available only after delivery is confirmed ({delivery.label} currently)
            </p>
          )}

          {expandedId === id && canRefund && (
            <div style={{ marginTop: '0.75rem' }}>
              <textarea
                className="ft-input"
                placeholder="Describe the reason for refund request…"
                value={refundData[id] || ''}
                onChange={e => setRefundData(prev => ({ ...prev, [id]: e.target.value }))}
                style={{ minHeight: '80px', marginBottom: '0.75rem', fontSize: '0.85rem' }}
              />
              <button
                onClick={() => handleRefundRequest(id)}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '10px',
                  background: 'var(--ft-error)', color: '#fff',
                  border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                Submit Refund Request
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Refund Info (if refunded) ── */}
      {escrow.refundReason && (
        <div style={{
          margin: '0 1.5rem 1.5rem', padding: '1rem',
          background: '#fef2f2', borderRadius: '12px',
          border: '1px solid rgba(185,28,28,0.2)'
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'var(--ft-error)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Refund Details
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#7f1d1d', lineHeight: 1.5 }}>{escrow.refundReason}</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: 'var(--ft-error)', fontWeight: 800 }}>
            ₹{escrow.refundAmount?.toLocaleString()} refunded
          </p>
        </div>
      )}
    </div>
  );
}

function MilestoneStep({ milestone, isLast }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Connector line */}
      {!isLast && (
        <div style={{
          position: 'absolute', top: '15px', left: '50%', right: '-50%',
          height: '2px',
          background: milestone.done ? 'var(--ft-success)' : 'var(--ft-border)',
          zIndex: 0, transition: 'background 0.3s ease'
        }} />
      )}

      {/* Circle */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 800,
        background: milestone.done ? 'var(--ft-success)' : milestone.amount === 0 ? '#e2e8f0' : '#f1f5f9',
        color: milestone.done ? '#fff' : 'var(--ft-text-muted)',
        border: `2px solid ${milestone.done ? 'var(--ft-success)' : 'var(--ft-border)'}`,
        transition: 'all 0.3s ease',
      }}>
        {milestone.done ? '✓' : milestone.amount === 0 ? '—' : milestone.step}
      </div>

      {/* Label */}
      <p style={{ margin: '6px 0 2px', fontSize: '0.65rem', fontWeight: 800, color: 'var(--ft-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
        {milestone.label}
      </p>

      {/* Amount */}
      <p style={{
        margin: 0, fontSize: '0.75rem', fontWeight: 800, textAlign: 'center',
        color: milestone.done ? 'var(--ft-success)' : milestone.amount === 0 ? 'var(--ft-text-muted)' : 'var(--ft-forest)',
      }}>
        {milestone.amount === 0 ? 'N/A' : `₹${milestone.amount.toLocaleString()}`}
      </p>

      {/* Status pill */}
      <span style={{
        marginTop: '4px', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '999px',
        background: milestone.done ? '#dcfce7' : '#f1f5f9',
        color: milestone.done ? '#15803d' : '#94a3b8',
      }}>
        {milestone.statusLabel}
      </span>
    </div>
  );
}

function PartyTag({ label, value }) {
  return (
    <div style={{ flex: 1, background: 'var(--ft-sage-light)', borderRadius: '8px', padding: '6px 10px', minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--ft-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ft-forest)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</p>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '1.25rem 1.5rem',
      border: '1px solid var(--ft-border)',
      boxShadow: '0 2px 12px rgba(13,51,25,0.05)',
      display: 'flex', alignItems: 'center', gap: '1rem'
    }}>
      <span style={{ fontSize: '1.75rem' }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: accent, letterSpacing: '-0.03em' }}>{value}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ft-text-muted)', fontWeight: 600 }}>{label}</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ paddingTop: '6rem', textAlign: 'center' }}>
      <div style={{ display: 'inline-block', width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--ft-sage-light)', borderTopColor: 'var(--ft-forest)', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ marginTop: '1rem', color: 'var(--ft-text-muted)', fontWeight: 600 }}>Loading escrow records…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '5rem 2rem',
      background: '#fff', borderRadius: '20px',
      border: '1px solid var(--ft-border)',
      boxShadow: '0 2px 12px rgba(13,51,25,0.04)'
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
      <h3 style={{ margin: '0 0 0.5rem', color: 'var(--ft-forest)' }}>No Escrow Records</h3>
      <p style={{ color: 'var(--ft-text-muted)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.6 }}>
        Once you make or receive a payment, your escrow milestones will appear here.
      </p>
    </div>
  );
}

function buildMilestones(escrow) {
  const list = [
    { step: 1, label: 'Booking', amount: escrow.bookingAmount, done: escrow.bookingPaid, statusLabel: escrow.bookingPaid ? 'Paid' : 'Pending' },
  ];
  if (escrow.dispatchAmount > 0) {
    list.push({ step: 2, label: 'Dispatch', amount: escrow.dispatchAmount, done: escrow.dispatchReleased, statusLabel: escrow.dispatchReleased ? 'Released' : 'Locked' });
  } else {
    list.push({ step: 2, label: 'Dispatch', amount: 0, done: false, statusLabel: 'N/A' });
  }
  list.push({ step: 3, label: 'Delivery', amount: escrow.deliveryAmount, done: escrow.deliveryReleased, statusLabel: escrow.deliveryReleased ? 'Released' : 'Locked' });
  return list;
}

const navBtnStyle = {
  background: 'var(--ft-sage-light)', border: '1px solid var(--ft-border)',
  color: 'var(--ft-forest)', padding: '6px 14px', borderRadius: '8px',
  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
  transition: 'background 0.2s ease',
};

const docBtnStyle = (busy) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  padding: '0.55rem 0.75rem', borderRadius: '10px',
  border: '1px solid var(--ft-border)',
  background: busy ? '#f1f5f9' : '#f8fafc',
  color: busy ? 'var(--ft-text-muted)' : 'var(--ft-text)',
  fontSize: '0.78rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s ease',
  opacity: busy ? 0.7 : 1,
});
