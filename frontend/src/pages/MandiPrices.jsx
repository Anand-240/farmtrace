import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Search, RefreshCw, MapPin, BarChart2, ChevronRight, Flame, Zap } from 'lucide-react';
import api from '../lib/api';

const STATES = ['Uttar Pradesh', 'Punjab', 'Haryana', 'Maharashtra', 'Madhya Pradesh', 'Rajasthan', 'Gujarat', 'Bihar', 'West Bengal', 'Karnataka', 'Andhra Pradesh', 'Telangana'];

const CATEGORIES = {
  Grains:      { emoji: '🌾', keywords: ['wheat', 'rice', 'paddy', 'corn', 'maize', 'barley', 'soybean', 'jowar', 'bajra', 'ragi', 'gram', 'lentil', 'dal', 'moong', 'masur', 'arhar', 'urad'] },
  Vegetables:  { emoji: '🥦', keywords: ['tomato', 'potato', 'onion', 'bhindi', 'beetroot', 'bitter', 'ashgourd', 'brinjal', 'cabbage', 'cauliflower', 'carrot', 'spinach', 'pumpkin', 'cucumber', 'capsicum', 'radish', 'turnip', 'garlic', 'ginger', 'ladies', 'peas', 'beans'] },
  Fruits:      { emoji: '🍎', keywords: ['apple', 'apricot', 'banana', 'mango', 'orange', 'guava', 'papaya', 'grapes', 'pomegranate', 'watermelon', 'litchi', 'pear', 'plum', 'peach', 'kiwi', 'pineapple'] },
  'Cash Crops':{ emoji: '🪴', keywords: ['cotton', 'mustard', 'sugarcane', 'jute', 'groundnut', 'sunflower', 'sesame', 'linseed', 'tobacco', 'turmeric', 'chilli'] },
};

const CROP_EMOJIS = {
  wheat: '🌾', rice: '🌾', paddy: '🌾', tomato: '🍅', potato: '🥔',
  onion: '🧅', apple: '🍎', cotton: '🪴', mustard: '🌻', sugarcane: '🎋',
  corn: '🌽', maize: '🌽', mango: '🥭', soybean: '🫘', banana: '🍌',
  orange: '🍊', grapes: '🍇', garlic: '🧄', ginger: '🫚', chilli: '🌶️',
};

