import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, Clock, TrendingUp, PlusCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();

function Countdown({ endTime }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endTime) - Date.now();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  const isEnding = new Date(endTime) - Date.now() < 3600000;
  return <span style={{ color: isEnding ? '#dc2626' : '#16a34a', fontWeight: 700 }}><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />{timeLeft}</span>;
}

function CreateAuctionModal({ onClose, onCreated }) {
  const [produces, setProduces] = useState([]);
  const [form, setForm] = useState({ produceId: '', basePrice: '', reservePrice: '', incrementAmount: '50', autoAcceptPrice: '', hours: '24', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/produce/farmer/my').then(r => setProduces(r.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.produceId || !form.basePrice) return toast.error('Produce aur base price required hai');
    setSaving(true);
    try {
      const endTime = new Date(Date.now() + Number(form.hours) * 3600000).toISOString();
      await api.post('/auction', {
        produceId: form.produceId,
        basePrice: Number(form.basePrice),
        reservePrice: form.reservePrice ? Number(form.reservePrice) : undefined,
        incrementAmount: Number(form.incrementAmount) || 50,
        autoAcceptPrice: form.autoAcceptPrice ? Number(form.autoAcceptPrice) : undefined,
        endTime,
        description: form.description
      });
      toast.success('Auction create ho gaya!');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)' }}>New Auction</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Produce Select Karein *</label>
            <select value={form.produceId} onChange={e => setForm(f => ({ ...f, produceId: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem' }} required>
              <option value="">-- Select Produce --</option>
              {produces.map(p => <option key={p._id} value={p._id}>{p.cropType} — {p.quantity}kg — Grade {p.qualityGrade}</option>)}
            </select>
          </div>
          {[
            { label: 'Base Price (₹/kg) *', key: 'basePrice', type: 'number', placeholder: 'e.g. 1500' },
            { label: 'Reserve Price (₹/kg)', key: 'reservePrice', type: 'number', placeholder: 'Min price to accept' },
            { label: 'Bid Increment (₹)', key: 'incrementAmount', type: 'number', placeholder: '50' },
            { label: 'Auto-Accept Price (₹/kg)', key: 'autoAcceptPrice', type: 'number', placeholder: 'Instant sell agar bid aaye' }
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Duration</label>
            <select value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
              {[1, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Produce ke baare mein kuch batayein..." style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={saving} className="ft-btn" style={{ background: 'var(--ft-forest)', color: '#fff', padding: '0.9rem', borderRadius: '12px', fontWeight: 800, border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}>
            {saving ? 'Creating...' : 'Create Auction'}
          </button>
        </form>
      </div>
    </div>
  );
}

function BidModal({ auction, onClose, onBid }) {
  const [amount, setAmount] = useState(String((auction.currentBid || auction.basePrice) + (auction.incrementAmount || 50)));
  const [placing, setPlacing] = useState(false);
  const minBid = (auction.currentBid || auction.basePrice) + (auction.incrementAmount || 50);

  const handleBid = async () => {
    if (Number(amount) < minBid) return toast.error(`Minimum bid ₹${minBid} hona chahiye`);
    setPlacing(true);
    try {
      await api.post(`/auction/${auction._id}/bid`, { amount: Number(amount) });
      toast.success('Bid place ho gaya!');
      onBid();
      onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setPlacing(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900 }}>Place Bid</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ background: '#f8fdf8', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.25rem', fontWeight: 800, fontSize: '1.1rem' }}>{auction.cropType}</p>
          <p style={{ margin: 0, color: 'var(--ft-text-muted)', fontSize: '0.9rem' }}>Current: <strong style={{ color: 'var(--ft-forest)' }}>₹{auction.currentBid || auction.basePrice}/kg</strong> · Min next: <strong>₹{minBid}</strong></p>
        </div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={minBid} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '2px solid var(--ft-forest)', fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', marginBottom: '1rem', boxSizing: 'border-box' }} />
        <button onClick={handleBid} disabled={placing} style={{ width: '100%', padding: '0.9rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
          {placing ? 'Placing...' : `Bid ₹${amount}`}
        </button>
      </div>
    </div>
  );
}

export default function AuctionPage() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const [bidTarget, setBidTarget] = useState(null);
  const [expandedBids, setExpandedBids] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/auctions', { params: { status: statusFilter } });
      setAuctions(res.data.auctions || []);
    } catch { toast.error('Auctions load nahi ho paye'); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const closeAuction = async (id) => {
    try {
      await api.patch(`/auction/${id}/close`);
      toast.success('Auction closed!');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const CROP_EMOJIS = { wheat: '🌾', rice: '🌾', tomato: '🍅', potato: '🥔', onion: '🧅', cotton: '🪴' };
  const getEmoji = (c = '') => CROP_EMOJIS[c.toLowerCase().split(' ')[0]] || '🌱';

  return (
    <div className="ft-page planetono-flow">
      {showCreate && <CreateAuctionModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {bidTarget && <BidModal auction={bidTarget} onClose={() => setBidTarget(null)} onBid={load} />}

      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Gavel size={20} /> Live Auctions</span>
          <button onClick={() => setShowCreate(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><PlusCircle size={16} /> New</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>eNAM-Style Bidding</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Multi-buyer competitive bidding for best price discovery</p>
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['ACTIVE', 'SOLD', 'CLOSED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '0.5rem 1.25rem', borderRadius: '999px', border: `2px solid ${statusFilter === s ? 'var(--ft-forest)' : 'var(--ft-border)'}`, background: statusFilter === s ? 'var(--ft-forest)' : '#fff', color: statusFilter === s ? '#fff' : 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '300px', background: '#f0f4f0', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : auctions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
            <p style={{ fontSize: '3rem' }}>🏷</p>
            <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)' }}>Koi auction nahi hai abhi</p>
            <button onClick={() => setShowCreate(true)} style={{ marginTop: '1rem', padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Create First Auction</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {auctions.map(a => (
              <div key={a._id} style={{ background: '#fff', borderRadius: '16px', border: `2px solid ${a.status === 'ACTIVE' ? 'var(--ft-forest)' : 'var(--ft-border)'}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ background: a.status === 'ACTIVE' ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#f8f8f8', padding: '1.25rem', borderBottom: '1px solid var(--ft-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '2rem' }}>{getEmoji(a.cropType)}</span>
                      <h3 style={{ margin: '0.25rem 0 0', fontWeight: 900, fontSize: '1.2rem', color: 'var(--ft-forest)' }}>{a.cropType}</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ft-text-muted)' }}>{a.quantity}kg · Grade {a.qualityGrade} · {a.origin}</p>
                    </div>
                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, background: a.status === 'ACTIVE' ? '#dcfce7' : a.status === 'SOLD' ? '#fef3c7' : '#f3f4f6', color: a.status === 'ACTIVE' ? '#16a34a' : a.status === 'SOLD' ? '#b45309' : '#6b7280' }}>
                      {a.status}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ft-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Base Price</p>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>₹{a.basePrice}/kg</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ft-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Current Bid</p>
                      <p style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: 'var(--ft-forest)' }}>₹{a.currentBid || a.basePrice}/kg</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--ft-text-muted)' }}>By <strong>{a.sellerName}</strong></span>
                    {a.status === 'ACTIVE' && <Countdown endTime={a.endTime} />}
                    {a.status !== 'ACTIVE' && <span style={{ color: 'var(--ft-text-muted)' }}>{a.bids.length} bids</span>}
                  </div>

                  {a.currentWinnerName && a.status === 'ACTIVE' && (
                    <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingUp size={14} style={{ color: '#16a34a' }} />
                      <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>Leading: {a.currentWinnerName}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {a.status === 'ACTIVE' && String(a.sellerId) !== String(user.id) && (
                      <button onClick={() => setBidTarget(a)} style={{ flex: 1, padding: '0.75rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                        Place Bid
                      </button>
                    )}
                    {a.status === 'ACTIVE' && String(a.sellerId) === String(user.id) && (
                      <button onClick={() => closeAuction(a._id)} style={{ flex: 1, padding: '0.75rem', background: '#fff', color: '#dc2626', border: '2px solid #dc2626', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                        Close Auction
                      </button>
                    )}
                    {a.bids.length > 0 && (
                      <button onClick={() => setExpandedBids(prev => ({ ...prev, [a._id]: !prev[a._id] }))} style={{ padding: '0.75rem', background: '#f8f8f8', border: '1px solid var(--ft-border)', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                        {expandedBids[a._id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {a.bids.length}
                      </button>
                    )}
                  </div>

                  {expandedBids[a._id] && a.bids.length > 0 && (
                    <div style={{ marginTop: '1rem', background: '#f8fdf8', borderRadius: '10px', padding: '0.75rem', maxHeight: '150px', overflowY: 'auto' }}>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase' }}>Bid History</p>
                      {[...a.bids].reverse().map((b, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: i < a.bids.length - 1 ? '1px solid #e5e7eb' : 'none', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600 }}>{b.bidderName}</span>
                          <span style={{ color: 'var(--ft-forest)', fontWeight: 800 }}>₹{b.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
