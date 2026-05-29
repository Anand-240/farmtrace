import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

/* ── Star Rating Component ── */
function StarRating({ value, onChange, size = 24 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <svg
          key={s} width={size} height={size} viewBox="0 0 24 24"
          fill={(hover || value) >= s ? '#f59e0b' : 'none'}
          stroke="#f59e0b" strokeWidth="1.8"
          style={{ cursor: onChange ? 'pointer' : 'default', transition: 'transform 0.1s', transform: hover === s ? 'scale(1.2)' : 'scale(1)' }}
          onClick={() => onChange?.(s)}
          onMouseOver={() => setHover(s)}
          onMouseOut={() => setHover(0)}
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </div>
  );
}

const ROLE_LABELS = { FARMER: 'Farmer', DISTRIBUTOR: 'Distributor', RETAILER: 'Retailer' };
const ROLE_COLORS = { FARMER: '#166534', DISTRIBUTOR: '#1d4ed8', RETAILER: '#7c3aed' };
const ROLE_BG    = { FARMER: '#dcfce7', DISTRIBUTOR: '#dbeafe', RETAILER: '#ede9fe' };

/* ── Rate Modal ── */
function RateModal({ onClose, onRated }) {
  const [step, setStep] = useState(1); // 1 = lookup, 2 = rate
  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [buyer, setBuyer] = useState(null);
  const [form, setForm] = useState({ rating: 0, paymentTimeliness: 0, communication: 0, fairness: 0, review: '' });
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLooking(true);
    setBuyer(null);
    try {
      const res = await api.get(`/rating/lookup?q=${encodeURIComponent(query.trim())}`);
      setBuyer(res.data);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'User not found');
    } finally {
      setLooking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!buyer) return;
    if (!form.rating) return toast.error('Overall rating is required');
    setSaving(true);
    try {
      await api.post('/rating', {
        buyerId: buyer.id,
        buyerName: buyer.name,
        ...form
      });
      toast.success('Rating submitted successfully!');
      onRated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit rating');
    } finally {
      setSaving(false);
    }
  };

  const ratingCategories = [
    { key: 'rating',            label: 'Overall Rating',      icon: '⭐', required: true },
    { key: 'paymentTimeliness', label: 'Payment Timeliness',  icon: '💳' },
    { key: 'communication',     label: 'Communication',       icon: '💬' },
    { key: 'fairness',          label: 'Fairness & Honesty',  icon: '⚖️' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '500px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden'
      }}>
        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.92) translateY(20px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)', fontSize: '1.2rem' }}>
              {step === 1 ? 'Find Buyer to Rate' : 'Rate This Buyer'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--ft-text-muted)' }}>
              {step === 1 ? 'Search by email address or phone number' : 'Share your honest experience'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Step dots */}
            {[1, 2].map(n => (
              <div key={n} style={{
                width: n === step ? 20 : 8, height: 8, borderRadius: '999px',
                background: n <= step ? 'var(--ft-forest)' : '#e2e8f0',
                transition: 'all 0.3s ease'
              }} />
            ))}
            <button
              onClick={onClose}
              style={{ marginLeft: '0.5rem', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#64748b' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Step 1 — Lookup */}
        {step === 1 && (
          <div style={{ padding: '1.5rem' }}>
            <form onSubmit={handleLookup}>
              <label style={labelStyle}>Email or Phone Number</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', pointerEvents: 'none' }}>
                    {query.includes('@') ? '📧' : '📱'}
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="name@email.com or +91 98765 43210"
                    style={{ ...inputStyle, paddingLeft: '38px' }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={looking || !query.trim()}
                  style={{
                    padding: '0 1.25rem', background: 'var(--ft-forest)', color: '#fff',
                    border: 'none', borderRadius: '10px', fontWeight: 700, cursor: looking ? 'wait' : 'pointer',
                    fontSize: '0.85rem', whiteSpace: 'nowrap', opacity: !query.trim() ? 0.6 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  {looking ? '…' : 'Search'}
                </button>
              </div>
              <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--ft-text-muted)', lineHeight: 1.5 }}>
                Enter the buyer's registered email address or 10-digit phone number to look them up.
              </p>
            </form>

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Why verify identity?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                Linking ratings to verified accounts prevents fake reviews and ensures fairness for all buyers on the platform.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Rate Form */}
        {step === 2 && buyer && (
          <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Buyer Identity Card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.875rem 1rem', background: '#f0fdf4',
              borderRadius: '14px', border: '1px solid #bbf7d0', marginBottom: '1.5rem'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: ROLE_BG[buyer.role] || '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', fontWeight: 900, color: ROLE_COLORS[buyer.role] || '#334155', flexShrink: 0
              }}>
                {buyer.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buyer.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {buyer.phone || buyer.email}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase',
                  background: ROLE_BG[buyer.role] || '#f1f5f9', color: ROLE_COLORS[buyer.role] || '#334155'
                }}>
                  {ROLE_LABELS[buyer.role] || buyer.role}
                </span>
                <button onClick={() => { setStep(1); setBuyer(null); }} style={{ background: 'none', border: 'none', fontSize: '0.7rem', color: '#64748b', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  Change
                </button>
              </div>
            </div>

            {/* Rating Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {ratingCategories.map(cat => (
                <div key={cat.key}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{cat.icon}</span>
                    {cat.label}
                    {cat.required && <span style={{ color: 'var(--ft-error)', fontSize: '0.8em' }}>*</span>}
                  </label>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <StarRating value={form[cat.key]} onChange={v => setForm(p => ({ ...p, [cat.key]: v }))} size={26} />
                    {form[cat.key] > 0 && (
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: form[cat.key] >= 4 ? '#16a34a' : form[cat.key] >= 3 ? '#d97806' : '#dc2626' }}>
                        {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][form[cat.key]]}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <div>
                <label style={labelStyle}>Review (optional)</label>
                <textarea
                  value={form.review}
                  onChange={e => setForm(p => ({ ...p, review: e.target.value }))}
                  rows={3}
                  placeholder="Share your experience with this buyer — payment, communication, professionalism..."
                  style={{ ...inputStyle, resize: 'vertical', marginTop: '0.4rem', minHeight: '80px', lineHeight: 1.5 }}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !form.rating}
                style={{
                  padding: '0.875rem', background: form.rating ? 'var(--ft-forest)' : '#94a3b8',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontWeight: 800, cursor: saving || !form.rating ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem', transition: 'background 0.2s'
                }}
              >
                {saving ? 'Submitting…' : 'Submit Rating'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function BuyerRatings() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRate, setShowRate] = useState(false);
  const MEDAL = ['🥇', '🥈', '🥉'];

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/rating/leaderboard');
      setLeaderboard(r.data.leaderboard || []);
    } catch {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="ft-page" style={{ background: 'var(--ft-bg)' }}>
      {showRate && <RateModal onClose={() => setShowRate(false)} onRated={load} />}

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--ft-border)',
        padding: '0 1.5rem', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <button onClick={() => navigate('/dashboard')} style={navBtnStyle}>
          ← Dashboard
        </button>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--ft-forest)' }}>
          ⭐ Buyer Ratings
        </span>
        <button
          onClick={() => setShowRate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--ft-forest)', color: '#fff',
            border: 'none', padding: '8px 16px', borderRadius: '10px',
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
          }}
        >
          + Rate a Buyer
        </button>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>

        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>
            Buyer Trust Scores
          </h1>
          <p style={{ color: 'var(--ft-text-muted)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Community-verified ratings for every buyer. Rate by their email or phone number for fair, fraud-proof reviews.
          </p>
        </div>

        {/* Leaderboard */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏅 Top Trusted Buyers
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--ft-text-muted)', fontWeight: 600 }}>
              Top {leaderboard.length} this month
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '130px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', borderRadius: '16px', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
              ))}
              <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '4rem 2rem',
              background: '#fff', borderRadius: '20px', border: '1px solid var(--ft-border)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
              <h3 style={{ margin: '0 0 0.5rem', color: 'var(--ft-forest)' }}>No ratings yet</h3>
              <p style={{ color: 'var(--ft-text-muted)', marginBottom: '1.5rem' }}>Be the first to rate a buyer and build community trust.</p>
              <button
                onClick={() => setShowRate(true)}
                style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Rate a Buyer
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {leaderboard.map((b, i) => (
                <div key={b._id} style={{
                  background: '#fff', borderRadius: '16px', padding: '1.25rem',
                  border: `1.5px solid ${i < 3 ? '#fde68a' : 'var(--ft-border)'}`,
                  boxShadow: i < 3 ? '0 4px 20px rgba(245,158,11,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {i < 3 && (
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                      padding: '4px 12px', borderRadius: '0 16px 0 12px',
                      fontSize: '0.65rem', fontWeight: 800, color: '#92400e'
                    }}>
                      #{i + 1} TRUSTED
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: i < 3 ? '#fef3c7' : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: i < 3 ? '1.4rem' : '0.9rem', fontWeight: 900,
                      color: i < 3 ? '#d97806' : '#64748b', flexShrink: 0
                    }}>
                      {i < 3 ? MEDAL[i] : `#${i + 1}`}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.buyerName}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--ft-text-muted)' }}>{b.totalRatings} verified rating{b.totalRatings !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <StarRating value={Math.round(b.avgRating)} size={18} />
                    <span style={{
                      fontWeight: 900, fontSize: '1.15rem',
                      color: b.avgRating >= 4 ? '#16a34a' : b.avgRating >= 3 ? '#d97806' : '#dc2626'
                    }}>
                      {b.avgRating.toFixed(1)}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.75rem', height: '5px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(b.avgRating / 5) * 100}%`, height: '100%',
                      background: b.avgRating >= 4 ? 'linear-gradient(90deg, #4ade80, #16a34a)' : b.avgRating >= 3 ? 'linear-gradient(90deg, #fbbf24, #d97806)' : 'linear-gradient(90deg, #f87171, #dc2626)',
                      borderRadius: '999px', transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '20px', padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontWeight: 900, color: 'var(--ft-forest)', fontSize: '1.05rem' }}>
            How Buyer Trust Score Works
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: '📧', title: 'Email or Phone Lookup', desc: 'Buyers are found by their registered email or phone — no guessing names' },
              { icon: '⭐', title: 'Multi-Dimensional', desc: 'Overall + Payment, Communication & Fairness sub-scores' },
              { icon: '✅', title: 'Verified Identity', desc: 'Ratings link to real accounts, preventing fake reviews' },
              { icon: '🔒', title: 'Fair & Honest', desc: 'One rating per transaction per buyer prevents manipulation' }
            ].map(item => (
              <div key={item.title} style={{ background: '#fff', borderRadius: '14px', padding: '1rem', border: '1px solid rgba(22,101,52,0.1)' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--ft-forest)' }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: '0.77rem', color: '#64748b', lineHeight: 1.4 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: '0.82rem', fontWeight: 700, color: '#374151', display: 'block'
};

const inputStyle = {
  width: '100%', padding: '0.7rem 0.875rem',
  borderRadius: '10px', border: '1.5px solid #e2e8f0',
  fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s', fontFamily: 'inherit'
};

const navBtnStyle = {
  background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#374151',
  padding: '6px 14px', borderRadius: '8px', fontWeight: 700,
  fontSize: '0.82rem', cursor: 'pointer'
};
