import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Plus, X, Send, MessageSquare } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const CATEGORIES = { PAYMENT: '💰 Payment', QUALITY: '🔬 Quality', QUANTITY: '⚖️ Quantity', DELIVERY: '🚚 Delivery', FRAUD: '🚨 Fraud', OTHER: '📋 Other' };
const STATUS_COLORS = { OPEN: '#dc2626', UNDER_REVIEW: '#d97706', RESOLVED: '#16a34a', CLOSED: '#6b7280', ESCALATED: '#7c3aed' };
const PRIORITY_COLORS = { LOW: '#6b7280', MEDIUM: '#d97706', HIGH: '#dc2626' };

export default function DisputeResolution() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [form, setForm] = useState({ category: 'QUALITY', description: '', againstName: '', priority: 'MEDIUM' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/dispute/my'); setDisputes(r.data.disputes || []); } catch { toast.error('Load failed'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.description || form.description.length < 10) return toast.error('Description at least 10 characters honi chahiye');
    setSaving(true);
    try {
      const res = await api.post('/dispute', form);
      setDisputes(prev => [res.data.dispute, ...prev]);
      toast.success(`Dispute raise ho gaya! Ticket: ${res.data.dispute.ticketNo}`);
      setShowForm(false);
      setForm({ category: 'QUALITY', description: '', againstName: '', priority: 'MEDIUM' });
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const sendMessage = async () => {
    if (!message.trim() || !selected) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/dispute/${selected._id}/message`, { text: message });
      setSelected(res.data.dispute);
      setDisputes(prev => prev.map(d => d._id === selected._id ? res.data.dispute : d));
      setMessage('');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSendingMsg(false);
  };

  const loadDetail = async (id) => {
    try { const r = await api.get(`/dispute/${id}`); setSelected(r.data.dispute); } catch { toast.error('Load failed'); }
  };

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldAlert size={20} /> Dispute Resolution</span>
          <button onClick={() => setShowForm(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><Plus size={16} /> Raise</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Dispute & Grievance Portal</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Transparent resolution · Real-time communication · Fair arbitration</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Dispute List */}
          <div>
            {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}><div className="ft-spinner" style={{ margin: '0 auto' }} /></div> : disputes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
                <p style={{ fontSize: '3rem' }}>⚖️</p>
                <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)', marginBottom: '1rem' }}>Koi dispute nahi hai</p>
                <button onClick={() => setShowForm(true)} style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Raise Dispute</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {disputes.map(d => (
                  <div key={d._id} onClick={() => loadDetail(d._id)} style={{ background: '#fff', borderRadius: '14px', padding: '1.25rem', border: `2px solid ${selected?._id === d._id ? 'var(--ft-forest)' : 'var(--ft-border)'}`, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{CATEGORIES[d.category]}</span>
                        <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontFamily: 'monospace' }}>{d.ticketNo}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${PRIORITY_COLORS[d.priority]}15`, color: PRIORITY_COLORS[d.priority], fontWeight: 700, fontSize: '0.7rem' }}>{d.priority}</span>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${STATUS_COLORS[d.status]}15`, color: STATUS_COLORS[d.status], fontWeight: 700, fontSize: '0.7rem' }}>{d.status}</span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#333', lineHeight: 1.4 }}>{d.description.substring(0, 120)}{d.description.length > 120 ? '...' : ''}</p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--ft-text-muted)' }}>
                      <span>{new Date(d.createdAt).toLocaleDateString('hi-IN')}</span>
                      {d.messages?.length > 0 && <span><MessageSquare size={12} style={{ display: 'inline' }} /> {d.messages.length}</span>}
                      {d.againstName && <span>Against: {d.againstName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '600px' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--ft-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>{CATEGORIES[selected.category]} · {selected.ticketNo}</div>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${STATUS_COLORS[selected.status]}15`, color: STATUS_COLORS[selected.status], fontWeight: 700, fontSize: '0.75rem' }}>{selected.status}</span>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--ft-border)', background: '#f8fdf8', fontSize: '0.9rem' }}>
                <p style={{ margin: 0 }}>{selected.description}</p>
                {selected.resolution && <div style={{ marginTop: '0.75rem', background: '#dcfce7', borderRadius: '8px', padding: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Resolution: {selected.resolution}</div>}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selected.messages?.length === 0 && <p style={{ textAlign: 'center', color: 'var(--ft-text-muted)', fontSize: '0.9rem' }}>Abhi tak koi message nahi</p>}
                {selected.messages?.map((m, i) => (
                  <div key={i} style={{ maxWidth: '80%', alignSelf: 'flex-start' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ft-text-muted)', marginBottom: '0.25rem' }}>{m.senderName} · {m.senderRole}</div>
                    <div style={{ background: '#f0fdf4', borderRadius: '10px 10px 10px 0', padding: '0.7rem 1rem', fontSize: '0.9rem' }}>{m.text}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--ft-text-muted)', marginTop: '0.2rem' }}>{new Date(m.timestamp).toLocaleTimeString('hi-IN')}</div>
                  </div>
                ))}
              </div>

              {!['RESOLVED', 'CLOSED'].includes(selected.status) && (
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--ft-border)', display: 'flex', gap: '0.75rem' }}>
                  <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Message type karein..." style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '999px', border: '1.5px solid var(--ft-border)', fontSize: '0.9rem' }} />
                  <button onClick={sendMessage} disabled={sendingMsg || !message.trim()} style={{ padding: '0.65rem 1.25rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '999px', cursor: 'pointer' }}>
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Dispute Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontWeight: 900, color: '#dc2626' }}>Raise Dispute</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Category *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <button type="button" key={k} onClick={() => setForm(f => ({ ...f, category: k }))} style={{ padding: '0.35rem 0.9rem', borderRadius: '999px', border: `2px solid ${form.category === k ? '#dc2626' : 'var(--ft-border)'}`, background: form.category === k ? '#fee2e2' : '#fff', color: form.category === k ? '#dc2626' : 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>{v}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Priority</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                    <button type="button" key={p} onClick={() => setForm(f => ({ ...f, priority: p }))} style={{ padding: '0.35rem 0.9rem', borderRadius: '999px', border: `2px solid ${form.priority === p ? PRIORITY_COLORS[p] : 'var(--ft-border)'}`, background: form.priority === p ? `${PRIORITY_COLORS[p]}15` : '#fff', color: form.priority === p ? PRIORITY_COLORS[p] : 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>{p}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Against (Party Name)</label>
                <input type="text" value={form.againstName} onChange={e => setForm(f => ({ ...f, againstName: e.target.value }))} placeholder="Name of the other party" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Description * (min 10 chars)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Poori baat detail mein likhen..." style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }} required />
              </div>

              <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Raising...' : 'Raise Dispute'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
