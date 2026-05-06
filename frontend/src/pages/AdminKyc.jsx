import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, CheckCircle, XCircle, Clock, Eye, RefreshCw,
  User, Phone, MapPin, FileText, LogOut, ChevronDown, ChevronUp,
  AlertTriangle, Image
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SESSION_KEY = 'ft_admin_key';

const DOC_LABELS = { AADHAAR: 'Aadhaar Card', PAN: 'PAN Card', ESHRAM: 'eShram Card' };
const ROLE_LABELS = { FARMER: '👨‍🌾 Farmer', DISTRIBUTOR: '🚚 Distributor', RETAILER: '🛒 Retailer' };

const STATUS_TABS = [
  { key: 'SUBMITTED', label: 'Pending', icon: <Clock size={15} />, color: '#E65100', bg: '#FFF8E1' },
  { key: 'VERIFIED', label: 'Approved', icon: <CheckCircle size={15} />, color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'REJECTED', label: 'Rejected', icon: <XCircle size={15} />, color: '#B71C1C', bg: '#FFEBEE' },
  { key: 'ALL', label: 'All', icon: <FileText size={15} />, color: '#333', bg: '#F5F5F5' }
];

function adminRequest(adminKey) {
  return { headers: { 'x-admin-key': adminKey } };
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Image Viewer Modal ──────────────────────────────────────────────────────
function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}
    >
      <img
        src={src}
        alt="KYC Document"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1.5rem',
          background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1rem'
        }}
      >✕ Close</button>
    </div>
  );
}

