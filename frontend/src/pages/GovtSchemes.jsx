import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, ExternalLink, CheckCircle2, Search } from 'lucide-react';
import api from '../lib/api';

const CATEGORY_LABELS = { INCOME_SUPPORT: { label: 'Income Support', color: '#16a34a', icon: '💰' }, INSURANCE: { label: 'Insurance', color: '#3b82f6', icon: '🛡️' }, CREDIT: { label: 'Credit & Loans', color: '#7c3aed', icon: '💳' }, INFRASTRUCTURE: { label: 'Infrastructure', color: '#d97706', icon: '🏗️' }, MARKET_ACCESS: { label: 'Market Access', color: '#059669', icon: '🏪' }, SUSTAINABLE_FARMING: { label: 'Sustainable Farming', color: '#10b981', icon: '🌿' }, TRAINING: { label: 'Training', color: '#6b7280', icon: '📚' } };

export default function GovtSchemes() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('eligible');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expanded, setExpanded] = useState({});

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();

  useEffect(() => {
    Promise.all([
      api.get('/schemes').then(r => setSchemes(r.data.schemes || [])).catch(() => {}),
      api.get('/schemes/eligible').then(r => setEligible(r.data.schemes || [])).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const displayed = (activeTab === 'eligible' ? eligible : schemes).filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory && s.category !== selectedCategory) return false;
    return true;
  });

  if (loading) return <div className="ft-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><div className="ft-spinner" /></div>;

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Landmark size={20} /> Govt Schemes</span>
          <div style={{ width: 80 }} />
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Government Schemes</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Subsidies, insurance, loans & welfare schemes for {user.role || 'farmers'}</p>
        </div>

        {/* Eligibility Banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--ft-forest), #16a34a)', color: '#fff', borderRadius: '16px', padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.25rem' }}>You are eligible for {eligible.length} schemes!</div>
            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Based on your role as {user.role || 'FARMER'} on FarmTrace</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '1rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{eligible.length}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Eligible Schemes</div>
          </div>
        </div>

        {/* Tabs + Filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', borderRadius: '12px', border: '1.5px solid var(--ft-border)', overflow: 'hidden' }}>
            {[{ key: 'eligible', label: `Eligible (${eligible.length})` }, { key: 'all', label: `All Schemes (${schemes.length})` }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '0.6rem 1.25rem', border: 'none', background: activeTab === t.key ? 'var(--ft-forest)' : '#fff', color: activeTab === t.key ? '#fff' : 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>{t.label}</button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ft-text-muted)' }} />
            <input placeholder="Search schemes..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', fontSize: '0.9rem', fontWeight: 600, background: '#fff' }}>
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => {
            const count = displayed.filter(s => s.category === k).length;
            if (!count) return null;
            return (
              <span key={k} onClick={() => setSelectedCategory(selectedCategory === k ? '' : k)} style={{ padding: '0.3rem 0.85rem', borderRadius: '999px', background: selectedCategory === k ? v.color : `${v.color}15`, color: selectedCategory === k ? '#fff' : v.color, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: `2px solid ${v.color}30` }}>
                {v.icon} {v.label} ({count})
              </span>
            );
          })}
        </div>

        {/* Scheme Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayed.map(s => {
            const cat = CATEGORY_LABELS[s.category] || { icon: '📋', color: '#6b7280', label: s.category };
            const isExpanded = expanded[s.id];
            return (
              <div key={s.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid var(--ft-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }} onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ background: `${cat.color}15`, color: cat.color, padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>{cat.icon} {cat.label}</span>
                      {eligible.find(e => e.id === s.id) && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={12} /> Eligible</span>}
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem', fontWeight: 900, fontSize: '1.05rem', color: 'var(--ft-forest)', lineHeight: 1.3 }}>{s.name}</h3>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.88rem', color: '#555', lineHeight: 1.4 }}><strong>Benefit:</strong> {s.benefit}</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ft-text-muted)' }}>{s.ministry}</p>
                  </div>
                  <span style={{ fontSize: '1.25rem', color: 'var(--ft-text-muted)', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--ft-border)', paddingTop: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>How to Apply</div>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{s.applicationProcess}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Deadline</div>
                        <div style={{ fontSize: '0.9rem' }}>{s.deadline}</div>
                      </div>
                    </div>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Documents Required</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {s.documents.map(d => <span key={d} style={{ background: '#f3f4f6', padding: '0.3rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}>📄 {d}</span>)}
                      </div>
                    </div>
                    {s.portalUrl && (
                      <a href={s.portalUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--ft-forest)', color: '#fff', borderRadius: '10px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
                        <ExternalLink size={16} /> Apply on Official Portal
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {displayed.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}><p style={{ fontSize: '2rem' }}>🏛️</p><p style={{ color: 'var(--ft-text-muted)', fontWeight: 600 }}>Koi scheme nahi mili</p></div>}
        </div>
      </div>
    </div>
  );
}
