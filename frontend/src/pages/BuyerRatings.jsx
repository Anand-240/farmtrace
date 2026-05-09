import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Trophy, Plus, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

function StarRating({ value, onChange, size = 24 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size} fill={(hover || value) >= s ? '#f59e0b' : 'none'} stroke="#f59e0b" style={{ cursor: onChange ? 'pointer' : 'default', transition: 'transform 0.1s' }} onClick={() => onChange?.(s)} onMouseOver={() => setHover(s)} onMouseOut={() => setHover(0)} />
      ))}
    </div>
  );
}

function RateModal({ onClose, onRated }) {
  const [form, setForm] = useState({ buyerName: '', rating: 0, paymentTimeliness: 0, communication: 0, fairness: 0, review: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.buyerName || !form.rating) return toast.error('Buyer name aur overall rating required hai');
    setSaving(true);
    try {
      await api.post('/rating', { ...form, buyerId: 'manual-' + Date.now() });
      toast.success('Rating submit ho gaya!');
      onRated(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)' }}>Rate a Buyer</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Buyer Name *</label>
            <input type="text" value={form.buyerName} onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))} placeholder="Enter buyer's name" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} required />
          </div>

          {[{ label: 'Overall Rating *', key: 'rating' }, { label: 'Payment Timeliness', key: 'paymentTimeliness' }, { label: 'Communication', key: 'communication' }, { label: 'Fairness', key: 'fairness' }].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{f.label}</label>
              <StarRating value={form[f.key]} onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} size={28} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Review</label>
            <textarea value={form.review} onChange={e => setForm(f => ({ ...f, review: e.target.value }))} rows={3} placeholder="Transaction ke baare mein kuch batayein..." style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
            {saving ? 'Submitting...' : 'Submit Rating'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BuyerRatings() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRate, setShowRate] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/rating/leaderboard'); setLeaderboard(r.data.leaderboard || []); } catch { toast.error('Load failed'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <div className="ft-page planetono-flow">
      {showRate && <RateModal onClose={() => setShowRate(false)} onRated={load} />}

      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Star size={20} /> Buyer Ratings</span>
          <button onClick={() => setShowRate(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><Plus size={16} /> Rate</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Buyer Verification & Trust Scores</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Community-driven ratings for reliable trade. Rate buyers, build trust.</p>
        </div>

        {/* Top Rated Buyers */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontWeight: 900, color: 'var(--ft-forest)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={20} /> Top Trusted Buyers
          </h2>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: '140px', background: '#f0f4f0', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
              <p style={{ fontSize: '2.5rem' }}>⭐</p>
              <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)', marginBottom: '1rem' }}>Abhi tak koi buyer rated nahi hua</p>
              <button onClick={() => setShowRate(true)} style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Be the First to Rate</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {leaderboard.map((b, i) => (
                <div key={b._id} style={{ background: '#fff', borderRadius: '14px', padding: '1.25rem', border: `2px solid ${i < 3 ? '#f59e0b30' : 'var(--ft-border)'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: i < 3 ? '#fef3c7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 900 }}>
                      {i < 3 ? MEDAL[i] : `#${i + 1}`}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{b.buyerName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)' }}>{b.totalRatings} ratings</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StarRating value={Math.round(b.avgRating)} size={18} />
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#f59e0b' }}>{b.avgRating.toFixed(1)}</span>
                  </div>
                  <div style={{ marginTop: '0.75rem', height: '6px', background: '#f0f0f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${(b.avgRating / 5) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #16a34a)', borderRadius: '999px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: '16px', padding: '2rem' }}>
          <h3 style={{ fontWeight: 900, color: 'var(--ft-forest)', marginBottom: '1rem' }}>How Buyer Trust Score Works</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { icon: '⭐', title: 'Multi-Dimensional', desc: 'Overall rating + Payment, Communication & Fairness sub-scores' },
              { icon: '✅', title: 'Verified Trades', desc: 'Ratings from actual transactions carry more weight' },
              { icon: '🏆', title: 'Trust Leaderboard', desc: 'Top buyers gain visibility — good behavior is rewarded' },
              { icon: '🔒', title: 'Fair & Honest', desc: 'One rating per transaction prevents manipulation' }
            ].map(item => (
              <div key={item.title} style={{ background: '#fff', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ fontWeight: 800, color: 'var(--ft-forest)', marginBottom: '0.25rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.82rem', color: '#555', lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