// ── Single KYC Card ─────────────────────────────────────────────────────────
function KycCard({ submission, adminKey, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [acting, setActing] = useState(false);
  const [imageModal, setImageModal] = useState(null); // signed URL to display
  const [imageLoading, setImageLoading] = useState({ front: false, back: false });

  const statusColor = { SUBMITTED: '#E65100', VERIFIED: '#2E7D32', REJECTED: '#C62828' };
  const statusBg = { SUBMITTED: '#FFF8E1', VERIFIED: '#E8F5E9', REJECTED: '#FFEBEE' };
  const statusLabel = { SUBMITTED: '⏳ Pending Review', VERIFIED: '✅ Approved', REJECTED: '❌ Rejected' };

  const viewImage = async (side) => {
    setImageLoading(prev => ({ ...prev, [side]: true }));
    try {
      const res = await api.get(`/kyc/admin/signed-image/${submission.kycId}/${side}`, adminRequest(adminKey));
      setImageModal(res.data.url);
    } catch {
      toast.error('Image load nahi hua');
    } finally {
      setImageLoading(prev => ({ ...prev, [side]: false }));
    }
  };

  const handleAction = async (action) => {
    if (action === 'REJECT' && !rejectionReason.trim()) {
      toast.error('Rejection reason likhna zaroori hai');
      return;
    }
    setActing(true);
    try {
      await api.post(
        `/kyc/admin/verify/${submission.userId}`,
        { action, rejectionReason: rejectionReason || undefined },
        adminRequest(adminKey)
      );
      toast.success(action === 'APPROVE' ? `${submission.userName} ka KYC approve ho gaya!` : 'KYC reject kar diya');
      onStatusChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action fail hua');
    } finally {
      setActing(false);
      setRejecting(false);
    }
  };

  return (
    <>
      <ImageModal src={imageModal} onClose={() => setImageModal(null)} />
      <div style={{
        background: '#fff', borderRadius: 16, border: '1.5px solid #E0E0E0',
        marginBottom: '1rem', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        {/* Card Header — always visible */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{
            padding: '1rem 1.25rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '1rem',
            borderBottom: expanded ? '1px solid #EEE' : 'none'
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#1B5E20,#4CAF50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: '1.1rem'
          }}>
            {(submission.userName || '?')[0].toUpperCase()}
          </div>

          {/* User info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a' }}>
              {submission.userName || 'Unknown'}
              <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#666' }}>
                {ROLE_LABELS[submission.userRole] || submission.userRole}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '0.15rem' }}>
              {submission.userEmail} · {submission.userPhone || '—'}
            </div>
          </div>

          {/* Doc type badge */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              display: 'inline-block', padding: '0.2rem 0.65rem',
              borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
              background: '#E3F2FD', color: '#1565C0', marginBottom: '0.25rem'
            }}>
              {DOC_LABELS[submission.documentType] || submission.documentType}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
              background: statusBg[submission.status], color: statusColor[submission.status],
              marginLeft: '0.4rem'
            }}>
              {statusLabel[submission.status]}
            </div>
          </div>

          {/* Expand toggle */}
          <div style={{ color: '#999', flexShrink: 0 }}>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

              {/* Left: User details */}
              <div>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 800, fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  User Details
                </p>
                <InfoRow icon={<User size={14} />} label="Name" value={submission.userName} />
                <InfoRow icon={<Phone size={14} />} label="Phone" value={submission.userPhone || '—'} />
                <InfoRow icon={<MapPin size={14} />} label="Location" value={submission.location || '—'} />
                <InfoRow icon={<Clock size={14} />} label="Submitted" value={formatDate(submission.submittedAt)} />
                {submission.reviewedAt && (
                  <InfoRow icon={<CheckCircle size={14} />} label="Reviewed" value={formatDate(submission.reviewedAt)} />
                )}
              </div>

              {/* Right: Document details */}
              <div>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 800, fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Document Details
                </p>
                <InfoRow icon={<FileText size={14} />} label="Type" value={DOC_LABELS[submission.documentType]} />
                <InfoRow icon={<ShieldCheck size={14} />} label="Number" value={submission.documentNumberMasked} mono />
                <InfoRow icon={<User size={14} />} label="Name (Doc)" value={submission.nameAsPerDoc || '—'} />
                {submission.rejectionReason && (
                  <div style={{ marginTop: '0.5rem', background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#C62828', fontWeight: 700 }}>Rejection Reason:</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#B71C1C' }}>{submission.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Document Images */}
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontWeight: 800, fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Document Photos
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {submission.frontImageUrl ? (
                  <button
                    onClick={() => viewImage('front')}
                    disabled={imageLoading.front}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 1rem', borderRadius: 10, border: '1.5px solid #1565C0',
                      background: '#E3F2FD', color: '#1565C0', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.9rem'
                    }}
                  >
                    {imageLoading.front ? <div className="ft-spinner" style={{ width: 16, height: 16 }} /> : <Eye size={16} />}
                    Front Side
                  </button>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Image size={14} /> Front — Upload nahi hua
                  </span>
                )}

                {submission.backImageUrl ? (
                  <button
                    onClick={() => viewImage('back')}
                    disabled={imageLoading.back}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 1rem', borderRadius: 10, border: '1.5px solid #1565C0',
                      background: '#E3F2FD', color: '#1565C0', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.9rem'
                    }}
                  >
                    {imageLoading.back ? <div className="ft-spinner" style={{ width: 16, height: 16 }} /> : <Eye size={16} />}
                    Back Side
                  </button>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Image size={14} /> Back — Upload nahi hua
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons — only for pending */}
            {submission.status === 'SUBMITTED' && (
              <div style={{ borderTop: '1px solid #EEE', paddingTop: '1.25rem' }}>
                {!rejecting ? (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleAction('APPROVE')}
                      disabled={acting}
                      style={{
                        flex: 1, minWidth: 140, padding: '0.75rem 1.5rem',
                        borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: '#1B5E20', color: '#fff', fontWeight: 800, fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        opacity: acting ? 0.7 : 1
                      }}
                    >
                      {acting ? <div className="ft-spinner" style={{ width: 18, height: 18 }} /> : <CheckCircle size={18} />}
                      Approve Karo
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={acting}
                      style={{
                        flex: 1, minWidth: 140, padding: '0.75rem 1.5rem',
                        borderRadius: 12, border: '2px solid #C62828', cursor: 'pointer',
                        background: '#fff', color: '#C62828', fontWeight: 800, fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                      }}
                    >
                      <XCircle size={18} /> Reject Karo
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#C62828', fontSize: '0.9rem' }}>
                      Rejection reason likhein (user ko email mein jaayega):
                    </p>
                    <textarea
                      placeholder="e.g. Document blurry hai, ya naam match nahi kar raha"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%', padding: '0.75rem', borderRadius: 10,
                        border: '1.5px solid #EF9A9A', fontSize: '0.9rem',
                        resize: 'vertical', boxSizing: 'border-box', marginBottom: '0.75rem',
                        outline: 'none', fontFamily: 'inherit'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => handleAction('REJECT')}
                        disabled={acting || !rejectionReason.trim()}
                        style={{
                          flex: 1, padding: '0.65rem 1.25rem', borderRadius: 10,
                          border: 'none', cursor: 'pointer',
                          background: '#C62828', color: '#fff', fontWeight: 800,
                          opacity: (acting || !rejectionReason.trim()) ? 0.6 : 1
                        }}
                      >
                        {acting ? 'Rejecting...' : 'Confirm Reject'}
                      </button>
                      <button
                        onClick={() => { setRejecting(false); setRejectionReason(''); }}
                        style={{
                          padding: '0.65rem 1.25rem', borderRadius: 10,
                          border: '1px solid #ddd', cursor: 'pointer',
                          background: '#f5f5f5', color: '#666', fontWeight: 600
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
      <span style={{ color: '#888', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <span style={{ fontSize: '0.83rem', color: '#555', flexShrink: 0 }}>{label}:&nbsp;</span>
      <span style={{ fontSize: '0.83rem', color: '#1a1a1a', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}

// ── Auth Gate ────────────────────────────────────────────────────────────────
function AuthGate({ onAuth }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    try {
      // Verify the key by calling the admin list endpoint
      await api.get('/kyc/admin/list?status=SUBMITTED&limit=1', { headers: { 'x-admin-key': key.trim() } });
      sessionStorage.setItem(SESSION_KEY, key.trim());
      onAuth(key.trim());
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Admin key galat hai');
      } else {
        // Any other error means key was accepted (network issue etc)
        sessionStorage.setItem(SESSION_KEY, key.trim());
        onAuth(key.trim());
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '2.5rem 2rem',
        maxWidth: 400, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛡️</div>
        <h2 style={{ margin: '0 0 0.25rem', color: '#1B5E20', fontSize: '1.4rem' }}>FarmTrace Admin</h2>
        <p style={{ color: '#888', marginBottom: '1.75rem', fontSize: '0.9rem' }}>KYC Review Panel</p>

        {error && (
          <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '1rem', color: '#C62828', fontSize: '0.88rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              type={show ? 'text' : 'password'}
              placeholder="Admin Secret Key"
              value={key}
              onChange={e => setKey(e.target.value)}
              style={{
                width: '100%', padding: '0.85rem 3rem 0.85rem 1rem',
                borderRadius: 12, border: '1.5px solid #E0E0E0',
                fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none',
                fontFamily: 'monospace'
              }}
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
            >
              <Eye size={18} />
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !key.trim()}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: 12, border: 'none',
              background: '#1B5E20', color: '#fff', fontWeight: 800, fontSize: '1rem',
              cursor: 'pointer', opacity: (loading || !key.trim()) ? 0.7 : 1
            }}
          >
            {loading ? 'Verifying...' : 'Admin Panel Kholein'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminKyc() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [activeTab, setActiveTab] = useState('SUBMITTED');
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ SUBMITTED: 0, VERIFIED: 0, REJECTED: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 15;

  const fetchList = useCallback(async (tab, pg) => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/kyc/admin/list?status=${tab}&page=${pg}&limit=${LIMIT}`,
        adminRequest(adminKey)
      );
      setSubmissions(res.data.submissions);
      setTotal(res.data.total);
    } catch (err) {
      if (err.response?.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        setAdminKey('');
      }
      toast.error('List load nahi hua');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  const fetchCounts = useCallback(async () => {
    if (!adminKey) return;
    try {
      const [pending, approved, rejected] = await Promise.all([
        api.get('/kyc/admin/list?status=SUBMITTED&limit=1', adminRequest(adminKey)),
        api.get('/kyc/admin/list?status=VERIFIED&limit=1', adminRequest(adminKey)),
        api.get('/kyc/admin/list?status=REJECTED&limit=1', adminRequest(adminKey))
      ]);
      setCounts({
        SUBMITTED: pending.data.total,
        VERIFIED: approved.data.total,
        REJECTED: rejected.data.total
      });
    } catch { /* ignore */ }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) {
      fetchList(activeTab, page);
      fetchCounts();
    }
  }, [adminKey, activeTab, page, fetchList, fetchCounts]);

  const handleStatusChange = () => {
    fetchList(activeTab, page);
    fetchCounts();
  };

  if (!adminKey) {
    return <AuthGate onAuth={setAdminKey} />;
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
        padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem'
      }}>
        <ShieldCheck size={28} color="#fff" />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 900 }}>FarmTrace Admin</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem' }}>KYC Review Panel</p>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <StatChip label="Pending" value={counts.SUBMITTED} color="#FF8F00" />
          <StatChip label="Approved" value={counts.VERIFIED} color="#69F0AE" />
          <StatChip label="Rejected" value={counts.REJECTED} color="#EF9A9A" />
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); setAdminKey(''); }}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700
          }}
        >
          <LogOut size={15} /> Logout
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.15s',
                background: activeTab === tab.key ? tab.color : '#fff',
                color: activeTab === tab.key ? '#fff' : tab.color,
                outline: activeTab === tab.key ? 'none' : `1.5px solid ${tab.color}`,
                boxShadow: activeTab === tab.key ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.key !== 'ALL' && (
                <span style={{
                  background: activeTab === tab.key ? 'rgba(255,255,255,0.3)' : tab.bg,
                  padding: '0.1rem 0.5rem', borderRadius: 20, fontSize: '0.78rem'
                }}>
                  {counts[tab.key] ?? 0}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={() => { fetchList(activeTab, page); fetchCounts(); }}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1rem', borderRadius: 10, border: '1.5px solid #DDD',
              cursor: 'pointer', background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.88rem'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="ft-spinner" style={{ width: 40, height: 40, margin: '0 auto' }} />
            <p style={{ color: '#888', marginTop: '1rem' }}>Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: 16 }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {activeTab === 'SUBMITTED' ? '🎉' : '📭'}
            </div>
            <p style={{ color: '#666', fontWeight: 700 }}>
              {activeTab === 'SUBMITTED' ? 'Koi pending submission nahi hai!' : 'Koi record nahi mila.'}
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Showing {submissions.length} of {total} submissions
            </p>
            {submissions.map(sub => (
              <KycCard
                key={sub.kycId}
                submission={sub}
                adminKey={adminKey}
                onStatusChange={handleStatusChange}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #DDD', cursor: 'pointer', background: '#fff', fontWeight: 700, opacity: page === 1 ? 0.4 : 1 }}
                >← Prev</button>
                <span style={{ color: '#666', fontSize: '0.9rem' }}>Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #DDD', cursor: 'pointer', background: '#fff', fontWeight: 700, opacity: page === totalPages ? 0.4 : 1 }}
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.3rem 0.75rem', minWidth: 60 }}>
      <div style={{ color, fontWeight: 900, fontSize: '1.1rem', lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', marginTop: '0.1rem' }}>{label}</div>
    </div>
  );
}
