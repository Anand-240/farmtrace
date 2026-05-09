import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Warehouse as WarehouseIcon, Plus, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const TYPE_LABELS = { COLD_STORAGE: { label: 'Cold Storage', icon: '❄️', color: '#3b82f6' }, DRY: { label: 'Dry Storage', icon: '🏭', color: '#d97706' }, SILOS: { label: 'Silos', icon: '🌾', color: '#16a34a' }, GENERAL: { label: 'General', icon: '📦', color: '#6b7280' } };

function StockModal({ warehouse, type, onClose, onDone }) {
  const [form, setForm] = useState({ cropType: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantity) return toast.error('Quantity required');
    setSaving(true);
    try {
      const endpoint = type === 'IN' ? 'stock-in' : 'stock-out';
      const res = await api.post(`/warehouse/${warehouse._id}/${endpoint}`, { ...form, quantity: Number(form.quantity) });
      toast.success(type === 'IN' ? `Stock in! Receipt: ${res.data.receiptNo}` : 'Stock out ho gaya!');
      onDone();
      onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900 }}>Stock {type === 'IN' ? 'IN' : 'OUT'} — {warehouse.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[{ label: 'Crop Type', key: 'cropType', type: 'text', placeholder: 'e.g. Wheat' }, { label: 'Quantity (kg) *', key: 'quantity', type: 'number', placeholder: 'e.g. 500' }, { label: 'Notes', key: 'notes', type: 'text', placeholder: 'Optional notes' }].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: type === 'IN' ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
            {saving ? '...' : `Confirm Stock ${type}`}
          </button>
        </form>
      </div>
    </div>
  );
}

function CreateWarehouseModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', location: '', state: '', capacity: '', warehouseType: 'GENERAL', pricePerQtlPerDay: '2', facilities: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.capacity) return toast.error('Name, location, capacity required');
    setSaving(true);
    try {
      await api.post('/warehouse', { ...form, capacity: Number(form.capacity), pricePerQtlPerDay: Number(form.pricePerQtlPerDay), facilities: form.facilities ? form.facilities.split(',').map(f => f.trim()) : [] });
      toast.success('Warehouse create ho gaya!');
      onCreated(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)' }}>Register Warehouse</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[{ label: 'Warehouse Name *', key: 'name', placeholder: 'e.g. Amritsar Cold Store' }, { label: 'Location / Address *', key: 'location', placeholder: 'Full address' }, { label: 'State', key: 'state', placeholder: 'e.g. Punjab' }, { label: 'Capacity (kg) *', key: 'capacity', type: 'number', placeholder: 'Total storage capacity' }, { label: 'Price per Quintal/Day (₹)', key: 'pricePerQtlPerDay', type: 'number', placeholder: '2' }, { label: 'Facilities (comma-separated)', key: 'facilities', placeholder: 'Fumigation, Weighbridge, CCTV' }].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
              <input type={f.type || 'text'} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Type</label>
            <select value={form.warehouseType} onChange={e => setForm(f => ({ ...f, warehouseType: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Register Warehouse'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WarehousePage() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [stockModal, setStockModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/warehouse'); setWarehouses(r.data.warehouses || []); } catch { toast.error('Load failed'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="ft-page planetono-flow">
      {showCreate && <CreateWarehouseModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {stockModal && <StockModal warehouse={stockModal.warehouse} type={stockModal.type} onClose={() => setStockModal(null)} onDone={load} />}

      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><WarehouseIcon size={20} /> Warehouses</span>
          <button onClick={() => setShowCreate(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><Plus size={16} /> Register</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Warehouse & WMS</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Stock-in, stock-out, warehouse receipts & cold-chain tracking</p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '280px', background: '#f0f4f0', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : warehouses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
            <p style={{ fontSize: '3rem' }}>🏭</p>
            <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)', marginBottom: '1rem' }}>Koi warehouse register nahi hai</p>
            <button onClick={() => setShowCreate(true)} style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Register Warehouse</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {warehouses.map(w => {
              const t = TYPE_LABELS[w.warehouseType] || TYPE_LABELS.GENERAL;
              const fillPct = Math.round((w.currentStock / w.capacity) * 100);
              return (
                <div key={w._id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                  <div style={{ background: `linear-gradient(135deg, ${t.color}15, ${t.color}08)`, padding: '1.5rem', borderBottom: '1px solid var(--ft-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{t.icon}</div>
                        <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem' }}>{w.name}</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--ft-text-muted)' }}>{w.location} {w.state && `· ${w.state}`}</p>
                      </div>
                      <span style={{ padding: '0.2rem 0.75rem', borderRadius: '999px', background: `${t.color}20`, color: t.color, fontWeight: 700, fontSize: '0.75rem' }}>{t.label}</span>
                    </div>
                  </div>
                  <div style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--ft-text-muted)', fontWeight: 600 }}>Storage Used</span>
                        <span style={{ fontWeight: 800 }}>{w.currentStock.toLocaleString()} / {w.capacity.toLocaleString()} kg</span>
                      </div>
                      <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${fillPct}%`, background: fillPct > 80 ? '#dc2626' : fillPct > 60 ? '#d97706' : '#16a34a', borderRadius: '999px', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--ft-text-muted)', marginTop: '0.25rem' }}>{fillPct}% full</div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      {w.pricePerQtlPerDay && <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.3rem 0.6rem', borderRadius: '8px', fontWeight: 600 }}>₹{w.pricePerQtlPerDay}/qtl/day</span>}
                      {w.facilities?.slice(0, 2).map(f => <span key={f} style={{ background: '#f8f8f8', padding: '0.3rem 0.6rem', borderRadius: '8px', color: '#555' }}>{f}</span>)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <button onClick={() => setStockModal({ warehouse: w, type: 'IN' })} style={{ padding: '0.7rem', background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #16a34a30', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                        <ArrowDownCircle size={16} /> Stock IN
                      </button>
                      <button onClick={() => setStockModal({ warehouse: w, type: 'OUT' })} disabled={w.currentStock === 0} style={{ padding: '0.7rem', background: '#fff5f5', color: '#dc2626', border: '1.5px solid #dc262630', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.9rem', opacity: w.currentStock === 0 ? 0.5 : 1 }}>
                        <ArrowUpCircle size={16} /> Stock OUT
                      </button>
                    </div>

                    {w.stockMovements?.length > 0 && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--ft-border)', paddingTop: '1rem' }}>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)', textTransform: 'uppercase' }}>Recent Movements</p>
                        {w.stockMovements.slice(-3).reverse().map((m, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.25rem 0' }}>
                            <span style={{ color: m.type === 'IN' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{m.type === 'IN' ? '▼' : '▲'} {m.cropType || 'Produce'}</span>
                            <span style={{ fontWeight: 600 }}>{m.quantity}kg {m.receiptNo && <span style={{ color: 'var(--ft-text-muted)', fontSize: '0.75rem' }}>#{m.receiptNo}</span>}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