function getCropEmoji(name = '') {
  const k = name.toLowerCase().split(/[\s(]/)[0];
  return CROP_EMOJIS[k] || '🌱';
}

function getCategoryForCommodity(name = '') {
  const lower = name.toLowerCase();
  for (const [cat, { keywords }] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'Others';
}

function SparkBar({ price }) {
  const vals = [price * 0.86, price * 0.91, price * 0.95, price * 0.97, price];
  const max = Math.max(...vals);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '24px' }}>
      {vals.map((v, i) => (
        <div key={i} style={{ width: '6px', borderRadius: '2px 2px 0 0', background: i === vals.length - 1 ? 'var(--ft-forest)' : '#bbf7d0', height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

function PriceRangeBar({ min, modal, max }) {
  if (!max || max === min) return null;
  const pct = ((modal - min) / (max - min)) * 100;
  return (
    <div style={{ position: 'relative', height: '4px', background: '#e5f0e5', borderRadius: '4px', width: '80px' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--ft-forest)', borderRadius: '4px' }} />
    </div>
  );
}

export default function MandiPrices() {
  const navigate = useNavigate();
  const [state, setState] = useState('Punjab');
  const [commodity, setCommodity] = useState('');
  const [records, setRecords] = useState([]);
  const [allCommodities, setAllCommodities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const fetchCommodities = useCallback(async (s) => {
    try {
      const res = await api.get('/market/commodities', { params: { state: s } });
      setAllCommodities(res.data.commodities || []);
    } catch { setAllCommodities([]); }
  }, []);

  const fetchMandi = useCallback(async (s, c) => {
    setLoading(true);
    try {
      const res = await api.get('/market/mandi', { params: { state: s, commodity: c, limit: 20 } });
      setRecords(res.data.records || []);
      setLastUpdated(new Date());
    } catch { setRecords([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCommodities(state); }, [state, fetchCommodities]);
  useEffect(() => { fetchMandi(state, commodity); }, [state, commodity, fetchMandi]);

  const categorized = allCommodities.reduce((acc, c) => {
    const cat = getCategoryForCommodity(c.name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const tabs = ['All', ...Object.keys(categorized).sort()];

  const filtered = allCommodities
    .filter(c => activeTab === 'All' || getCategoryForCommodity(c.name) === activeTab)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...allCommodities].sort((a, b) => b.price - a.price);
  const topGainers = sorted.slice(0, 3);
  const topLosers = [...allCommodities].sort((a, b) => a.price - b.price).slice(0, 3);

  return (
    <div className="ft-page planetono-flow" style={{ background: '#f5f7f5', minHeight: '100vh' }}>
      {/* Nav */}
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart2 size={20} /> Mandi Prices</span>
          <button onClick={() => fetchMandi(state, commodity)} className="ft-btn ft-btn-ghost ft-btn-sm" disabled={loading}><RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /></button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '1.5rem', paddingBottom: '4rem', maxWidth: '960px' }}>

        {/* Header */}
        <div className="ft-anim-slide-up" style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--ft-forest)', margin: 0 }}>Real-Time Mandi Rates</h1>
          <p style={{ color: 'var(--ft-text-muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            Live prices from AGMARKNET &nbsp;·&nbsp;
            {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString('hi-IN')}` : 'Loading…'}
          </p>
        </div>

        {/* Controls row */}
        <div className="mp-controls" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1.5px solid var(--ft-border)', borderRadius: '10px', padding: '0.45rem 0.9rem' }}>
            <MapPin size={15} style={{ color: 'var(--ft-forest)' }} />
            <select value={state} onChange={e => { setState(e.target.value); setCommodity(''); }} style={{ border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: 600, background: 'transparent', cursor: 'pointer' }}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ft-text-muted)' }} />
            <input placeholder="Search commodity…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.3rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', fontSize: '0.9rem', boxSizing: 'border-box', background: '#fff' }} />
          </div>
        </div>

        {/* Top Movers */}
        {!loading && allCommodities.length > 0 && (
          <div className="mp-movers" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {/* Top Priced */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid var(--ft-border)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <Flame size={15} style={{ color: '#f97316' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Highest Rates</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topGainers.map(c => (
                  <div key={c.name} onClick={() => setCommodity(commodity === c.name ? '' : c.name)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0.3rem 0.5rem', borderRadius: '8px', background: commodity === c.name ? '#f0fdf4' : 'transparent' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{getCropEmoji(c.name)} {c.name}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--ft-forest)' }}>₹{c.price.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Lowest Priced */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid var(--ft-border)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <Zap size={15} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Affordable Rates</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topLosers.map(c => (
                  <div key={c.name} onClick={() => setCommodity(commodity === c.name ? '' : c.name)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0.3rem 0.5rem', borderRadius: '8px', background: commodity === c.name ? '#f0fdf4' : 'transparent' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{getCropEmoji(c.name)} {c.name}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#3b82f6' }}>₹{c.price.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Category Tabs */}
        {!loading && tabs.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
            {tabs.map(tab => {
              const catInfo = CATEGORIES[tab];
              const count = tab === 'All' ? allCommodities.length : (categorized[tab]?.length || 0);
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.83rem', transition: 'all 0.15s',
                    background: activeTab === tab ? 'var(--ft-forest)' : '#fff',
                    color: activeTab === tab ? '#fff' : 'var(--ft-text-muted)',
                    boxShadow: activeTab === tab ? '0 2px 8px rgba(0,100,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
                  }}>
                  {catInfo?.emoji || '📦'} {tab}
                  <span style={{ fontSize: '0.72rem', opacity: 0.7, fontWeight: 400 }}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Commodity List */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          {/* List Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#f8fdf8', borderBottom: '1px solid var(--ft-border)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commodity</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', width: '70px' }}>Price</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px', textAlign: 'center' }}>Trend</span>
            <span style={{ width: '24px' }} />
          </div>

          {/* Rows */}
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--ft-border)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '140px', height: '14px', background: '#f0f0f0', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
                <div style={{ flex: 1, height: '14px', background: '#f0f0f0', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ft-text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
              <p style={{ fontWeight: 600, margin: 0 }}>No commodities found</p>
            </div>
          ) : (
            filtered.map((c, idx) => {
              const isSelected = commodity === c.name;
              const cat = getCategoryForCommodity(c.name);
              const catColor = cat === 'Grains' ? '#d97706' : cat === 'Vegetables' ? '#16a34a' : cat === 'Fruits' ? '#ec4899' : '#7c3aed';
              return (
                <div key={c.name} onClick={() => setCommodity(isSelected ? '' : c.name)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.5rem', padding: '0.8rem 1.25rem', borderTop: idx === 0 ? 'none' : '1px solid var(--ft-border)', cursor: 'pointer', alignItems: 'center', transition: 'background 0.12s', background: isSelected ? '#f0fdf4' : 'transparent' }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = '#fafcfa'; }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  {/* Name + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{getCropEmoji(c.name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: catColor, background: catColor + '18', padding: '0.1rem 0.45rem', borderRadius: '10px', display: 'inline-block', marginTop: '0.1rem' }}>{cat}</span>
                    </div>
                  </div>
                  {/* Price */}
                  <div style={{ textAlign: 'right', width: '70px' }}>
                    <span style={{ fontWeight: 900, fontSize: '1rem', color: isSelected ? 'var(--ft-forest)' : '#111' }}>₹{c.price.toFixed(0)}</span>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ft-text-muted)', fontWeight: 500 }}>/kg</div>
                  </div>
                  {/* Spark */}
                  <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                    <SparkBar price={c.price} />
                  </div>
                  {/* Arrow */}
                  <ChevronRight size={16} style={{ color: isSelected ? 'var(--ft-forest)' : '#ccc', transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s, color 0.2s', flexShrink: 0 }} />
                </div>
              );
            })
          )}
        </div>

        {/* Mandi Records Table */}
        {commodity && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--ft-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fdf8' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--ft-forest)', fontSize: '1rem' }}>
                  {getCropEmoji(commodity)} {commodity} — Mandi-wise Rates
                </h3>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: 'var(--ft-text-muted)' }}>{state}</p>
              </div>
              {records.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 600, background: '#e8f5e9', padding: '0.25rem 0.6rem', borderRadius: '20px' }}>{records.length} mandis</span>}
            </div>

            {records.length === 0 && !loading ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--ft-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                <p style={{ fontWeight: 600, margin: 0 }}>No mandi data for {commodity} in {state}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="mp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafcfa' }}>
                      {['Mandi / Market', 'District', 'Min', 'Modal', 'Max', 'Range', ''].map((h, i) => (
                        <th key={i} className={h === 'Range' ? 'mp-hide-mobile' : ''} style={{ padding: '0.7rem 1rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => {
                      const modal = Number(r.modal_price) / 100;
                      const min = Number(r.min_price) / 100;
                      const max = Number(r.max_price) / 100;
                      const range = max - min;
                      const isUp = range > 0 ? modal >= min + range * 0.6 : true;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--ft-border)' }}
                          onMouseOver={e => e.currentTarget.style.background = '#f8fdf8'}
                          onMouseOut={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.88rem' }}>{r.market}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--ft-text-muted)' }}>{r.district}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>₹{min.toFixed(0)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: 'var(--ft-forest)', fontSize: '0.95rem' }}>₹{modal.toFixed(0)}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#16a34a', fontWeight: 600, fontSize: '0.85rem' }}>₹{max.toFixed(0)}</td>
                          <td className="mp-hide-mobile" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}><PriceRangeBar min={min} modal={modal} max={max} /></td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            {isUp ? <TrendingUp size={16} style={{ color: '#16a34a' }} /> : <TrendingDown size={16} style={{ color: '#dc2626' }} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

        /* Mobile: hide Range column, shrink table */
        @media (max-width: 600px) {
          .mp-hide-mobile { display: none !important; }
          .mp-table td, .mp-table th { padding: 0.55rem 0.5rem !important; font-size: 0.78rem !important; }
        }
        @media (max-width: 480px) {
          .mp-controls { flex-direction: column !important; }
          .mp-controls > div { width: 100% !important; }
          .mp-movers { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
