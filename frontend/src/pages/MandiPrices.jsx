import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Search, RefreshCw, MapPin, BarChart2 } from 'lucide-react';
import api from '../lib/api';

const STATES = ['Uttar Pradesh', 'Punjab', 'Haryana', 'Maharashtra', 'Madhya Pradesh', 'Rajasthan', 'Gujarat', 'Bihar', 'West Bengal', 'Karnataka', 'Andhra Pradesh', 'Telangana'];

const CROP_EMOJIS = {
  wheat: '🌾', rice: '🌾', paddy: '🌾', tomato: '🍅', potato: '🥔',
  onion: '🧅', apple: '🍎', cotton: '🪴', mustard: '🌻', sugarcane: '🎋', corn: '🌽', mango: '🥭', soybean: '🫘'
};

function getCropEmoji(name = '') {
  const k = name.toLowerCase().split(' ')[0];
  return CROP_EMOJIS[k] || '🌱';
}

function PriceTrend({ price }) {
  const mock = [price * 0.88, price * 0.92, price * 0.96, price * 0.98, price];
  const max = Math.max(...mock);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '32px' }}>
      {mock.map((v, i) => (
        <div key={i} style={{ width: '8px', borderRadius: '3px 3px 0 0', background: i === mock.length - 1 ? 'var(--ft-forest)' : '#bbf7d0', height: `${(v / max) * 100}%` }} />
      ))}
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

  const filtered = allCommodities.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart2 size={20} /> Mandi Prices</span>
          <button onClick={() => fetchMandi(state, commodity)} className="ft-btn ft-btn-ghost ft-btn-sm" disabled={loading}><RefreshCw size={16} /></button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div className="ft-anim-slide-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Real-Time Mandi Rates</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Live prices from AGMARKNET across all major mandis</p>
          {lastUpdated && <p style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', marginTop: '0.25rem' }}>Updated: {lastUpdated.toLocaleTimeString('hi-IN')}</p>}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1.5px solid var(--ft-border)', borderRadius: '12px', padding: '0.5rem 1rem' }}>
            <MapPin size={16} style={{ color: 'var(--ft-forest)' }} />
            <select value={state} onChange={e => setState(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '0.95rem', fontWeight: 600, background: 'transparent', cursor: 'pointer' }}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ft-text-muted)' }} />
            <input placeholder="Search commodity..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.7rem 0.75rem 0.7rem 2.5rem', borderRadius: '12px', border: '1.5px solid var(--ft-border)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Commodity Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          {loading ? Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ background: '#f8faf8', borderRadius: '14px', height: '120px', animation: 'pulse 1.5s infinite' }} />
          )) : filtered.map((c) => (
            <div key={c.name} onClick={() => setCommodity(commodity === c.name ? '' : c.name)}
              style={{ background: commodity === c.name ? 'var(--ft-forest)' : '#fff', color: commodity === c.name ? '#fff' : 'inherit', borderRadius: '14px', border: `2px solid ${commodity === c.name ? 'var(--ft-forest)' : 'var(--ft-border)'}`, padding: '1.25rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{getCropEmoji(c.name)}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{c.name}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>₹{c.price.toFixed(0)}/kg</div>
              <div style={{ marginTop: '0.5rem' }}><PriceTrend price={c.price} /></div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--ft-text-muted)' }}>Koi commodity nahi mili</div>}
        </div>

        {/* Mandi Records Table */}
        {records.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--ft-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--ft-forest)' }}>Mandi-wise Rates — {state}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--ft-text-muted)' }}>{records.length} mandis</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fdf8' }}>
                    {['Commodity', 'Mandi / Market', 'District', 'Min Price', 'Modal Price', 'Max Price', 'Trend'].map(h => (
                      <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const modal = Number(r.modal_price) / 100;
                    const min = Number(r.min_price) / 100;
                    const max = Number(r.max_price) / 100;
                    const isUp = modal >= (min + max) / 2;
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--ft-border)', transition: 'background 0.15s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fdf8'} onMouseOut={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{getCropEmoji(r.commodity || r.comm)} {r.commodity || r.comm}</td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem' }}>{r.market}</td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', color: 'var(--ft-text-muted)' }}>{r.district}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#dc2626', fontWeight: 600 }}>₹{min.toFixed(2)}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 900, color: 'var(--ft-forest)', fontSize: '1.05rem' }}>₹{modal.toFixed(2)}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#16a34a', fontWeight: 600 }}>₹{max.toFixed(2)}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {isUp ? <TrendingUp size={18} style={{ color: '#16a34a' }} /> : <TrendingDown size={18} style={{ color: '#dc2626' }} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && records.length === 0 && commodity && (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
            <p style={{ fontSize: '1.5rem' }}>📊</p>
            <p style={{ color: 'var(--ft-text-muted)', fontWeight: 600 }}>{commodity} ke liye {state} mein mandi data nahi mila</p>
          </div>
        )}
      </div>
    </div>
  );
}
